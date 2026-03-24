#!/usr/bin/env node
// NDC Lookup Script for Cleo
// Usage: node ndc_lookup.js <NDC> [--db fdb_20260305] [--uri mongodb+srv://...] [--img-dir /path/to/dir]
//
// Accepts NDC in any format: 00069-3150-83, 00069315083, 0069-3150-83
// Returns structured drug information as JSON.
// If --img-dir is provided, saves pill image as <NDC>.jpg in that directory.

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { ndc: null, db: null, uri: DEFAULT_URI, imgDir: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (args[i] === '--img-dir' && args[i + 1]) { opts.imgDir = args[++i]; }
    else if (!args[i].startsWith('-')) { opts.ndc = args[i]; }
  }
  return opts;
}

function normalizeNDC(ndc) {
  // Strip dashes/spaces, return raw digits
  return ndc.replace(/[-\s]/g, '');
}

async function getLatestFdbDb(client) {
  const admin = client.db('admin');
  const { databases } = await admin.command({ listDatabases: 1, nameOnly: true });
  const fdbDbs = databases
    .map(d => d.name)
    .filter(n => /^fdb_\d{8}$/.test(n))
    .sort()
    .reverse();

  // Walk newest→oldest, pick the first DB where ETL is complete
  // (NDDF_PRODUCT_INFO.createDate exists only after ETL finishes)
  for (const dbName of fdbDbs) {
    const info = await client.db(dbName).collection('NDDF_PRODUCT_INFO').findOne({});
    if (info?.createDate) return dbName;
  }
  return null;
}

