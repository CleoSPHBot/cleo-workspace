#!/usr/bin/env node
// Reverse Indication Lookup — "What drugs treat [condition]?"
// Usage: node reverse_indication.js <search_term> [--dxid 1432] [--db fdb_YYYYMMDD] [--uri ...]
//
// Searches DXID descriptions, then traces: DXID → RINDMMA2 → RINDMGC0 → GCN → ingredients + ETCs

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { search: null, dxid: null, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dxid' && args[i + 1]) { opts.dxid = parseInt(args[++i], 10); }
    else if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
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

async function findDxids(db, search) {
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return db.collection('RFMLDX0_DXID')
    .find({ DXID_DESC100: regex, DXID_STATUS: '0' })
    .limit(20)
    .toArray();
}

async function getDrugsForDxid(db, dxid) {
  // DXID → indication entries
  const inds = await db.collection('RINDMMA2_INDCTS_MSTR')
    .find({ DXID: dxid }).toArray();
  const indIds = inds.map(i => i.INDCTS);

  // Separate labeled vs off-label
  const labeledIndIds = inds.filter(i => i.INDCTS_LBL === 'L').map(i => i.INDCTS);
  const offLabelIndIds = inds.filter(i => i.INDCTS_LBL !== 'L').map(i => i.INDCTS);

  // Indication → GCN links
  const gcnLinks = await db.collection('RINDMGC0_INDCTS_GCNSEQNO_LINK')
    .find({ INDCTS: { $in: indIds } }).toArray();

  // Map GCN to labeled/off-label
  const gcnLabeled = {};
  for (const link of gcnLinks) {
    if (labeledIndIds.includes(link.INDCTS)) {
      gcnLabeled[link.GCN_SEQNO] = 'labeled';
    } else if (!gcnLabeled[link.GCN_SEQNO]) {
      gcnLabeled[link.GCN_SEQNO] = 'off-label';
    }
  }

  const gcnSeqnos = [...new Set(gcnLinks.map(g => g.GCN_SEQNO))];

  // GCN → ingredients
  const gcns = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
    .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
  const hicls = [...new Set(gcns.map(g => g.HICL_SEQNO))];
  const ingredients = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
    .find({ HICL_SEQNO: { $in: hicls } }).toArray();

  // Map HICL → ingredient name
  const hiclMap = Object.fromEntries(ingredients.map(i => [i.HICL_SEQNO, (i.GNN60 || i.GNN || '').trim()]));

  // Group ingredients with their label status
  const ingredientStatus = {};
  for (const gcn of gcns) {
    const name = hiclMap[gcn.HICL_SEQNO];
    if (!name) continue;
    const status = gcnLabeled[gcn.GCN_SEQNO] || 'off-label';
    if (!ingredientStatus[name] || status === 'labeled') {
      ingredientStatus[name] = status;
    }
  }

  // GCN → ETCs (therapeutic classes)
  const etcLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
    .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
  const etcIds = [...new Set(etcLinks.map(e => e.ETC_ID))];
  const etcs = await db.collection('RETCTBL0_ETC_ID')
    .find({ ETC_ID: { $in: etcIds }, ETC_RETIRED_IND: '0' }).toArray();

  return {
    indication_count: inds.length,
    gcn_count: gcnSeqnos.length,
    ingredients: Object.entries(ingredientStatus)
      .map(([name, status]) => ({ name, labeled: status }))
      .sort((a, b) => {
        if (a.labeled !== b.labeled) return a.labeled === 'labeled' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    therapeutic_classes: etcs
      .map(e => ({ etc_id: e.ETC_ID, name: e.ETC_NAME }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.search && !opts.dxid) {
    console.error('Usage: node reverse_indication.js <condition> [--dxid 1432] [--db ...] [--uri ...]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }
    const db = client.db(dbName);

    const result = { database: dbName };

    if (opts.dxid) {
      // Direct DXID lookup
      const dxDoc = await db.collection('RFMLDX0_DXID').findOne({ DXID: opts.dxid });
      if (!dxDoc) { result.found = false; result.dxid = opts.dxid; }
      else {
        const drugs = await getDrugsForDxid(db, opts.dxid);
        result.found = true;
        result.dxid = opts.dxid;
        result.condition = dxDoc.DXID_DESC100;
        Object.assign(result, drugs);
      }
    } else {
      // Text search
      const dxDocs = await findDxids(db, opts.search);
      result.search = opts.search;
      result.conditions_found = dxDocs.length;
      result.conditions = [];

      for (const dx of dxDocs) {
        const drugs = await getDrugsForDxid(db, dx.DXID);
        result.conditions.push({
          dxid: dx.DXID,
          condition: dx.DXID_DESC100,
          ...drugs
        });
      }
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
