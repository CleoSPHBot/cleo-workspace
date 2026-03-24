#!/usr/bin/env node
// ETC (Enhanced Therapeutic Classification) Lookup for Cleo
// Usage:
//   node etc_lookup.js --search "statin"           # name search
//   node etc_lookup.js --id 2747                    # drill into a class
//   node etc_lookup.js --browse                     # top-level categories
//   node etc_lookup.js --browse --parent 2553       # children of a class
//   node etc_lookup.js --id 2747 --drugs            # list drugs in a leaf class

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { mode: null, search: null, id: null, parent: null, drugs: false, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--search' && args[i + 1]) { opts.mode = 'search'; opts.search = args[++i]; }
    else if (args[i] === '--id' && args[i + 1]) { opts.mode = 'id'; opts.id = parseInt(args[++i], 10); }
    else if (args[i] === '--browse') { opts.mode = 'browse'; }
    else if (args[i] === '--parent' && args[i + 1]) { opts.parent = parseInt(args[++i], 10); }
    else if (args[i] === '--drugs') { opts.drugs = true; }
    else if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
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

function buildBreadcrumb(db, etcId) {
  const path = [];
  let current = etcId;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = db.collection('RETCTBL0_ETC_ID').findOne({ ETC_ID: current });
    if (!node) break;
    path.unshift({ etc_id: node.ETC_ID, name: node.ETC_NAME });
    current = node.ETC_PARENT_ETC_ID;
  }
  return path;
}

// Workaround: mongosh findOne is sync but driver is async
async function buildBreadcrumbAsync(col, etcId) {
  const path = [];
  let current = etcId;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const node = await col.findOne({ ETC_ID: current });
    if (!node) break;
    path.unshift({ etc_id: node.ETC_ID, name: node.ETC_NAME });
    current = node.ETC_PARENT_ETC_ID;
  }
  return path;
}

async function searchEtc(db, query) {
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const matches = await db.collection('RETCTBL0_ETC_ID')
    .find({ ETC_NAME: regex, ETC_RETIRED_IND: '0' })
    .sort({ ETC_HIERARCHY_LEVEL: 1, ETC_SORT_NUMBER: 1 })
    .toArray();

  const col = db.collection('RETCTBL0_ETC_ID');
  const results = [];
  for (const m of matches) {
    const breadcrumb = await buildBreadcrumbAsync(col, m.ETC_ID);
    const entry = {
      etc_id: m.ETC_ID,
      name: m.ETC_NAME,
      level: m.ETC_HIERARCHY_LEVEL,
      is_leaf: m.ETC_ULTIMATE_CHILD_IND === '1',
      parent_etc_id: m.ETC_PARENT_ETC_ID,
      breadcrumb: breadcrumb.map(b => b.name).join(' → ')
    };

    // If leaf, count GCNs and get ingredients
    if (entry.is_leaf) {
      const gcnLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
        .find({ ETC_ID: m.ETC_ID }).toArray();
      entry.gcn_count = gcnLinks.length;

      const medCount = await db.collection('RETCMED0_ETC_MEDID')
        .countDocuments({ ETC_ID: m.ETC_ID });
      entry.medid_count = medCount;

      // Get ingredients
      const gcnSeqnos = gcnLinks.map(g => g.GCN_SEQNO);
      if (gcnSeqnos.length > 0) {
        const gcns = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
          .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
        const hicls = [...new Set(gcns.map(g => g.HICL_SEQNO))];
        const ingredients = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
          .find({ HICL_SEQNO: { $in: hicls } }).toArray();
        entry.ingredients = ingredients.map(i => (i.GNN60 || i.GNN || '').trim()).filter(Boolean).sort();
      }
    } else {
      // Count children
      const childCount = await db.collection('RETCTBL0_ETC_ID')
        .countDocuments({ ETC_PARENT_ETC_ID: m.ETC_ID, ETC_RETIRED_IND: '0' });
      entry.child_count = childCount;
    }

    results.push(entry);
  }

  return { mode: 'search', query, result_count: results.length, results };
}

