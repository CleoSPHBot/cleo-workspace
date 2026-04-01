#!/usr/bin/env node
// Drug-Drug Interaction (DDI) Checker for Cleo
// Usage: node ddi_check.js "drug1" "drug2" [...more drugs]
//        node ddi_check.js --medids 283712 304570
//        node ddi_check.js --gcns 29967 45890
//
// Checks for FDB interactions between 2+ drugs.
// Supports: drug name search, MEDID, or GCN_SEQNO input.

const { MongoClient } = require('mongodb');

const DDI_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';
const DDI_DB  = 'fdb_20260326';  // Latest DB with full DDI data
const MED_DB  = 'fdb_ok_20250925'; // DB with MEDID/NDC/name data

const SEVERITY_LABELS = {
  '1': '🔴 CONTRAINDICATED',
  '2': '🟠 SEVERE',
  '3': '🟡 MODERATE',
  '9': '🔵 UNDETERMINED / ALT THERAPY'
};

const DISPLAY_ACTION_LABELS = {
  1: 'Halt',
  2: 'Interrupt',
  3: 'Informative',
  4: 'Surveillance',
  5: 'Suppress'
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { mode: 'name', inputs: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--medids') { opts.mode = 'medid'; }
    else if (args[i] === '--gcns') { opts.mode = 'gcn'; }
    else { opts.inputs.push(args[i]); }
  }
  return opts;
}

async function getLatestDdiDb(client) {
  const admin = client.db('admin');
  const { databases } = await admin.command({ listDatabases: 1, nameOnly: true });
  const dbs = databases
    .map(d => d.name)
    .filter(n => /^fdb_\d{8}$/.test(n))
    .sort();
  return dbs[dbs.length - 1] || DDI_DB;
}

async function resolveNameToGcns(db_fdb_ok, db_ddi, name) {
  // Search for the drug name in RHICLSQ1 (ingredient level)
  const hiclResults = await db_ddi.collection('RHICLSQ1_HICLSEQNO_MSTR').find({
    $or: [
      { GNN: new RegExp(name, 'i') },
      { GNN60: new RegExp(name, 'i') }
    ]
  }).toArray();

  if (hiclResults.length === 0) {
    // Fallback: search fdb_ok RMEDST0 for drug name (MEDID-based)
    const searchResults = await db_fdb_ok.collection('RMEDST0_MEDID_SEARCH_TERM').find({
      SRCHTXT: new RegExp(name, 'i')
    }).limit(5).toArray();
    if (searchResults.length === 0) return { name, gcns: [], hicl_seqno: null, resolvedName: null, error: `No match found for "${name}"` };
    // Get GCNs from MEDID
    const medids = [...new Set(searchResults.map(r => r.MEDID).filter(Boolean))];
    const gcnLinks = await db_fdb_ok.collection('RMIGC1_MEDID_GCNSEQNO_LINK')
      .find({ MEDID: { $in: medids } }).toArray();
    const gcns = [...new Set(gcnLinks.map(r => r.GCN_SEQNO))];
    return { name, gcns, hicl_seqno: null, resolvedName: searchResults[0].SRCHTXT };
  }

  // Use first match, collect all GCN_SEQNOs for this HICL
  const hicl = hiclResults[0];
  const gcnDocs = await db_ddi.collection('RGCNSEQ4_GCNSEQNO_MSTR')
    .find({ HICL_SEQNO: hicl.HICL_SEQNO })
    .toArray();
  const gcns = gcnDocs.map(g => g.GCN_SEQNO);
  return { name, gcns, hicl_seqno: hicl.HICL_SEQNO, resolvedName: hicl.GNN60 || hicl.GNN };
}

async function resolveMedidToGcns(db_fdb_ok, medid) {
  const m = parseInt(medid, 10);
  const links = await db_fdb_ok.collection('RMIGC1_MEDID_GCNSEQNO_LINK').find({ MEDID: m }).toArray();
  // Get drug name
  const medDoc = await db_fdb_ok.collection('RMIID1_MED').findOne({ MEDID: m });
  const name = medDoc?.MED_NAMTXT || `MEDID ${m}`;
  const gcns = links.map(l => l.GCN_SEQNO);
  return { name, gcns, resolvedName: name };
}

