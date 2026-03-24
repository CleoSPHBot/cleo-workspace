#!/usr/bin/env node
// Drug Name Search for Cleo
// Usage: node drug_search.js <name> [--db fdb_YYYYMMDD] [--uri ...]
//
// Searches drug names and returns matching MEDIDs grouped by ingredient/brand.

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { search: null, db: null, uri: DEFAULT_URI, limit: 50 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (args[i] === '--limit' && args[i + 1]) { opts.limit = parseInt(args[++i], 10); }
    else if (!args[i].startsWith('-')) {
      opts.search = opts.search ? opts.search + ' ' + args[i] : args[i];
    }
  }
  return opts;
}

async function getLatestFdbDb(client) {
  const { databases } = await client.db('admin').command({ listDatabases: 1, nameOnly: true });
  const fdbDbs = databases.map(d => d.name).filter(n => /^fdb_\d{8}$/.test(n)).sort().reverse();
  for (const dbName of fdbDbs) {
    const info = await client.db(dbName).collection('NDDF_PRODUCT_INFO').findOne({});
    if (info?.createDate) return dbName;
  }
  return null;
}

async function searchDrugs(db, search, limit) {
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  // Search MEDIDs
  const meds = await db.collection('RMIID1_MED')
    .find({ MED_MEDID_DESC: regex, MED_STATUS_CD: '0' })
    .limit(limit)
    .toArray();

  if (meds.length === 0) return { search, found: false, results: [] };

  // Get routed dose form info for hierarchy
  const rdfIds = [...new Set(meds.map(m => m.ROUTED_DOSAGE_FORM_MED_ID))];
  const rdfs = await db.collection('RMIDFID1_ROUTED_DOSE_FORM_MED')
    .find({ ROUTED_DOSAGE_FORM_MED_ID: { $in: rdfIds } }).toArray();
  const rdfMap = Object.fromEntries(rdfs.map(r => [r.ROUTED_DOSAGE_FORM_MED_ID, r]));

  // Get routed meds
  const rmIds = [...new Set(rdfs.map(r => r.ROUTED_MED_ID))];
  const rms = await db.collection('RMIRMID1_ROUTED_MED')
    .find({ ROUTED_MED_ID: { $in: rmIds } }).toArray();
  const rmMap = Object.fromEntries(rms.map(r => [r.ROUTED_MED_ID, r]));

  // Get med names
  const nameIds = [...new Set(rms.map(r => r.MED_NAME_ID))];
  const names = await db.collection('RMINMID1_MED_NAME')
    .find({ MED_NAME_ID: { $in: nameIds } }).toArray();
  const nameMap = Object.fromEntries(names.map(n => [n.MED_NAME_ID, n]));

  // Get GCN info for ingredients
  const gcnSeqnos = [...new Set(meds.map(m => m.GCN_SEQNO))];
  const gcns = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
    .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
  const gcnMap = Object.fromEntries(gcns.map(g => [g.GCN_SEQNO, g]));

  const hicls = [...new Set(gcns.map(g => g.HICL_SEQNO))];
  const ingredients = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
    .find({ HICL_SEQNO: { $in: hicls } }).toArray();
  const hiclMap = Object.fromEntries(ingredients.map(i => [i.HICL_SEQNO, (i.GNN60 || i.GNN || '').trim()]));

  // Get ETC info
  const etcLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
    .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
  const etcIds = [...new Set(etcLinks.map(e => e.ETC_ID))];
  const etcs = await db.collection('RETCTBL0_ETC_ID')
    .find({ ETC_ID: { $in: etcIds } }).toArray();
  const etcMap = Object.fromEntries(etcs.map(e => [e.ETC_ID, e.ETC_NAME]));

  // Build GCN → ETC mapping
  const gcnEtc = {};
  for (const link of etcLinks) {
    if (!gcnEtc[link.GCN_SEQNO]) gcnEtc[link.GCN_SEQNO] = [];
    if (etcMap[link.ETC_ID]) gcnEtc[link.GCN_SEQNO].push(etcMap[link.ETC_ID]);
  }

  // Group by routed med (brand/generic family)
  const groups = {};
  for (const med of meds) {
    const rdf = rdfMap[med.ROUTED_DOSAGE_FORM_MED_ID];
    const rm = rdf ? rmMap[rdf.ROUTED_MED_ID] : null;
    const name = rm ? nameMap[rm.MED_NAME_ID] : null;
    const gcn = gcnMap[med.GCN_SEQNO];
    const ingredient = gcn ? hiclMap[gcn.HICL_SEQNO] : null;

    const groupKey = rdf ? rdf.ROUTED_DOSAGE_FORM_MED_ID : med.MEDID;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        med_name: name?.MED_NAME?.trim(),
        med_name_type: name?.MED_NAME_TYPE_CD === '1' ? 'brand' : 'generic',
        routed_med_id: rm?.ROUTED_MED_ID,
        routed_med_description: rm?.MED_ROUTED_MED_ID_DESC?.trim(),
        routed_dosage_form_med_id: rdf?.ROUTED_DOSAGE_FORM_MED_ID,
        routed_dose_form_description: rdf?.MED_ROUTED_DF_MED_ID_DESC?.trim(),
        ingredient,
        therapeutic_classes: [...new Set(Object.values(gcnEtc).flat())].sort(),
        products: []
      };
    }

    groups[groupKey].products.push({
      medid: med.MEDID,
      description: med.MED_MEDID_DESC?.trim(),
      strength: med.MED_STRENGTH,
      strength_uom: med.MED_STRENGTH_UOM,
      gcn_seqno: med.GCN_SEQNO,
      legend: med.MED_REF_FED_LEGEND_IND === '1' ? 'Rx' : 'OTC'
    });
  }

  // Sort products within each group
  for (const g of Object.values(groups)) {
    g.products.sort((a, b) => {
      const aNum = parseFloat(a.strength) || 0;
      const bNum = parseFloat(b.strength) || 0;
      return aNum - bNum || (a.description || '').localeCompare(b.description || '');
    });
  }

  const totalMedids = meds.length;
  const totalInDb = await db.collection('RMIID1_MED')
    .countDocuments({ MED_MEDID_DESC: regex, MED_STATUS_CD: '0' });

  return {
    search,
    found: true,
    total_matches: totalInDb,
    showing: totalMedids,
    groups: Object.values(groups).sort((a, b) =>
      (a.med_name || '').localeCompare(b.med_name || '')
    )
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.search) {
    console.error('Usage: node drug_search.js <name> [--limit 50] [--db ...] [--uri ...]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }
    const db = client.db(dbName);

    const result = await searchDrugs(db, opts.search, opts.limit);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
