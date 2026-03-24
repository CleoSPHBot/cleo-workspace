#!/usr/bin/env node
// MEDID Lookup Script for Cleo
// Usage: node medid_lookup.js <MEDID> [--db fdb_YYYYMMDD] [--uri mongodb+srv://...] [--img-dir /path]
//
// Looks up an FDB MEDID and returns: full drug description, brand/generic, strength,
// dose form, route, ingredient, generic equivalent, hierarchy IDs, therapeutic classes,
// indications, NDC count with samples, and optionally a pill image.

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { id: null, db: null, uri: DEFAULT_URI, imgDir: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (args[i] === '--img-dir' && args[i + 1]) { opts.imgDir = args[++i]; }
    else if (!args[i].startsWith('-')) { opts.id = parseInt(args[i], 10); }
  }
  return opts;
}

async function getLatestFdbDb(client) {
  const admin = client.db('admin');
  const { databases } = await admin.command({ listDatabases: 1, nameOnly: true });
  const fdbDbs = databases
    .map(d => d.name)
    .filter(n => /^fdb_\d{8}$/.test(n))
    .sort()
    .reverse();
  for (const dbName of fdbDbs) {
    const info = await client.db(dbName).collection('NDDF_PRODUCT_INFO').findOne({});
    if (info?.createDate) return dbName;
  }
  return null;
}

