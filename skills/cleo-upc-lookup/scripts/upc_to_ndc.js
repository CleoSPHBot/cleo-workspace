#!/usr/bin/env node
/**
 * UPC-to-NDC converter with fallback to UPC product database.
 *
 * Flow:
 *   1. Derive NDC candidates from UPC → look up in FDB
 *   2. If no FDB match, query upcitemdb.com API to identify the product
 *   3. If product identified, search FDB by drug name
 *
 * Usage:
 *   node upc_to_ndc.js <UPC> [--img-dir /tmp]
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');

// ── UPC → NDC Logic ─────────────────────────────────────────────────────────

function validateUPC(upc) {
  const clean = upc.replace(/[^0-9]/g, '');
  if (clean.length < 10 || clean.length > 13) {
    return { valid: false, error: `Invalid UPC length: ${clean.length} digits (expected 10-13)` };
  }
  return { valid: true, digits: clean };
}

/**
 * Convert UPC to candidate NDC-11 strings.
 */
function upcToNdcCandidates(upcDigits) {
  let raw10;

  if (upcDigits.length === 12) {
    raw10 = upcDigits.substring(1, 11);
  } else if (upcDigits.length === 13) {
    raw10 = upcDigits.substring(2, 12);
  } else if (upcDigits.length === 11) {
    return { raw10: upcDigits, candidates: [upcDigits] };
  } else if (upcDigits.length === 10) {
    raw10 = upcDigits;
  } else {
    return { raw10: upcDigits, candidates: [] };
  }

  // NDC-10 → NDC-11: insert a zero in one of three positions
  // The 10-digit NDC maps to 11 digits in three possible formats:
  //   4-4-2 → 5-4-2: insert 0 at position 0 (labeler gets leading zero)
  //   5-3-2 → 5-4-2: insert 0 at position 5 (product gets leading zero)
  //   5-4-1 → 5-4-2: insert 0 at position 9 (package gets leading zero)
  const candidates = [
    '0' + raw10,                                          // 0 + 4009310134 = 04009310134
    raw10.substring(0, 5) + '0' + raw10.substring(5),    // 40093 + 0 + 10134 = 40093010134
    raw10.substring(0, 9) + '0' + raw10.substring(9),    // 400931013 + 0 + 4 = 40093101304
  ];

  return { raw10, candidates };
}

function formatNdc11(ndc11) {
  return ndc11.substring(0, 5) + '-' + ndc11.substring(5, 9) + '-' + ndc11.substring(9, 11);
}

// ── UPC Database API (upcitemdb.com) ────────────────────────────────────────

