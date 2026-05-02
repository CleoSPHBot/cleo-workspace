#!/usr/bin/env node
/**
 * correlate.js
 * --------------------------------
 * Goal: Find what predicts Hannah feeling good.
 *
 * Approach:
 *   - Build a per-day feature row from MongoDB (whoop_daily, visible_daily, self_report)
 *   - Target: feeling score (good=2, mixed=1, bad=0)
 *   - Run Spearman correlation for same-day and lag-1, lag-2, lag-3 features
 *   - Rank top predictors
 *
 * Notes:
 *   - LC + WHOOP recovery decoupling is a known issue — we expect WHOOP same-day to
 *     correlate weakly. Lag features should be more interesting.
 *   - PacePoints on Adderall days are inflated — we flag these but don't drop them.
 */

const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const URI  = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const USER_IDS = ['hannah', 6729032];

// ── Helpers ───────────────────────────────────────
function feelingScore(f) {
  if (f === 'good')  return 2;
  if (f === 'mixed') return 1;
  if (f === 'bad')   return 0;
  return null;
}

// Spearman rank correlation
function rank(arr) {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}
function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a,b)=>a+b,0)/n;
  const my = y.reduce((a,b)=>a+b,0)/n;
  let num=0, dx=0, dy=0;
  for (let i=0; i<n; i++) {
    const xd = x[i]-mx, yd = y[i]-my;
    num += xd*yd; dx += xd*xd; dy += yd*yd;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx*dy);
}
function spearman(x, y) {
  const pairs = x.map((v,i) => [v, y[i]]).filter(([a,b]) => a != null && b != null && !Number.isNaN(a) && !Number.isNaN(b));
  if (pairs.length < 5) return { r: null, n: pairs.length };
  const xs = pairs.map(p => p[0]);
  const ys = pairs.map(p => p[1]);
  return { r: pearson(rank(xs), rank(ys)), n: pairs.length };
}

