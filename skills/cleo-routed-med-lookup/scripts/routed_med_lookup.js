#!/usr/bin/env node
// Routed Med Lookup Script for Cleo
// Usage: node routed_med_lookup.js <ROUTED_MED_ID> [--db fdb_20260305] [--uri mongodb+srv://...]
//
// Looks up an FDB Routed Med ID and returns: name, route, dose forms, available strengths,
// therapeutic classes, ingredient, indications, and NDC count.

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { id: null, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
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

async function lookupRoutedMed(db, rmId) {
  const result = { routed_med_id: rmId, found: false };

  // 1. Routed Med Master
  const rm = await db.collection('RMIRMID1_ROUTED_MED').findOne({ ROUTED_MED_ID: rmId });
  if (!rm) return result;

  result.found = true;
  result.description = rm.MED_ROUTED_MED_ID_DESC?.trim();
  result.status = rm.MED_STATUS_CD === '0' ? 'active' : 'inactive';

  // 2. Med Name
  const medName = await db.collection('RMINMID1_MED_NAME').findOne({ MED_NAME_ID: rm.MED_NAME_ID });
  if (medName) {
    result.med_name = medName.MED_NAME?.trim();
    result.med_name_type = medName.MED_NAME_TYPE_CD === '1' ? 'brand' : 'generic';
  }

  // 3. Routed Dose Form Med links → products
  const rdfLinks = await db.collection('RMIDFID1_ROUTED_DOSE_FORM_MED')
    .find({ ROUTED_MED_ID: rmId }).toArray();
  const rdfIds = rdfLinks.map(r => r.ROUTED_DOSAGE_FORM_MED_ID);

  if (rdfLinks.length > 0) {
    result.dose_forms = rdfLinks.map(r => ({
      routed_dosage_form_med_id: r.ROUTED_DOSAGE_FORM_MED_ID,
      description: r.MED_ROUTED_DF_MED_ID_DESC?.trim(),
      status: r.MED_STATUS_CD === '0' ? 'active' : 'inactive'
    }));
  }

  // 4. Get all MEDIDs (products with strengths)
  const meds = await db.collection('RMIID1_MED')
    .find({ ROUTED_DOSAGE_FORM_MED_ID: { $in: rdfIds }, MED_STATUS_CD: '0' }).toArray();

  if (meds.length > 0) {
    result.products = meds.map(m => ({
      medid: m.MEDID,
      routed_dosage_form_med_id: m.ROUTED_DOSAGE_FORM_MED_ID,
      description: m.MED_MEDID_DESC?.trim(),
      strength: m.MED_STRENGTH,
      strength_uom: m.MED_STRENGTH_UOM,
      gcn_seqno: m.GCN_SEQNO,
      legend: m.MED_REF_FED_LEGEND_IND === '1' ? 'Rx' : 'OTC',
      dea: m.MED_REF_DEA_CD
    }));

    // 5. GCN details for strengths and route
    const gcnSeqnos = [...new Set(meds.map(m => m.GCN_SEQNO))];
    const gcns = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
      .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();

    if (gcns.length > 0) {
      result.strengths = gcns.map(g => g.STR60?.trim() || g.STR?.trim()).sort();

      // Route
      const routeCode = gcns[0]?.GCRT;
      if (routeCode) {
        const route = await db.collection('RROUTED3_ROUTE_DESC').findOne({ GCRT: routeCode });
        result.route = route?.GCRT_DESC?.trim() || routeCode;
      }

      // 6. Ingredient
      const hicls = [...new Set(gcns.map(g => g.HICL_SEQNO))];
      const ingredients = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
        .find({ HICL_SEQNO: { $in: hicls } }).toArray();
      result.ingredients = ingredients.map(i =>
        (i.GNN60 || i.GNN || '').trim()
      ).filter(Boolean);

      // 7. Therapeutic Classes
      const etcLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
        .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
      const etcIds = [...new Set(etcLinks.map(e => e.ETC_ID))];
      const etcs = await db.collection('RETCTBL0_ETC_ID')
        .find({ ETC_ID: { $in: etcIds } }).toArray();
      result.therapeutic_classes = etcs.map(e => ({
        etc_id: e.ETC_ID,
        name: e.ETC_NAME
      }));

      // 8. Indications
      const indLinks = await db.collection('RINDMGC0_INDCTS_GCNSEQNO_LINK')
        .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
      const indIds = [...new Set(indLinks.map(i => i.INDCTS))];

      if (indIds.length > 0) {
        const inds = await db.collection('RINDMMA2_INDCTS_MSTR')
          .find({ INDCTS: { $in: indIds } }).toArray();
        const dxIds = [...new Set(inds.map(i => i.DXID))];
        const dxDescs = await db.collection('RFMLDX0_DXID')
          .find({ DXID: { $in: dxIds } }).toArray();
        const dxMap = Object.fromEntries(dxDescs.map(d => [d.DXID, d.DXID_DESC100]));

        result.indications = inds.map(ind => ({
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

      // 9. NDC count
      result.ndc_count = await db.collection('RNDC14_NDC_MSTR')
        .countDocuments({ GCN_SEQNO: { $in: gcnSeqnos } });
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.id && opts.id !== 0) {
    console.error('Usage: node routed_med_lookup.js <ROUTED_MED_ID> [--db fdb_YYYYMMDD] [--uri mongodb+srv://...]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }

    const db = client.db(dbName);
    const result = await lookupRoutedMed(db, opts.id);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
