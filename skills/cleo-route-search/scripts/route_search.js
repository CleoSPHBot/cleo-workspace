#!/usr/bin/env node
// Routed Med Name Search — "What are the routes for Lipitor?"
// Usage: node route_search.js <drug_name> [--db fdb_YYYYMMDD] [--uri ...]
//
// Searches routed med descriptions and med names, returns all routes, dose forms,
// and products for matching drugs (both brand and generic).

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { search: null, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
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

async function searchRoutes(db, search) {
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  // 1. Search med names (brand and generic)
  const names = await db.collection('RMINMID1_MED_NAME')
    .find({ MED_NAME: regex, MED_STATUS_CD: '0' }).toArray();
  const nameIds = names.map(n => n.MED_NAME_ID);

  // 2. Also search routed med descriptions directly (catches combo names)
  const directRms = await db.collection('RMIRMID1_ROUTED_MED')
    .find({ MED_ROUTED_MED_ID_DESC: regex, MED_STATUS_CD: '0' }).toArray();

  // 3. Get routed meds via name IDs
  const nameRms = nameIds.length > 0
    ? await db.collection('RMIRMID1_ROUTED_MED')
        .find({ MED_NAME_ID: { $in: nameIds }, MED_STATUS_CD: '0' }).toArray()
    : [];

  // Merge and deduplicate
  const rmMap = {};
  for (const rm of [...nameRms, ...directRms]) {
    rmMap[rm.ROUTED_MED_ID] = rm;
  }
  const allRms = Object.values(rmMap);

  if (allRms.length === 0) return { search, found: false, results: [] };

  // Build med name map
  const allNameIds = [...new Set(allRms.map(r => r.MED_NAME_ID))];
  const allNames = await db.collection('RMINMID1_MED_NAME')
    .find({ MED_NAME_ID: { $in: allNameIds } }).toArray();
  const nameMap = Object.fromEntries(allNames.map(n => [n.MED_NAME_ID, n]));

  // For each routed med, get dose forms and products
  const results = [];
  for (const rm of allRms) {
    const name = nameMap[rm.MED_NAME_ID];
    const entry = {
      routed_med_id: rm.ROUTED_MED_ID,
      description: rm.MED_ROUTED_MED_ID_DESC?.trim(),
      med_name: name?.MED_NAME?.trim(),
      med_name_id: rm.MED_NAME_ID,
      med_name_type: name?.MED_NAME_TYPE_CD === '1' ? 'brand' : 'generic',
      route: rm.MED_ROUTED_MED_ID_DESC?.replace(name?.MED_NAME || '', '').trim() || null,
      dose_forms: []
    };

    // Get dose forms
    const dfs = await db.collection('RMIDFID1_ROUTED_DOSE_FORM_MED')
      .find({ ROUTED_MED_ID: rm.ROUTED_MED_ID, MED_STATUS_CD: '0' }).toArray();

    for (const df of dfs) {
      // Get dose form name
      const dfDesc = await db.collection('RMIDFD1_DOSE_FORM')
        .findOne({ MED_DOSAGE_FORM_ID: df.MED_DOSAGE_FORM_ID });

      // Get products (MEDIDs) for this dose form
      const meds = await db.collection('RMIID1_MED')
        .find({ ROUTED_DOSAGE_FORM_MED_ID: df.ROUTED_DOSAGE_FORM_MED_ID, MED_STATUS_CD: '0' })
        .toArray();

      entry.dose_forms.push({
        routed_dosage_form_med_id: df.ROUTED_DOSAGE_FORM_MED_ID,
        description: df.MED_ROUTED_DF_MED_ID_DESC?.trim(),
        dose_form: dfDesc?.MED_DOSAGE_FORM_DESC?.trim() || null,
        product_count: meds.length,
        products: meds.map(m => ({
          medid: m.MEDID,
          description: m.MED_MEDID_DESC?.trim(),
          strength: m.MED_STRENGTH,
          strength_uom: m.MED_STRENGTH_UOM,
          gcn_seqno: m.GCN_SEQNO,
          legend: m.MED_REF_FED_LEGEND_IND === '1' ? 'Rx' : 'OTC'
        })).sort((a, b) => {
          const aNum = parseFloat(a.strength) || 0;
          const bNum = parseFloat(b.strength) || 0;
          return aNum - bNum;
        })
      });
    }

    // Extract the actual route from a product's GCN if available
    if (entry.dose_forms.length > 0 && entry.dose_forms[0].products.length > 0) {
      const firstGcn = entry.dose_forms[0].products[0].gcn_seqno;
      const gcn = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR').findOne({ GCN_SEQNO: firstGcn });
      if (gcn) {
        const routeDoc = await db.collection('RROUTED3_ROUTE_DESC').findOne({ GCRT: gcn.GCRT });
        entry.route = routeDoc?.GCRT_DESC?.trim() || gcn.GCRT;

        // Ingredient
        const hicl = await db.collection('RHICLSQ1_HICLSEQNO_MSTR').findOne({ HICL_SEQNO: gcn.HICL_SEQNO });
        entry.ingredient = (hicl?.GNN60 || hicl?.GNN || '').trim();
      }
    }

    results.push(entry);
  }

  // Sort: brand first, then generic, then by name
  results.sort((a, b) => {
    if (a.med_name_type !== b.med_name_type) return a.med_name_type === 'brand' ? -1 : 1;
    return (a.med_name || '').localeCompare(b.med_name || '');
  });

  return {
    search,
    found: true,
    result_count: results.length,
    results
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.search) {
    console.error('Usage: node route_search.js <drug_name> [--db ...] [--uri ...]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }
    const db = client.db(dbName);

    const result = await searchRoutes(db, opts.search);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