// ── Main ────────────────────────────────────────
(async function() {
  const client = await MongoClient.connect(URI);
  const db = client.db('cadence-dev');

  // Pull all data
  const whoop  = await db.collection('whoop_daily').find({ user_id: { $in: USER_IDS } }).toArray();
  const visible= await db.collection('visible_daily').find({ user_id: { $in: USER_IDS } }).toArray();
  const checkin= await db.collection('self_report').find({ user_id: { $in: USER_IDS } }).toArray();

  console.log(`Loaded: ${whoop.length} WHOOP, ${visible.length} Visible, ${checkin.length} check-ins`);

  // Index by date
  const byDate = {};
  function ensure(d) { if (!byDate[d]) byDate[d] = { date: d }; return byDate[d]; }

  for (const w of whoop) {
    if (!w.date) continue;
    const r = ensure(w.date);
    r.recovery   = w.recovery?.score?.recovery_score;
    r.hrv        = w.recovery?.score?.hrv_rmssd_milli;
    r.rhr        = w.recovery?.score?.resting_heart_rate;
    r.spo2       = w.recovery?.score?.spo2_percentage;
    r.skin_temp  = w.recovery?.score?.skin_temp_celsius;
    r.sleep_perf = w.sleep?.score?.sleep_performance_percentage;
    r.sleep_consistency = w.sleep?.score?.sleep_consistency_percentage;
    r.sleep_efficiency  = w.sleep?.score?.sleep_efficiency_percentage;
    r.respiratory_rate  = w.sleep?.score?.respiratory_rate;
    const sleepStages = w.sleep?.score?.stage_summary;
    if (sleepStages) {
      r.sleep_total_hours = (sleepStages.total_in_bed_time_milli - sleepStages.total_awake_time_milli) / 3600000;
      r.sleep_rem_hours   = sleepStages.total_rem_sleep_time_milli / 3600000;
      r.sleep_sws_hours   = sleepStages.total_slow_wave_sleep_time_milli / 3600000;
      r.sleep_disturbances= sleepStages.disturbance_count;
    }
    r.strain = w.strain?.score?.strain;
  }
  for (const v of visible) {
    if (!v.date) continue;
    const r = ensure(v.date);
    const obs = v.observations || [];
    const get = name => obs.find(o => o.tracker_name === name)?.value;
    r.pace_points    = get('PacePoints');
    r.pacing_budget  = get('Pacing Budget');
    r.stability      = get('Stability Score');
    r.v_hrv          = get('HRV');
    r.v_rhr          = get('Resting HR');
    // Symptoms (1=mild, 2=moderate, 3=severe; 0 means not flagged)
    r.fatigue       = get('Fatigue') || 0;
    r.brain_fog     = get('Brain Fog') || 0;
    r.crash         = get('Crash') === 1 ? 1 : 0;
    r.headache      = get('Headache') || 0;
    r.muscle_aches  = get('Muscle aches') || 0;
    r.nerve_pain    = get('Nerve pain') || 0;
    r.shortness     = get('Shortness of breath') || 0;
    r.lightheaded   = get('Lightheadedness') || 0;
    r.stomach_pain  = get('Stomach pain') || 0;
    r.anxiety       = get('Anxiety') || 0;
    r.depression    = get('Depression') || 0;
    r.physically_active = get('Physically active') || 0;
    r.mentally_demanding = get('Mentally demanding') || 0;
    r.socially_demanding = get('Socially demanding') || 0;
    r.emotionally_stressful = get('Emotionally stressful') || 0;
  }
  for (const c of checkin) {
    if (!c.date) continue;
    const r = ensure(c.date);
    r.feeling_score = feelingScore(c.feeling);
    r.feeling       = c.feeling;
    r.pem           = c.pem;
    r.ci_brain_fog  = c.brain_fog;
    r.pain          = c.pain;
    r.left_home     = c.left_home;
    r.probiotics    = c.probiotics === true || c.probiotics === 'yes' ? 1 : 0;
    r.stimulants    = c.stimulants === true || c.stimulants === 'yes' ? 1 : 0;
    const notes = (c.notes || '').toLowerCase();
    r.adderall      = (c.stimulants === true || c.stimulants === 'yes' || notes.includes('adderall')) ? 1 : 0;
    r.compression   = c.compression === true || c.compression === 'yes' ? 1 : 0;
    r.notes         = c.notes || '';
  }

  // Sort by date
  const days = Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date));
  const dayMap = Object.fromEntries(days.map(d => [d.date, d]));

  // Add lag features (1, 2, 3 days)
  function dayOffset(date, n) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0,10);
  }
  for (const d of days) {
    for (const lag of [1,2,3]) {
      const prev = dayMap[dayOffset(d.date, lag)];
      if (!prev) continue;
      // Lag features
      d[`recovery_lag${lag}`]   = prev.recovery;
      d[`hrv_lag${lag}`]        = prev.hrv;
      d[`pace_lag${lag}`]       = prev.pace_points;
      d[`sleep_lag${lag}`]      = prev.sleep_perf;
      d[`strain_lag${lag}`]     = prev.strain;
      d[`stability_lag${lag}`]  = prev.stability;
    }
    // 3-day rolling sums
    const last3pace = [1,2,3].map(l => dayMap[dayOffset(d.date, l)]?.pace_points).filter(v => v != null);
    if (last3pace.length === 3) d.pace_3d_sum = last3pace.reduce((a,b)=>a+b, 0);
    const last3rec = [1,2,3].map(l => dayMap[dayOffset(d.date, l)]?.recovery).filter(v => v != null);
    if (last3rec.length === 3) d.recovery_3d_avg = last3rec.reduce((a,b)=>a+b, 0)/3;
  }

  // Filter to days with feeling_score
  const labeled = days.filter(d => d.feeling_score != null);
  console.log(`\nLabeled days: ${labeled.length}`);
  const dist = labeled.reduce((acc, d) => { acc[d.feeling] = (acc[d.feeling]||0)+1; return acc; }, {});
  console.log('Feeling distribution:', dist);

  // Features to test against feeling_score
  const features = [
    // Same day WHOOP
    'recovery','hrv','rhr','spo2','skin_temp','sleep_perf','sleep_consistency','sleep_efficiency',
    'sleep_total_hours','sleep_rem_hours','sleep_sws_hours','sleep_disturbances','respiratory_rate','strain',
    // Same day Visible
    'pace_points','pacing_budget','stability','v_hrv','v_rhr',
    'fatigue','brain_fog','crash','headache','muscle_aches','nerve_pain','shortness','lightheaded','stomach_pain',
    'anxiety','depression','physically_active','mentally_demanding','socially_demanding','emotionally_stressful',
    // Same day check-in indicators (excluding feeling itself)
    'pem','pain','left_home','probiotics','stimulants','adderall','compression',
    // Lag features
    'recovery_lag1','recovery_lag2','recovery_lag3',
    'hrv_lag1','hrv_lag2','hrv_lag3',
    'pace_lag1','pace_lag2','pace_lag3',
    'sleep_lag1','sleep_lag2','sleep_lag3',
    'strain_lag1','strain_lag2','strain_lag3',
    'stability_lag1','stability_lag2','stability_lag3',
    // Rolling
    'pace_3d_sum','recovery_3d_avg',
  ];

  const target = labeled.map(d => d.feeling_score);
  const results = [];
  for (const f of features) {
    const x = labeled.map(d => {
      const v = d[f];
      if (v == null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string') {
        if (v === 'yes' || v === 'true') return 1;
        if (v === 'no'  || v === 'false') return 0;
        const n = parseFloat(v);
        return Number.isNaN(n) ? null : n;
      }
      return v;
    });
    const { r, n } = spearman(x, target);
    if (r != null) results.push({ feature: f, r, n });
  }

  // Sort by absolute correlation
  results.sort((a,b) => Math.abs(b.r) - Math.abs(a.r));

  console.log('\n══════════════════════════════════════════');
  console.log('  FEATURE → FEELING SCORE CORRELATIONS');
  console.log('══════════════════════════════════════════');
  console.log('Spearman r (positive = more of feature → better feeling)');
  console.log('Negative = more of feature → worse feeling\n');

  console.log('FEATURE                       r       n     interpretation');
  console.log('──────────────────────────────────────────────────────────');
  for (const row of results) {
    const r = row.r.toFixed(3).padStart(6);
    const n = String(row.n).padStart(4);
    let arrow = '   ';
    if (Math.abs(row.r) >= 0.3) arrow = row.r > 0 ? '🟢↑' : '🔴↓';
    else if (Math.abs(row.r) >= 0.15) arrow = row.r > 0 ? '🟡↑' : '🟡↓';
    console.log(`${row.feature.padEnd(28)} ${r}  ${n}  ${arrow}`);
  }

  // Save labeled feature matrix to CSV for further analysis
  const csvPath = path.join(__dirname, 'features.csv');
  const allKeys = new Set();
  labeled.forEach(d => Object.keys(d).forEach(k => k !== 'notes' && allKeys.add(k)));
  const cols = Array.from(allKeys);
  const csv = [cols.join(',')].concat(
    labeled.map(d => cols.map(c => {
      const v = d[c];
      if (v == null) return '';
      if (typeof v === 'string') return JSON.stringify(v);
      return v;
    }).join(','))
  ).join('\n');
  fs.writeFileSync(csvPath, csv);
  console.log(`\nFeature matrix saved: ${csvPath} (${labeled.length} rows × ${cols.length} cols)`);

  // Save summary JSON
  const summaryPath = path.join(__dirname, 'correlations.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    n_labeled_days: labeled.length,
    feeling_distribution: dist,
    correlations: results,
  }, null, 2));
  console.log(`Correlations saved: ${summaryPath}`);

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
