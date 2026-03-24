#!/usr/bin/env node
// ICD-10 Lookup Script for Cleo
// Usage: node icd_lookup.js <ICD-CODE> [--db fdb_20260305] [--uri mongodb+srv://...]
//
// Accepts ICD-10-CM codes with or without dots: C50.911, C50911
// Returns: description, code hierarchy, related diagnoses (DXIDs), and indicated drugs.

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { code: null, db: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) { opts.db = args[++i]; }
    else if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (!args[i].startsWith('-')) { opts.code = args[i]; }
  }
  return opts;
}

function normalizeICD(code) {
  // Ensure dot is in the right place for ICD-10-CM (after 3rd char)
  const clean = code.replace(/[\s.]/g, '').toUpperCase();
  if (clean.length > 3) {
    return clean.slice(0, 3) + '.' + clean.slice(3);
  }
  return clean;
}

function buildHierarchy(code) {
  // ICD-10-CM hierarchy: e.g. C50 → C50.9 → C50.91 → C50.911
  const parts = [];
  const clean = code.replace('.', '');
  for (let i = 3; i <= clean.length; i++) {
    const sub = clean.slice(0, i);
    parts.push(i > 3 ? sub.slice(0, 3) + '.' + sub.slice(3) : sub);
  }
  return parts;
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

async function lookupICD(db, code) {
  const result = { code, found: false };

  // 1. ICD Description
  const icdDesc = await db.collection('RFMLINM1_ICD_DESC').findOne({ ICD_CD: code });
  if (!icdDesc) return result;

  result.found = true;
  result.description = icdDesc.ICD_DESC;
  result.status = icdDesc.ICD_STATUS_CD === '0' ? 'active' : 'inactive';
  result.first_date = icdDesc.ICD_FIRST_DT;

  // Code type
  const codeType = await db.collection('RFMLITD1_ICD_CD_TYPE_DESC').findOne({ ICD_CD_TYPE: icdDesc.ICD_CD_TYPE });
  result.code_type = codeType?.ICD_CD_TYPE_DESC || icdDesc.ICD_CD_TYPE;

  // 2. Hierarchy — walk up the code tree
  const hierarchyCodes = buildHierarchy(code);
  result.hierarchy = [];
  for (const hCode of hierarchyCodes) {
    const hDesc = await db.collection('RFMLINM1_ICD_DESC').findOne({ ICD_CD: hCode });
    if (hDesc) {
      result.hierarchy.push({
        code: hCode,
        description: hDesc.ICD_DESC
      });
    }
  }

  // 3. Related DXIDs via ICD Search
  const icdSearchResults = await db.collection('RFMLISR1_ICD_SEARCH')
    .find({ SEARCH_ICD_CD: code })
    .toArray();

  if (icdSearchResults.length > 0) {
    const dxIds = [...new Set(icdSearchResults.map(r => r.RELATED_DXID))];
    const dxDescs = await db.collection('RFMLDX0_DXID')
      .find({ DXID: { $in: dxIds } })
      .toArray();

    const dxMap = Object.fromEntries(dxDescs.map(d => [d.DXID, d]));

    // Clinical module codes: 01=Indications, 02=Side Effects, 03=Contraindications
    result.related_diagnoses = dxIds.map(dxId => {
      const dx = dxMap[dxId];
      const modules = icdSearchResults
        .filter(r => r.RELATED_DXID === dxId)
        .map(r => {
          const moduleNames = { '01': 'indications', '02': 'side-effects', '03': 'contraindications',
                                '04': 'dosage', '05': 'order-entry', '06': 'neonatal-dosage' };
          return moduleNames[r.FML_CLIN_CODE] || r.FML_CLIN_CODE;
        });
      return {
        dxid: dxId,
        description: dx?.DXID_DESC100 || 'Unknown',
        clinical_modules: [...new Set(modules)]
      };
    }).sort((a, b) => a.description.localeCompare(b.description));

    // 4. Indicated drugs — from DXIDs linked to indications module
    const indicationDxIds = icdSearchResults
      .filter(r => r.FML_CLIN_CODE === '01')
      .map(r => r.RELATED_DXID);
    const uniqueIndDxIds = [...new Set(indicationDxIds)];

    if (uniqueIndDxIds.length > 0) {
      const indications = await db.collection('RINDMMA2_INDCTS_MSTR')
        .find({ DXID: { $in: uniqueIndDxIds } })
        .toArray();

      if (indications.length > 0) {
        const indIds = [...new Set(indications.map(i => i.INDCTS))];
        const drugs = await db.collection('RINDMDD0_INDCTS_DRUG_DESC')
          .find({ INDCTS: { $in: indIds } })
          .toArray();

        result.indicated_drugs = [...new Set(drugs.map(d => d.INDCTS_DRUG_DESC))].sort();
      }
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.code) {
    console.error('Usage: node icd_lookup.js <ICD-CODE> [--db fdb_YYYYMMDD] [--uri mongodb+srv://...]');
    process.exit(1);
  }

  const code = normalizeICD(opts.code);
  const client = new MongoClient(opts.uri);

  try {
    await client.connect();
    const dbName = opts.db || await getLatestFdbDb(client);
    if (!dbName) { console.error('No FDB database found'); process.exit(1); }

    const db = client.db(dbName);
    const result = await lookupICD(db, code);
    result.database = dbName;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
