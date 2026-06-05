#!/usr/bin/env node
// SGB sleep analysis: 7 days before and after May 29 SGB (SGB-1)
const { MongoClient } = require('/home2/cleo/.openclaw/workspace/projects/cadence/node_modules/mongodb');
const fs = require('fs');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const HANNAH_ID = 6729032;
const SGB_DATE = '2026-05-29';

function msToHours(ms) {
  if (!ms) return null;
  return (ms / 3600000).toFixed(1);
}

function msToMin(ms) {
  if (!ms) return null;
  return Math.round(ms / 60000);
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db('cadence-dev');
    const col = db.collection('whoop_daily');
    
    // Pull May 21 to June 5 (extra day buffer on each end)
    const docs = await col.find({
      user_id: HANNAH_ID,
      date: { $gte: '2026-05-21', $lte: '2026-06-05' }
    }).sort({ date: 1 }).toArray();
    
    console.log(`Found ${docs.length} days in window\n`);
    console.log('SGB-1 date: May 29, 2026\n');
    console.log('─'.repeat(120));
    console.log(
      'Date'.padEnd(12) +
      'Phase'.padEnd(14) +
      'Recovery%'.padEnd(12) +
      'HRV(ms)'.padEnd(10) +
      'RHR'.padEnd(8) +
      'Sleep%'.padEnd(10) +
      'TotalSleep'.padEnd(12) +
      'SWS(min)'.padEnd(10) +
      'REM(min)'.padEnd(10) +
      'Awake(min)'.padEnd(12) +
      'Nap'
    );
    console.log('─'.repeat(120));
    
    for (const doc of docs) {
      const date = doc.date;
      const sgbDiff = Math.ceil((new Date(date) - new Date(SGB_DATE)) / 86400000);
      
      let phase;
      if (sgbDiff === 0) phase = '🔴 SGB Day';
      else if (sgbDiff < 0) phase = `Pre-SGB ${sgbDiff}d`;
      else phase = `Post-SGB +${sgbDiff}d`;
      
      const rec = doc.recovery;
      const sleep = doc.sleep;
      const s = sleep && sleep.score;
      const ss = s && s.stage_summary;
      
      const recoveryPct = rec && rec.score ? rec.score.recovery_score : null;
      const hrv = rec && rec.score ? rec.score.hrv_rmssd_milli : null;
      const rhr = rec && rec.score ? rec.score.resting_heart_rate : null;
      const sleepPct = s ? s.sleep_performance_percentage : null;
      const totalSleep = ss ? msToHours(ss.total_in_bed_time_milli - ss.total_awake_time_milli) : null;
      const sws = ss ? msToMin(ss.total_slow_wave_sleep_time_milli) : null;
      const rem = ss ? msToMin(ss.total_rem_sleep_time_milli) : null;
      const awake = ss ? msToMin(ss.total_awake_time_milli) : null;
      const isNap = sleep ? sleep.nap : null;
      
      const fmt = (v, dec) => v !== null && v !== undefined ? (dec ? Number(v).toFixed(dec) : String(v)) : '—';
      
      console.log(
        date.padEnd(12) +
        phase.padEnd(14) +
        fmt(recoveryPct).padEnd(12) +
        fmt(hrv, 1).padEnd(10) +
        fmt(rhr).padEnd(8) +
        fmt(sleepPct, 1).padEnd(10) +
        fmt(totalSleep).padEnd(12) +
        fmt(sws).padEnd(10) +
        fmt(rem).padEnd(10) +
        fmt(awake).padEnd(12) +
        (isNap ? 'NAP' : '')
      );
    }
    
    // Also check for naps — they may be separate docs
    const allDocs = await col.find({
      user_id: HANNAH_ID,
      date: { $gte: '2026-05-21', $lte: '2026-06-05' }
    }).sort({ date: 1, created_at: 1 }).toArray();
    
    const napDocs = allDocs.filter(d => d.sleep && d.sleep.nap === true);
    if (napDocs.length > 0) {
      console.log('\nNap records found:');
      for (const n of napDocs) {
        const s = n.sleep && n.sleep.score;
        const ss = s && s.stage_summary;
        console.log(`  ${n.date}: ${msToHours(ss ? ss.total_in_bed_time_milli - ss.total_awake_time_milli : null)}h sleep`);
      }
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