async function lookupMedid(db, medid, imgDir) {
  const result = { medid, found: false };

  // 1. Med master
  const med = await db.collection('RMIID1_MED').findOne({ MEDID: medid });
  if (!med) return result;

  result.found = true;
  result.description = med.MED_MEDID_DESC?.trim();
  result.strength = med.MED_STRENGTH;
  result.strength_uom = med.MED_STRENGTH_UOM;
  result.gcn_seqno = med.GCN_SEQNO;
  result.routed_dosage_form_med_id = med.ROUTED_DOSAGE_FORM_MED_ID;
  result.status = med.MED_STATUS_CD === '0' ? 'active' : 'inactive';
  result.legend = med.MED_REF_FED_LEGEND_IND === '1' ? 'Rx' : 'OTC';
  result.dea_schedule = med.MED_REF_DEA_CD !== '0' ? `Schedule ${med.MED_REF_DEA_CD}` : 'none';
  result.multi_source = med.MED_REF_MULTI_SOURCE_CD;
  result.innovator = med.MED_REF_INNOV_IND === '1' ? true : false;

  // Generic equivalent
  if (med.GENERIC_MEDID && med.GENERIC_MEDID !== medid) {
    const gen = await db.collection('RMIID1_MED').findOne({ MEDID: med.GENERIC_MEDID });
    if (gen) {
      result.generic_equivalent = {
        medid: gen.MEDID,
        description: gen.MED_MEDID_DESC?.trim()
      };
    }
  }

  // 2. Routed Dose Form Med → Routed Med hierarchy
  const rdf = await db.collection('RMIDFID1_ROUTED_DOSE_FORM_MED')
    .findOne({ ROUTED_DOSAGE_FORM_MED_ID: med.ROUTED_DOSAGE_FORM_MED_ID });

  if (rdf) {
    result.routed_dose_form_description = rdf.MED_ROUTED_DF_MED_ID_DESC?.trim();
    result.routed_med_id = rdf.ROUTED_MED_ID;

    // Dose form
    const df = await db.collection('RMIDFD1_DOSE_FORM')
      .findOne({ MED_DOSAGE_FORM_ID: rdf.MED_DOSAGE_FORM_ID });
    if (df) {
      result.dose_form = df.MED_DOSAGE_FORM_DESC?.trim();
    }

    // Routed Med
    const rm = await db.collection('RMIRMID1_ROUTED_MED')
      .findOne({ ROUTED_MED_ID: rdf.ROUTED_MED_ID });
    if (rm) {
      result.routed_med_description = rm.MED_ROUTED_MED_ID_DESC?.trim();

      // Med Name
      const name = await db.collection('RMINMID1_MED_NAME')
        .findOne({ MED_NAME_ID: rm.MED_NAME_ID });
      if (name) {
        result.med_name = name.MED_NAME?.trim();
        result.med_name_type = name.MED_NAME_TYPE_CD === '1' ? 'brand' : 'generic';
        result.med_name_id = name.MED_NAME_ID;
      }
    }
  }

  // 3. GCN details
  const gcn = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
    .findOne({ GCN_SEQNO: med.GCN_SEQNO });

  if (gcn) {
    // Route
    const route = await db.collection('RROUTED3_ROUTE_DESC').findOne({ GCRT: gcn.GCRT });
    result.route = route?.GCRT_DESC?.trim() || gcn.GCRT;

    // Ingredient
    const ingr = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
      .findOne({ HICL_SEQNO: gcn.HICL_SEQNO });
    result.ingredient = ingr?.GNN60?.trim() || ingr?.GNN?.trim();
    result.hicl_seqno = gcn.HICL_SEQNO;
  }

  // 4. Therapeutic Classes (via MEDID-level link)
  const etcLinks = await db.collection('RETCMED0_ETC_MEDID')
    .find({ MEDID: medid }).toArray();
  let etcIds = etcLinks.map(e => e.ETC_ID);

  // Fallback to GCN-level
  if (etcIds.length === 0) {
    const gcnEtcLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
      .find({ GCN_SEQNO: med.GCN_SEQNO }).toArray();
    etcIds = gcnEtcLinks.map(e => e.ETC_ID);
  }

  if (etcIds.length > 0) {
    const etcs = await db.collection('RETCTBL0_ETC_ID')
      .find({ ETC_ID: { $in: etcIds } }).toArray();
    result.therapeutic_classes = etcs.map(e => ({
      etc_id: e.ETC_ID,
      name: e.ETC_NAME
    }));
  }

  // 5. Indications
  const indLinks = await db.collection('RINDMGC0_INDCTS_GCNSEQNO_LINK')
    .find({ GCN_SEQNO: med.GCN_SEQNO }).toArray();
  const indIds = [...new Set(indLinks.map(i => i.INDCTS))];

  if (indIds.length > 0) {
    const inds = await db.collection('RINDMMA2_INDCTS_MSTR')
      .find({ INDCTS: { $in: indIds } }).toArray();
    const dxIds = [...new Set(inds.map(i => i.DXID))];
    const dxDescs = await db.collection('RFMLDX0_DXID')
      .find({ DXID: { $in: dxIds } }).toArray();
    const dxMap = Object.fromEntries(dxDescs.map(d => [d.DXID, d.DXID_DESC100]));

    const byDx = {};
    for (const ind of inds) {
      if (!byDx[ind.DXID] || ind.INDCTS_LBL === 'L') {
        byDx[ind.DXID] = {
          dxid: ind.DXID,
          diagnosis: dxMap[ind.DXID] || 'Unknown',
          labeled: ind.INDCTS_LBL === 'L' ? 'labeled' : 'off-label'
        };
      }
    }
    result.indications = Object.values(byDx);
  }

  // 6. NDCs (via GCN_SEQNO for this strength)
  const ndcCount = await db.collection('RNDC14_NDC_MSTR')
    .countDocuments({ GCN_SEQNO: med.GCN_SEQNO });
  result.ndc_count = ndcCount;

  // Representative NDCs: match by brand/generic name from the MEDID description
  const medDescWords = (med.MED_MEDID_DESC || '').trim().toUpperCase();
  const ndcSamples = await db.collection('RNDC14_NDC_MSTR')
    .find({ GCN_SEQNO: med.GCN_SEQNO })
    .toArray();

  // Filter NDCs whose label matches this MEDID's description
  const matchingNdcs = ndcSamples.filter(n => {
    const label = (n.LN60 || n.LN || '').toUpperCase();
    return label === medDescWords;
  });

  // Deduplicate by labeler (first 5 digits of NDC)
  const byLabeler = {};
  for (const n of (matchingNdcs.length > 0 ? matchingNdcs : ndcSamples)) {
    const labeler = n.NDC.substring(0, 5);
    if (!byLabeler[labeler]) byLabeler[labeler] = n;
  }
  const repNdcs = Object.values(byLabeler).slice(0, 10);

  if (repNdcs.length > 0) {
    result.representative_ndcs = repNdcs.map(n => ({
      ndc: n.NDC,
      label: (n.LN60 || n.LN || '').trim(),
      pack_size: n.PS
    }));
  }

  // 7. Sibling MEDIDs (same GCN = same strength, different brands/generics)
  const siblings = await db.collection('RMIID1_MED')
    .find({ GCN_SEQNO: med.GCN_SEQNO, MEDID: { $ne: medid }, MED_STATUS_CD: '0' })
    .toArray();
  if (siblings.length > 0) {
    result.equivalent_products = siblings.map(s => ({
      medid: s.MEDID,
      description: s.MED_MEDID_DESC?.trim(),
      routed_dosage_form_med_id: s.ROUTED_DOSAGE_FORM_MED_ID
    }));
  }

  // 8. Pill image (via representative NDCs)
  if (imgDir && repNdcs.length > 0) {
    for (const ndc of repNdcs) {
      const imgLink = await db.collection('RIMGUDG2_UNQ_DRUG').findOne({ IMGNDC: ndc.NDC });
      if (!imgLink) continue;
      const imgJrnl = await db.collection('RIMGUIJ2_UNQ_DRUG_JRNL')
        .findOne({ IMGUDGID: imgLink.IMGUDGID });
      if (!imgJrnl) continue;
      const img = await db.collection('RIMGIMG2_IMAGE').findOne({ IMGIMGID: imgJrnl.IMGIMGID });
      if (!img) continue;
      const imgData = await db.collection('RIMGIMG2_IMAGE_DATA').findOne({ IMGIMGID: img.IMGIMGID });
      if (!imgData?.IMGDATA) continue;

      const buf = Buffer.from(imgData.IMGDATA.buffer || imgData.IMGDATA);
      const imgPath = path.join(imgDir, `medid_${medid}.jpg`);
      fs.writeFileSync(imgPath, buf);
      result.image_path = imgPath;
      break;
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.id && opts.id !== 0) {
    console.error('Usage: node medid_lookup.js <MEDID> [--db fdb_YYYYMMDD] [--uri mongodb+srv://...] [--img-dir /path]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }

    const db = client.db(dbName);
    const result = await lookupMedid(db, opts.id, opts.imgDir);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
