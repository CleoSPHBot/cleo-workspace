#!/usr/bin/env node
// Side Effects & Contraindications Lookup for Cleo
// Usage: node side_effects.js <MEDID|GCN_SEQNO> [--by-gcn] [--db fdb_YYYYMMDD] [--uri ...]
//
// Returns side effects (RSIDE*) and contraindications (RDDCM*) for a drug.

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

const FREQ_MAP = { '1': 'rare', '2': 'infrequent', '3': 'frequent' };
const SEV_MAP = { '1': 'minor', '2': 'moderate', '3': 'major' };
const CONTRA_SL_MAP = { '1': 'severe', '2': 'moderate', '3': 'mild' };

function parseArgs(args) {
  const opts = { id: null, byGcn: false, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--by-gcn') { opts.byGcn = true; }
    else if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (!args[i].startsWith('-')) { opts.id = parseInt(args[i], 10); }
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

async function lookup(db, id, byGcn) {
  let gcnSeqno, drugDesc;

  if (byGcn) {
    gcnSeqno = id;
    const gcn = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR').findOne({ GCN_SEQNO: id });
    if (!gcn) return { id, by: 'gcn', found: false };
    const hicl = await db.collection('RHICLSQ1_HICLSEQNO_MSTR').findOne({ HICL_SEQNO: gcn.HICL_SEQNO });
    drugDesc = (hicl?.GNN60 || hicl?.GNN || '').trim() + ' ' + (gcn.STR60 || gcn.STR || '').trim();
  } else {
    const med = await db.collection('RMIID1_MED').findOne({ MEDID: id });
    if (!med) return { id, by: 'medid', found: false };
    gcnSeqno = med.GCN_SEQNO;
    drugDesc = med.MED_MEDID_DESC?.trim();
  }

  const result = {
    id,
    by: byGcn ? 'gcn' : 'medid',
    found: true,
    drug: drugDesc,
    gcn_seqno: gcnSeqno
  };

  // --- Side Effects ---
  const seLinks = await db.collection('RSIDEGC0_GCNSEQNO_LINK')
    .find({ GCN_SEQNO: gcnSeqno }).toArray();
  const sideIds = seLinks.map(l => l.SIDE);

  if (sideIds.length > 0) {
    const sides = await db.collection('RSIDEMA3_MSTR')
      .find({ SIDE: { $in: sideIds } }).toArray();

    // Get DXID descriptions
    const dxIds = [...new Set(sides.map(s => s.DXID))];
    const dxDescs = await db.collection('RFMLDX0_DXID')
      .find({ DXID: { $in: dxIds } }).toArray();
    const dxMap = Object.fromEntries(dxDescs.map(d => [d.DXID, d.DXID_DESC100]));

    // Drug description for side effects
    const seDD = await db.collection('RSIDEDD0_DRUG_DESC')
      .findOne({ SIDE: { $in: sideIds } });
    if (seDD) result.side_effect_drug_desc = seDD.SIDE_DRUG_DESC;

    result.side_effects = sides.map(s => ({
      dxid: s.DXID,
      effect: dxMap[s.DXID] || 'Unknown',
      frequency: FREQ_MAP[s.SIDE_FREQ] || null,
      severity: SEV_MAP[s.SIDE_SEV] || null,
      labeled: s.SIDE_LABCD === '1'
    })).sort((a, b) => {
      // Sort: major first, then moderate, then minor; within severity: frequent first
      const sevOrder = { 'major': 0, 'moderate': 1, 'minor': 2 };
      const freqOrder = { 'frequent': 0, 'infrequent': 1, 'rare': 2 };
      const sa = sevOrder[a.severity] ?? 3;
      const sb = sevOrder[b.severity] ?? 3;
      if (sa !== sb) return sa - sb;
      const fa = freqOrder[a.frequency] ?? 3;
      const fb = freqOrder[b.frequency] ?? 3;
      return fa - fb;
    });

    result.side_effect_count = result.side_effects.length;
  } else {
    result.side_effects = [];
    result.side_effect_count = 0;
  }

  // --- Contraindications ---
  const cLinks = await db.collection('RDDCMGC0_CONTRA_GCNSEQNO_LINK')
    .find({ GCN_SEQNO: gcnSeqno }).toArray();
  const cIds = cLinks.map(l => l.DDXCN);

  if (cIds.length > 0) {
    const contras = await db.collection('RDDCMMA1_CONTRA_MSTR')
      .find({ DDXCN: { $in: cIds } }).toArray();

    const cdxIds = [...new Set(contras.map(c => c.DXID))];
    const cdxDescs = await db.collection('RFMLDX0_DXID')
      .find({ DXID: { $in: cdxIds } }).toArray();
    const cdxMap = Object.fromEntries(cdxDescs.map(d => [d.DXID, d.DXID_DESC100]));

    // Drug description for contraindications
    const cDD = await db.collection('RDDCMDD0_CONTRA_DRUG_DESC')
      .findOne({ DDXCN: { $in: cIds } });
    if (cDD) result.contraindication_drug_desc = cDD.DDXCN_DRUG_DESC;

    result.contraindications = contras.map(c => ({
      dxid: c.DXID,
      condition: cdxMap[c.DXID] || 'Unknown',
      severity: CONTRA_SL_MAP[c.DDXCN_SL] || null,
      reference: c.DDXCN_REF || null
    })).sort((a, b) => {
      const sevOrder = { 'severe': 0, 'moderate': 1, 'mild': 2 };
      const sa = sevOrder[a.severity] ?? 3;
      const sb = sevOrder[b.severity] ?? 3;
      return sa - sb;
    });

    result.contraindication_count = result.contraindications.length;
  } else {
    result.contraindications = [];
    result.contraindication_count = 0;
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.id && opts.id !== 0) {
    console.error('Usage: node side_effects.js <MEDID> [--by-gcn] [--db ...] [--uri ...]');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }
    const db = client.db(dbName);

    const result = await lookup(db, opts.id, opts.byGcn);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