async function getDdiCodexesForGcns(db_ddi, gcns) {
  if (gcns.length === 0) return new Set();
  const links = await db_ddi.collection('RADIMGC4_GCNSEQNO_LINK')
    .find({ GCN_SEQNO: { $in: gcns } })
    .toArray();
  return new Set(links.map(l => l.DDI_CODEX));
}

async function getMonographText(db_ddi, ddiMonox) {
  const lines = await db_ddi.collection('RADIMMO5_MONO')
    .find({ DDI_MONOX: ddiMonox })
    .sort({ ADI_MONOSN: 1 })
    .toArray();
  return lines.map(l => l.IAMTEXTN).join('\n').trim();
}

async function run() {
  const opts = parseArgs(process.argv);

  if (opts.inputs.length < 2) {
    console.error('Usage: node ddi_check.js "drug1" "drug2" [..."drugN"]');
    console.error('       node ddi_check.js --medids MEDID1 MEDID2');
    console.error('       node ddi_check.js --gcns GCN1 GCN2');
    process.exit(1);
  }

  const client = new MongoClient(DDI_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();

  const latestDdi = await getLatestDdiDb(client);
  const db_ddi = client.db(latestDdi);
  const db_fdb_ok = client.db(MED_DB);

  // Resolve each drug to GCN_SEQNOs and DDI_CODEXes
  const drugs = [];
  for (const input of opts.inputs) {
    let resolved;
    if (opts.mode === 'gcn') {
      const gcn = parseInt(input, 10);
      resolved = { name: `GCN ${gcn}`, gcns: [gcn], resolvedName: `GCN ${gcn}` };
    } else if (opts.mode === 'medid') {
      resolved = await resolveMedidToGcns(db_fdb_ok, input);
    } else {
      resolved = await resolveNameToGcns(db_fdb_ok, db_ddi, input);
    }
    resolved.codexes = await getDdiCodexesForGcns(db_ddi, resolved.gcns);
    drugs.push(resolved);
  }

  // Find interactions between each pair
  const interactions = [];
  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const a = drugs[i];
      const b = drugs[j];

      if (a.error || b.error) continue;
      if (a.codexes.size === 0 || b.codexes.size === 0) continue;

      // Find monographs where SIDE_A is in drug A's codexes AND SIDE_B is in drug B's codexes (or vice versa)
      const monographs = await db_ddi.collection('RADIMM0_MONOX_MSTR').find({
        $or: [
          { SIDE_A_DDI_CODEX: { $in: [...a.codexes] }, SIDE_B_DDI_CODEX: { $in: [...b.codexes] } },
          { SIDE_A_DDI_CODEX: { $in: [...b.codexes] }, SIDE_B_DDI_CODEX: { $in: [...a.codexes] } }
        ]
      }).toArray();

      for (const mono of monographs) {
        const text = await getMonographText(db_ddi, mono.DDI_MONOX);
        interactions.push({
          pair: [a.resolvedName || a.name, b.resolvedName || b.name],
          monox: mono.DDI_MONOX,
          title: mono.MONOX_TITLE,
          severity: mono.DDI_SL,
          severityLabel: SEVERITY_LABELS[mono.DDI_SL] || `Severity ${mono.DDI_SL}`,
          displayAction: DISPLAY_ACTION_LABELS[mono.DDI_DISPLAY_ACTION_ID] || mono.DDI_DISPLAY_ACTION_ID,
          pharmacodynamic: mono.DDI_PHARMACODYNAMIC_IND === '1',
          pharmacokinetic: mono.DDI_PHARMACOKINETIC_IND === '1',
          text
        });
      }
    }
  }

  // Output results
  const result = {
    ddiDatabase: latestDdi,
    drugs: drugs.map(d => ({
      input: d.name,
      resolved: d.resolvedName || d.name,
      gcnCount: d.gcns?.length || 0,
      codexCount: d.codexes?.size || 0,
      error: d.error || null
    })),
    interactionCount: interactions.length,
    interactions: interactions.sort((a, b) => {
      // Sort by severity: 1 > 2 > 3 > 9
      const order = { '1': 0, '2': 1, '3': 2, '9': 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
  };

  console.log(JSON.stringify(result, null, 2));
  await client.close();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
