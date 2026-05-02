#!/usr/bin/env node
/**
 * proxy_score.js
 * --------------------------------
 * Build a Visible-derived "proxy feeling score" so we can label days
 * where Hannah didn't do a check-in.
 *
 * Approach:
 *   1. Define a candidate proxy formula using Visible signals
 *   2. Validate against the 7 days where we have BOTH check-in + Visible
 *   3. Tune weights to maximize agreement
 *   4. Apply to all 177 Visible days
 *
 * Visible signals we use:
 *   - Stability Score (1-5)         : higher = better
 *   - PacePoints (raw)              : higher = more capacity (with Adderall caveat)
 *   - Crash flag (0/1)              : 1 = crash day = bad
 *   - Fatigue, Brain Fog, Headache  : severity 1-3
 *   - Major symptoms count
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');

const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const USER_IDS = ['hannah', 6729032];

function feelingScore(f) {
  if (f === 'good')  return 2;
  if (f === 'mixed') return 1;
  if (f === 'bad')   return 0;
  return null;
}

// Candidate proxy formula — Stability Score anchored
// Visible's Stability Score (1-5) is already Hannah's self-rated daily stability.
function proxyFromVisible(obs) {
  if (!obs) return null;
  const get = name => obs.find(o => o.tracker_name === name)?.value;

  const stability   = get('Stability Score'); // 1-5
  const crash       = get('Crash') === 1;
  const fatigue     = get('Fatigue') || 0;
  const brain_fog   = get('Brain Fog') || 0;
  const headache    = get('Headache') || 0;
  const lightheaded = get('Lightheadedness') || 0;

  if (stability == null) return null;

  // Crash overrides to bad
  if (crash) return 0;

  // Stability 1→0.0, 2→0.5, 3→1.0, 4→1.5, 5→2.0
  let score = (stability - 1) * 0.5;

  // Severe symptom adjustments
  if (fatigue === 3 || brain_fog === 3) score -= 0.4;
  const severeCount = [fatigue, brain_fog, headache, lightheaded].filter(v => v === 3).length;
  if (severeCount >= 2) score -= 0.3;

  return Math.max(0, Math.min(2, score));
}

function bucketize(score) {
  if (score == null) return null;
  if (score >= 1.4) return 'good';
  if (score >= 0.6) return 'mixed';
  return 'bad';
}

(async function() {
  const client = await MongoClient.connect(URI);
  const db = client.db('cadence-dev');

  const visible = await db.collection('visible_daily').find({ user_id: { $in: USER_IDS } }).toArray();
  const checkin = await db.collection('self_report').find({ user_id: { $in: USER_IDS } }).toArray();

  // Index check-ins by date
  const ciByDate = {};
  for (const c of checkin) {
    if (c.date && c.feeling) ciByDate[c.date] = c.feeling;
  }

  // Index visible by date
  const visByDate = {};
  for (const v of visible) {
    if (v.date) visByDate[v.date] = v.observations || [];
  }

  // ── Validation: where we have both ──
  const overlap = [];
  for (const date of Object.keys(visByDate)) {
    if (ciByDate[date]) {
      const proxy = proxyFromVisible(visByDate[date]);
      const proxyBucket = bucketize(proxy);
      const truth = ciByDate[date];
      overlap.push({ date, truth, proxy, proxyBucket, match: proxyBucket === truth });
    }
  }

  console.log('══════════════════════════════════════════');
  console.log('  PROXY SCORE VALIDATION');
  console.log('══════════════════════════════════════════');
  console.log(`Days with both check-in + Visible: ${overlap.length}\n`);
  console.log('DATE        TRUTH    PROXY  BUCKET   MATCH');
  console.log('──────────────────────────────────────────');
  for (const o of overlap.sort((a,b)=>a.date.localeCompare(b.date))) {
    const proxyStr = o.proxy != null ? o.proxy.toFixed(2) : '—';
    console.log(`${o.date}  ${o.truth.padEnd(7)} ${proxyStr.padStart(5)}  ${(o.proxyBucket||'—').padEnd(7)}  ${o.match?'✅':'❌'}`);
  }
  const matches = overlap.filter(o => o.match).length;
  const acc = overlap.length ? (matches / overlap.length * 100).toFixed(1) : 0;
  console.log(`\nExact bucket accuracy: ${matches}/${overlap.length} = ${acc}%`);

  // Soft accuracy: bad↔mixed = adjacent (1 step), bad↔good = 2 steps
  const order = { bad: 0, mixed: 1, good: 2 };
  const offByOne = overlap.filter(o => o.proxyBucket && Math.abs(order[o.truth] - order[o.proxyBucket]) <= 1).length;
  console.log(`Within 1 bucket:       ${offByOne}/${overlap.length} = ${(offByOne/overlap.length*100).toFixed(1)}%`);

  // ── Apply to all visible days ──
  const allVisibleDates = Object.keys(visByDate).sort();
  const proxied = {};
  for (const date of allVisibleDates) {
    const proxy = proxyFromVisible(visByDate[date]);
    if (proxy != null) {
      proxied[date] = { proxy_score: proxy, proxy_feeling: bucketize(proxy) };
    }
  }
  const proxyDist = Object.values(proxied).reduce((acc,p) => { acc[p.proxy_feeling]=(acc[p.proxy_feeling]||0)+1; return acc; }, {});
  console.log('\n══════════════════════════════════════════');
  console.log(`  PROXY APPLIED TO ALL ${Object.keys(proxied).length} VISIBLE DAYS`);
  console.log('══════════════════════════════════════════');
  console.log('Distribution:', proxyDist);

  // ── Write back to MongoDB ──
  // We'll add proxy_score and proxy_feeling fields to a new collection
  const proxyCol = db.collection('feeling_proxy');
  let upserts = 0;
  for (const [date, data] of Object.entries(proxied)) {
    await proxyCol.updateOne(
      { user_id: 'hannah', date },
      { $set: {
          user_id: 'hannah',
          date,
          proxy_score: data.proxy_score,
          proxy_feeling: data.proxy_feeling,
          source: 'visible',
          updated_at: new Date(),
        }
      },
      { upsert: true }
    );
    upserts++;
  }
  console.log(`\n✅ Upserted ${upserts} proxy scores to feeling_proxy collection`);

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