function lookupUpcDatabase(upc) {
  return new Promise((resolve, reject) => {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`;
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.code === 'OK' && json.items && json.items.length > 0) {
            const item = json.items[0];
            resolve({
              found: true,
              title: item.title || '',
              description: item.description || '',
              brand: item.brand || '',
              category: item.category || '',
              upc: item.upc || upc,
              ean: item.ean || ''
            });
          } else {
            resolve({ found: false });
          }
        } catch (e) {
          resolve({ found: false, error: e.message });
        }
      });
      res.on('error', (e) => resolve({ found: false, error: e.message }));
    }).on('error', (e) => resolve({ found: false, error: e.message }));
  });
}

// ── FDB Drug Search ─────────────────────────────────────────────────────────

function searchFdbByName(drugName) {
  try {
    const drugSearchScript = path.resolve(__dirname, '../../cleo-drug-search/scripts/drug_search.js');
    const output = execSync(`node "${drugSearchScript}" "${drugName}"`, {
      timeout: 15000,
      encoding: 'utf-8',
      env: { ...process.env }
    });
    return JSON.parse(output);
  } catch (e) {
    return { found: false, error: e.message };
  }
}

/**
 * Extract plausible drug name(s) from a product title.
 * Returns an array of candidates to try, most specific first.
 * e.g. "Nature's Truth Iron Supplement Tablets, 65 mg, 120 Count" → ["ferrous sulfate", "iron"]
 * e.g. "Claritin 24 Hour Non-Drowsy Allergy" → ["claritin", "loratadine"]
 */
function extractDrugNames(title, description) {
  const candidates = [];
  const text = (title + ' ' + (description || '')).toLowerCase();
  
  // Known brand → generic mappings for common OTC drugs
  const otcMap = {
    'claritin': 'loratadine', 'zyrtec': 'cetirizine', 'allegra': 'fexofenadine',
    'tylenol': 'acetaminophen', 'advil': 'ibuprofen', 'motrin': 'ibuprofen',
    'aleve': 'naproxen', 'benadryl': 'diphenhydramine', 'pepcid': 'famotidine',
    'prilosec': 'omeprazole', 'nexium': 'esomeprazole', 'zantac': 'ranitidine',
    'mucinex': 'guaifenesin', 'robitussin': 'dextromethorphan', 'tums': 'calcium carbonate',
    'miralax': 'polyethylene glycol', 'imodium': 'loperamide', 'pepto': 'bismuth subsalicylate',
    'flonase': 'fluticasone', 'sudafed': 'pseudoephedrine', 'dulcolax': 'bisacodyl'
  };

  // Check for known brands in title
  for (const [brand, generic] of Object.entries(otcMap)) {
    if (text.includes(brand)) {
      candidates.push(generic);
      candidates.push(brand);
    }
  }

  // Look for active ingredient patterns in description — these go FIRST (most specific)
  // e.g. "Ferrous sulfate 325 mg" or "Loratadine 10 mg"
  const ingredientCandidates = [];
  const ingredientPattern = /([a-z][a-z\s-]+?)\s+\d+\s*mg/gi;
  let match;
  while ((match = ingredientPattern.exec(text)) !== null) {
    const ingredient = match[1].trim().toLowerCase();
    // Skip noise words
    if (!/^(with|and|of|per|each|contains?|provides?|equivalent|about|approx|liquid|dried|which)/i.test(ingredient)) {
      if (ingredient.length > 3 && ingredient.length < 40) {
        ingredientCandidates.push(ingredient);
      }
    }
  }
  // Put multi-word ingredients first (more specific), then single-word
  ingredientCandidates.sort((a, b) => b.split(' ').length - a.split(' ').length);
  candidates.push(...ingredientCandidates);

  // Strip brand names and common words from title to find drug name
  const brandWords = /\b(nature'?s?\s*truth|kirkland|equate|up\s*&?\s*up|cvs|walgreens|rite\s*aid|target|walmart|amazon|basic|basics?|spring\s*valley|member'?s?\s*mark|good\s*neighbor|sundown)\b/gi;
  const stopWords = /\b(supplement|tablets?|capsules?|caplets?|softgels?|gummies?|liquid|chewable|coated|count|hour|hours?|non-drowsy|allergy|relief|extra|strength|original|maximum|mg|ml|oz|ct|pk|pack|bottle|box)\b/gi;
  const cleaned = title.replace(brandWords, '').replace(stopWords, '').replace(/[,\d]+/g, '').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    candidates.push(words[0].toLowerCase());
  }

  // Deduplicate
  return [...new Set(candidates)];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const upcArg = args.find(a => !a.startsWith('--'));
  if (!upcArg) {
    console.error('Usage: node upc_to_ndc.js <UPC> [--img-dir /tmp]');
    process.exit(1);
  }

  const imgDirIdx = args.indexOf('--img-dir');
  const imgDir = imgDirIdx !== -1 ? args[imgDirIdx + 1] : null;

  const { valid, error, digits } = validateUPC(upcArg);
  if (!valid) {
    console.log(JSON.stringify({ upc: upcArg, error, found: false }, null, 2));
    return;
  }

  const { raw10, candidates } = upcToNdcCandidates(digits);

  // ── Step 1: Try direct UPC→NDC conversion against FDB ──
  if (candidates.length > 0) {
    const ndcLookupScript = path.resolve(__dirname, '../../cleo-ndc-lookup/scripts/ndc_lookup.js');

    for (const ndc11 of candidates) {
      try {
        const cmd = imgDir
          ? `node "${ndcLookupScript}" "${ndc11}" --img-dir "${imgDir}"`
          : `node "${ndcLookupScript}" "${ndc11}"`;

        const output = execSync(cmd, { timeout: 15000, encoding: 'utf-8', env: { ...process.env } });
        const result = JSON.parse(output);

        if (result.found) {
          console.log(JSON.stringify({
            upc: upcArg,
            raw10,
            method: 'direct_ndc_conversion',
            confidence: 'high',
            ndc_candidates: candidates.map(formatNdc11),
            matched_ndc: formatNdc11(ndc11),
            ...result
          }, null, 2));
          return;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // ── Step 2: Query UPC product database ──
  const upcResult = await lookupUpcDatabase(digits.length === 12 ? digits : upcArg);

  if (!upcResult.found) {
    console.log(JSON.stringify({
      upc: upcArg,
      raw10,
      ndc_candidates: candidates.map(formatNdc11),
      found: false,
      upc_database: { found: false },
      message: `No FDB match via NDC conversion, and UPC not found in product database.`
    }, null, 2));
    return;
  }

  // ── Step 3: Try to find the drug in FDB by name ──
  const drugNames = extractDrugNames(upcResult.title, upcResult.description);
  let fdbMatch = null;
  let matchedDrugName = null;

  for (const drugName of drugNames) {
    const searchResult = searchFdbByName(drugName);
    if (searchResult.found && searchResult.groups && searchResult.groups.length > 0) {
      fdbMatch = searchResult;
      matchedDrugName = drugName;
      break;
    }
  }

  console.log(JSON.stringify({
    upc: upcArg,
    raw10,
    method: 'upc_database_fallback',
    confidence: fdbMatch ? 'medium' : 'low',
    ndc_candidates: candidates.map(formatNdc11),
    ndc_match: false,
    found: true,
    product: {
      title: upcResult.title,
      brand: upcResult.brand,
      category: upcResult.category,
      description: upcResult.description ? upcResult.description.substring(0, 300) : ''
    },
    fdb_search: fdbMatch ? {
      search_term: matchedDrugName,
      candidates_tried: drugNames,
      found: true,
      groups: fdbMatch.groups.map(g => ({
        med_name: g.med_name,
        routed_med_description: g.routed_med_description,
        products: (g.products || []).slice(0, 5).map(p => ({
          medid: p.medid,
          description: p.description,
          strength: p.strength + ' ' + (p.strength_uom || '')
        }))
      }))
    } : {
      search_term: drugNames[0] || null,
      candidates_tried: drugNames,
      found: false
    },
    message: fdbMatch
      ? `UPC identifies "${upcResult.title}". Found matching drugs in FDB via "${matchedDrugName}" search.`
      : `UPC identifies "${upcResult.title}" but no direct FDB match found. The printed NDC on the package would give exact clinical data.`
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
