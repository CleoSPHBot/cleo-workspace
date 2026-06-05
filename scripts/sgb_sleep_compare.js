#!/usr/bin/env node
// SGB sleep comparison: pre vs post settled period
const { MongoClient } = require('/home2/cleo/.openclaw/workspace/projects/cadence/node_modules/mongodb');
const fs = require('fs');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const HANNAH_ID = 6729032;

function msToHours(ms) {
  if (!ms && ms !== 0) return null;
  return ms / 3600000;
}
function msToMin(ms) {
  if (!ms && ms !== 0) return null;
  return ms / 60000;
}
function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db('cadence-dev');
    const col = db.collection('whoop_daily');
    
    // Pull a wider window: May 8 (3 weeks pre) through Jun 5
    const docs = await col.find({
      user_id: HANNAH_ID,
      date: { $gte: '2026-05-08', $lte: '2026-06-05' }
    }).sort({ date: 1 }).toArray();
    
    // Filter to overnight sleep only (nap: false)
    const overnight = docs.filter(d => d.sleep && d.sleep.nap === false && d.sleep.score && d.sleep.score.stage_summary);
    
    console.log(`Total overnight sleep records in window: ${overnight.length}`);
    
    // Print each with key metrics
    console.log('\nDate         | Rec% | HRV   | RHR | Sleep% | Total | SWS  | REM  | Light | Awake | Phase');
    console.log('-------------|------|-------|-----|--------|-------|------|------|-------|-------|------');
    
    for (const doc of overnight) {
      const date = doc.date;
      const rec = doc.recovery && doc.recovery.score;
      const s = doc.sleep.score;
      const ss = s.stage_summary;
      
      const recovery = rec ? rec.recovery_score : null;
      const hrv = rec ? rec.hrv_rmssd_milli : null;
      const rhr = rec ? rec.resting_heart_rate : null;
      const sleepPct = s.sleep_performance_percentage;
      const totalH = msToHours(ss.total_in_bed_time_milli - ss.total_awake_time_milli);
      const swsMin = msToMin(ss.total_slow_wave_sleep_time_milli);
      const remMin = msToMin(ss.total_rem_sleep_time_milli);
      const lightMin = msToMin(ss.total_light_sleep_time_milli);
      const awakeMin = msToMin(ss.total_awake_time_milli);
      
      const sgbOffset = Math.ceil((new Date(date) - new Date('2026-05-29')) / 86400000);
      const phase = sgbOffset < 0 ? `Pre (${sgbOffset}d)` : sgbOffset === 0 ? 'SGB Day' : `Post (+${sgbOffset}d)`;
      
      const fmt = (v, d) => v !== null && v !== undefined ? Number(v).toFixed(d || 0) : '—';
      
      console.log(
        `${date} | ${fmt(recovery).padStart(4)} | ${fmt(hrv,1).padStart(5)} | ${fmt(rhr).padStart(3)} | ${fmt(sleepPct,0).padStart(6)} | ${fmt(totalH,1).padStart(5)} | ${fmt(swsMin,0).padStart(4)} | ${fmt(remMin,0).padStart(4)} | ${fmt(lightMin,0).padStart(5)} | ${fmt(awakeMin,0).padStart(5)} | ${phase}`
      );
    }
    
    // Compute averages: pre-SGB (May 8-28 overnight only) vs post-SGB settled (Jun 2+)
    const preDocs = overnight.filter(d => d.date >= '2026-05-08' && d.date <= '2026-05-28');
    const postDocs = overnight.filter(d => d.date >= '2026-06-02');
    
    function computeStats(arr) {
      const get = (doc, fn) => {
        try { return fn(doc); } catch(e) { return null; }
      };
      return {
        n: arr.length,
        recovery: avg(arr.map(d => get(d, x => x.recovery.score.recovery_score))),
        hrv: avg(arr.map(d => get(d, x => x.recovery.score.hrv_rmssd_milli))),
        rhr: avg(arr.map(d => get(d, x => x.recovery.score.resting_heart_rate))),
        sleepPct: avg(arr.map(d => get(d, x => x.sleep.score.sleep_performance_percentage))),
        totalH: avg(arr.map(d => {
          const ss = d.sleep.score.stage_summary;
          return msToHours(ss.total_in_bed_time_milli - ss.total_awake_time_milli);
        })),
        swsMin: avg(arr.map(d => msToMin(d.sleep.score.stage_summary.total_slow_wave_sleep_time_milli))),
        remMin: avg(arr.map(d => msToMin(d.sleep.score.stage_summary.total_rem_sleep_time_milli))),
        awakeMin: avg(arr.map(d => msToMin(d.sleep.score.stage_summary.total_awake_time_milli))),
      };
    }
    
    const preStats = computeStats(preDocs);
    const postStats = computeStats(postDocs);
    
    console.log('\n=== AVERAGES ===');
    console.log(`Pre-SGB (${preStats.n} nights, May 8–28):  Recovery ${preStats.recovery?.toFixed(1)}%  HRV ${preStats.hrv?.toFixed(1)}ms  RHR ${preStats.rhr?.toFixed(1)}  Sleep% ${preStats.sleepPct?.toFixed(1)}%  Total ${preStats.totalH?.toFixed(1)}h  SWS ${preStats.swsMin?.toFixed(0)}min  REM ${preStats.remMin?.toFixed(0)}min  Awake ${preStats.awakeMin?.toFixed(0)}min`);
    console.log(`Post-SGB (${postStats.n} nights, Jun 2+):  Recovery ${postStats.recovery?.toFixed(1)}%  HRV ${postStats.hrv?.toFixed(1)}ms  RHR ${postStats.rhr?.toFixed(1)}  Sleep% ${postStats.sleepPct?.toFixed(1)}%  Total ${postStats.totalH?.toFixed(1)}h  SWS ${postStats.swsMin?.toFixed(0)}min  REM ${postStats.remMin?.toFixed(0)}min  Awake ${postStats.awakeMin?.toFixed(0)}min`);
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