async function lookupNDC(db, ndc) {
  const result = { ndc, found: false };

  // 1. NDC Master
  const ndcDoc = await db.collection('RNDC14_NDC_MSTR').findOne({ NDC: ndc });
  if (!ndcDoc) return result;

  result.found = true;
  result.label = ndcDoc.LN?.trim() || ndcDoc.LN60?.trim();
  result.brand = ndcDoc.BN?.trim();
  result.gcn_seqno = ndcDoc.GCN_SEQNO;
  result.dea_schedule = ndcDoc.DEA;
  result.package_desc = ndcDoc.PD?.trim();
  result.pack_size = ndcDoc.PS;
  result.obsolete_date = ndcDoc.OBSDTEC;
  result.unit_dose = ndcDoc.UD;
  result.repackager = ndcDoc.REPACK;
  result.obc = ndcDoc.OBC;

  // 2. GCN Master
  const gcn = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR').findOne({ GCN_SEQNO: ndcDoc.GCN_SEQNO });
  if (gcn) {
    result.strength = gcn.STR60?.trim() || gcn.STR?.trim();
    result.dose_form_code = gcn.GCDF;
    result.route_code = gcn.GCRT;
    result.hicl_seqno = gcn.HICL_SEQNO;

    // Route description
    const route = await db.collection('RROUTED3_ROUTE_DESC').findOne({ GCRT: gcn.GCRT });
    if (route) result.route = route.GCRT_DESC?.trim();

    // Dose form description
    const doseForm = await db.collection('RDOSED2_DOSE_DESC').findOne({ GCDF: gcn.GCDF });
    if (doseForm) result.dose_form = doseForm.GCDF_DESC?.trim() || doseForm.DOSE?.trim() || gcn.GCDF;
  }

  // 3. ETC Classifications
  const etcLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
    .find({ GCN_SEQNO: ndcDoc.GCN_SEQNO }).toArray();
  if (etcLinks.length) {
    const etcIds = etcLinks.map(e => e.ETC_ID);
    const etcs = await db.collection('RETCTBL0_ETC_ID')
      .find({ ETC_ID: { $in: etcIds } }).toArray();
    result.therapeutic_classes = etcs.map(e => ({
      etc_id: e.ETC_ID,
      name: e.ETC_NAME,
      is_default: etcLinks.find(l => l.ETC_ID === e.ETC_ID)?.ETC_DEFAULT_USE_IND === '1'
    }));
  }

  // 4. Indications
  const indLinks = await db.collection('RINDMGC0_INDCTS_GCNSEQNO_LINK')
    .find({ GCN_SEQNO: ndcDoc.GCN_SEQNO }).toArray();
  if (indLinks.length) {
    const indIds = indLinks.map(i => i.INDCTS);
    const inds = await db.collection('RINDMMA2_INDCTS_MSTR')
      .find({ INDCTS: { $in: indIds } }).toArray();
    const dxIds = [...new Set(inds.map(i => i.DXID))];
    const dxDescs = await db.collection('RFMLDX0_DXID')
      .find({ DXID: { $in: dxIds } }).toArray();

    const dxMap = Object.fromEntries(dxDescs.map(d => [d.DXID, d.DXID_DESC100]));
    result.indications = inds.map(ind => ({
      indication_id: ind.INDCTS,
      dxid: ind.DXID,
      diagnosis: dxMap[ind.DXID] || 'Unknown',
      labeled: ind.INDCTS_LBL === 'L' ? 'labeled' : 'off-label'
    }));

    // Deduplicate by DXID, prefer labeled
    const byDx = {};
    for (const ind of result.indications) {
      if (!byDx[ind.dxid] || ind.labeled === 'labeled') byDx[ind.dxid] = ind;
    }
    result.indications = Object.values(byDx);
  }

  // 5. HIC (ingredient) info
  if (gcn) {
    const hicl = await db.collection('RHICLSQ1_HICLSEQNO_MSTR').findOne({ HICL_SEQNO: gcn.HICL_SEQNO });
    if (hicl) {
      result.ingredient = {
        hicl_seqno: hicl.HICL_SEQNO,
        generic_name: (hicl.GNN60 || hicl.GNN || '').trim()
      };
    }
  }

  // 6. Pill image lookup
  //    NDC → RIMGUDG2_UNQ_DRUG → RIMGUIJ2_UNQ_DRUG_JRNL → RIMGIMG2_IMAGE → RIMGIMG2_IMAGE_DATA
  const imgDrug = await db.collection('RIMGUDG2_UNQ_DRUG').findOne({ IMGNDC: ndc });
  if (imgDrug) {
    // Get most recent image journal entry (sorted by start date desc, pick first active one)
    const imgJournal = await db.collection('RIMGUIJ2_UNQ_DRUG_JRNL')
      .find({ IMGUNIQID: imgDrug.IMGUNIQID })
      .sort({ IMGSTRTDT: -1 })
      .limit(1)
      .toArray();

    if (imgJournal.length > 0) {
      const imgMaster = await db.collection('RIMGIMG2_IMAGE').findOne({ IMGID: imgJournal[0].IMGID });
      if (imgMaster) {
        const imgData = await db.collection('RIMGIMG2_IMAGE_DATA').findOne({ IMGFILENM: imgMaster.IMGFILENM });
        if (imgData?.IMGFILENM_DATA) {
          result.image = {
            filename: imgMaster.IMGFILENM,
            has_data: true
          };
          // Stash raw b64 for file output (not included in JSON output)
          result._imageB64 = imgData.IMGFILENM_DATA;
        }
      }
    }
  }

  // 7. Med ID info
  const medDoc = await db.collection('RMIID1_MED').findOne({ GCN_SEQNO: ndcDoc.GCN_SEQNO, MED_STATUS_CD: '0' });
  if (medDoc) {
    result.med_id = medDoc.MEDID;
    result.med_description = medDoc.MED_MEDID_DESC?.trim();
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.ndc) {
    console.error('Usage: node ndc_lookup.js <NDC> [--db fdb_YYYYMMDD] [--uri mongodb+srv://...]');
    process.exit(1);
  }

  const ndc = normalizeNDC(opts.ndc);
  const client = new MongoClient(opts.uri);

  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }

    const db = client.db(dbName);
    const result = await lookupNDC(db, ndc);
    result.database = dbName;

    // Save pill image if available and --img-dir specified
    if (result._imageB64 && opts.imgDir) {
      const imgPath = path.join(opts.imgDir, `${ndc}.jpg`);
      fs.writeFileSync(imgPath, Buffer.from(result._imageB64, 'base64'));
      result.image.saved_to = imgPath;
    }

    // Remove internal b64 data before JSON output
    delete result._imageB64;

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