async function drillEtc(db, etcId, includeDrugs) {
  const etc = await db.collection('RETCTBL0_ETC_ID').findOne({ ETC_ID: etcId });
  if (!etc) return { mode: 'id', etc_id: etcId, found: false };

  const col = db.collection('RETCTBL0_ETC_ID');
  const breadcrumb = await buildBreadcrumbAsync(col, etcId);

  const result = {
    mode: 'id',
    found: true,
    etc_id: etc.ETC_ID,
    name: etc.ETC_NAME,
    level: etc.ETC_HIERARCHY_LEVEL,
    is_leaf: etc.ETC_ULTIMATE_CHILD_IND === '1',
    parent_etc_id: etc.ETC_PARENT_ETC_ID,
    ultimate_parent_etc_id: etc.ETC_ULTIMATE_PARENT_ETC_ID,
    retired: etc.ETC_RETIRED_IND === '1',
    breadcrumb: breadcrumb.map(b => b.name).join(' → ')
  };

  if (etc.ETC_ULTIMATE_CHILD_IND === '1') {
    // Leaf class — get drugs
    const gcnLinks = await db.collection('RETCGC0_ETC_GCNSEQNO')
      .find({ ETC_ID: etcId }).toArray();
    const gcnSeqnos = gcnLinks.map(g => g.GCN_SEQNO);
    result.gcn_count = gcnSeqnos.length;

    const medCount = await db.collection('RETCMED0_ETC_MEDID')
      .countDocuments({ ETC_ID: etcId });
    result.medid_count = medCount;

    // Ingredients
    if (gcnSeqnos.length > 0) {
      const gcns = await db.collection('RGCNSEQ4_GCNSEQNO_MSTR')
        .find({ GCN_SEQNO: { $in: gcnSeqnos } }).toArray();
      const hicls = [...new Set(gcns.map(g => g.HICL_SEQNO))];
      const ingredients = await db.collection('RHICLSQ1_HICLSEQNO_MSTR')
        .find({ HICL_SEQNO: { $in: hicls } }).toArray();
      result.ingredients = ingredients.map(i => (i.GNN60 || i.GNN || '').trim()).filter(Boolean).sort();

      // Strengths summary
      result.strengths = gcns.map(g => ({
        gcn_seqno: g.GCN_SEQNO,
        strength: (g.STR60 || g.STR || '').trim()
      })).sort((a, b) => a.strength.localeCompare(b.strength, undefined, { numeric: true }));
    }

    // Full drug list if requested
    if (includeDrugs) {
      const meds = await db.collection('RETCMED0_ETC_MEDID')
        .find({ ETC_ID: etcId }).toArray();
      const medIds = meds.map(m => m.MEDID);
      const medDocs = await db.collection('RMIID1_MED')
        .find({ MEDID: { $in: medIds } }).toArray();
      result.drugs = medDocs.map(m => ({
        medid: m.MEDID,
        description: m.MED_MEDID_DESC?.trim(),
        strength: m.MED_STRENGTH,
        strength_uom: m.MED_STRENGTH_UOM,
        gcn_seqno: m.GCN_SEQNO,
        status: m.MED_STATUS_CD === '0' ? 'active' : 'inactive'
      })).sort((a, b) => (a.description || '').localeCompare(b.description || ''));
    }
  } else {
    // Branch — get children
    const children = await db.collection('RETCTBL0_ETC_ID')
      .find({ ETC_PARENT_ETC_ID: etcId, ETC_RETIRED_IND: '0' })
      .sort({ ETC_PRESENTATION_SEQNO: 1 })
      .toArray();

    result.children = children.map(c => ({
      etc_id: c.ETC_ID,
      name: c.ETC_NAME,
      level: c.ETC_HIERARCHY_LEVEL,
      is_leaf: c.ETC_ULTIMATE_CHILD_IND === '1'
    }));
    result.child_count = children.length;
  }

  return result;
}

async function browseEtc(db, parentId) {
  const query = parentId
    ? { ETC_PARENT_ETC_ID: parentId, ETC_RETIRED_IND: '0' }
    : { ETC_HIERARCHY_LEVEL: 1, ETC_RETIRED_IND: '0' };

  const classes = await db.collection('RETCTBL0_ETC_ID')
    .find(query)
    .sort({ ETC_SORT_NUMBER: 1 })
    .toArray();

  const result = {
    mode: 'browse',
    parent_etc_id: parentId || null,
    count: classes.length,
    classes: classes.map(c => ({
      etc_id: c.ETC_ID,
      name: c.ETC_NAME,
      level: c.ETC_HIERARCHY_LEVEL,
      is_leaf: c.ETC_ULTIMATE_CHILD_IND === '1'
    }))
  };

  // If we have a parent, include its info
  if (parentId) {
    const parent = await db.collection('RETCTBL0_ETC_ID').findOne({ ETC_ID: parentId });
    if (parent) {
      result.parent_name = parent.ETC_NAME;
      const col = db.collection('RETCTBL0_ETC_ID');
      const breadcrumb = await buildBreadcrumbAsync(col, parentId);
      result.breadcrumb = breadcrumb.map(b => b.name).join(' → ');
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.mode) {
    console.error('Usage:');
    console.error('  node etc_lookup.js --search "statin"       # name search');
    console.error('  node etc_lookup.js --id 2747               # drill into a class');
    console.error('  node etc_lookup.js --id 2747 --drugs       # list drugs in leaf class');
    console.error('  node etc_lookup.js --browse                # top-level categories');
    console.error('  node etc_lookup.js --browse --parent 2553  # children of a class');
    process.exit(1);
  }

  const client = new MongoClient(opts.uri);
  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }

    const db = client.db(dbName);
    let result;

    switch (opts.mode) {
      case 'search':
        result = await searchEtc(db, opts.search);
        break;
      case 'id':
        result = await drillEtc(db, opts.id, opts.drugs);
        break;
      case 'browse':
        result = await browseEtc(db, opts.parent);
        break;
    }

    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
