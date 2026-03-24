#!/usr/bin/env node
// CPT/HCPCS Lookup Script for Cleo
// Usage: node cpt_lookup.js <CODE> [--uri mongodb+srv://...]
//
// Looks up CPT-4 codes in sph_focus and enriches with HEDIS value set memberships.
// Also supports HCPCS Level II codes (e.g., G0438, J1234).

const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.FDB_MONGO_URI || 'mongodb+srv://dev:op5JjR0FssAxf0g1@dev-fdb-01.qpkxl.mongodb.net/';

function parseArgs(args) {
  const opts = { code: null, uri: DEFAULT_URI };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--uri' && args[i + 1]) { opts.uri = args[++i]; }
    else if (!args[i].startsWith('-')) { opts.code = args[i]; }
  }
  return opts;
}

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

async function lookupCPT(client, code) {
  const focus = client.db('sph_focus');
  const hedis = client.db('hedis_2025_valuesets');
  const result = { code, found: false };

  // 1. CPT Consolidated Code List (primary descriptions)
  const cptDoc = await focus.collection('CptConsolidatedCodeList').findOne({ Code: code });

  // 2. If not in CPT, try HCPCS (multiple sources with different field casing)
  let hcpcDoc = null;
  if (!cptDoc) {
    // Try HCPC2025 (latest, uppercase fields) first, then CMS_HCPC_MASTER (lowercase fields)
    hcpcDoc = await focus.collection('HCPC2025_APR_ANWEB').findOne({ HCPC: code });
    if (!hcpcDoc) {
      const legacyDoc = await focus.collection('CMS_HCPC_MASTER').findOne({ hcpc: code });
      if (legacyDoc) {
        // Normalize legacy format to match newer format
        hcpcDoc = {
          HCPC: legacyDoc.hcpc,
          'LONG DESCRIPTION': legacyDoc.longDesc,
          'SHORT DESCRIPTION': legacyDoc.shortDesc,
          BETOS: legacyDoc.BETOS
        };
      }
    }
  }

  if (!cptDoc && !hcpcDoc) return result;

  result.found = true;

  if (cptDoc) {
    result.source = 'CPT-4';
    result.concept_id = cptDoc.ConceptID;
    result.description = {
      long: cptDoc.Long || '',
      medium: cptDoc.Medium || '',
      short: cptDoc.Short || '',
      consumer: cptDoc.Consumer || '',
      spanish_consumer: cptDoc['Spanish Consumer'] || ''
    };
    result.effective_date = cptDoc['Current Descriptor Effective Date'] || null;

    // 3. Clinician Descriptors
    const clinDescs = await focus.collection('CptClinicianDescriptor')
      .find({ 'CPT Code': code }).toArray();
    if (clinDescs.length > 0) {
      result.clinician_descriptors = clinDescs.map(d => d['Clinician Descriptor']);
    }
  } else if (hcpcDoc) {
    result.source = 'HCPCS Level II';
    result.description = {
      long: hcpcDoc['LONG DESCRIPTION'] || hcpcDoc['SHORT DESCRIPTION'] || '',
      short: hcpcDoc['SHORT DESCRIPTION'] || ''
    };
    if (hcpcDoc.BETOS && hcpcDoc.BETOS !== hcpcDoc.BETOS) {} // skip NaN
    const betos = hcpcDoc.BETOS;
    if (betos && typeof betos === 'string') result.betos = betos;
    const tos = hcpcDoc.TOS1;
    if (tos && typeof tos === 'string') result.type_of_service = tos;
  }

  // 4. HEDIS Value Set memberships
  const vsCodes = await hedis.collection('Value Sets to Codes')
    .find({ Code: code, 'Code System': { $in: ['CPT', 'HCPCS', 'CPT-CAT-II'] } })
    .toArray();

  if (vsCodes.length > 0) {
    const valueSetNames = [...new Set(vsCodes.map(v => v['Value Set Name']))].sort();
    const valueSetOids = [...new Set(vsCodes.map(v => v['Value Set OID']))];
    result.hedis_value_sets = valueSetNames;

    // 5. HEDIS Measures linked to these value sets
    const measures = await hedis.collection('Measures to Value Sets')
      .find({ 'Value Set OID': { $in: valueSetOids } })
      .toArray();

    if (measures.length > 0) {
      result.hedis_measures = [...new Set(
        measures.map(m => m['Measure Name']).filter(Boolean)
      )].sort();
    }
  }

  return result;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.code) {
    console.error('Usage: node cpt_lookup.js <CPT-CODE> [--uri mongodb+srv://...]');
    process.exit(1);
  }

  const code = normalizeCode(opts.code);
  const client = new MongoClient(opts.uri);

  try {
    await client.connect();
    const result = await lookupCPT(client, code);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
