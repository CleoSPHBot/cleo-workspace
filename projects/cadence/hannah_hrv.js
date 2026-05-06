const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db('cadence-dev');

  const checkins = await db.collection('self_report').find({user_id: 'hannah'}).sort({date: 1}).toArray();
  const whoopDocs = await db.collection('whoop_daily').find({user_id: 6729032}).sort({date: 1}).toArray();

  const whoopByDate = {};
  whoopDocs.forEach(d => { whoopByDate[d.date] = d; });
  const checkinByDate = {};
  checkins.forEach(c => { checkinByDate[c.date] = c; });

  const pemScore = { none: 0, mild: 1, moderate: 2, severe: 3 };

  // Print day-by-day HRV vs PEM vs feeling for all check-in days
  console.log('=== Day-by-day: HRV vs PEM vs Feeling ===');
  console.log('date        | HRV   | recovery | PEM      | feeling');
  console.log('------------|-------|----------|----------|--------');
  checkins.forEach(c => {
    const w = whoopByDate[c.date] || {};
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    const rec = w.recovery && w.recovery.score ? w.recovery.score.recovery_score : null;
    console.log(
      c.date + ' | ' +
      (hrv != null ? hrv.toFixed(1).padStart(5) : '  n/a') + ' | ' +
      (rec != null ? String(rec).padStart(8) : '     n/a') + ' | ' +
      (c.pem || 'unknown').padEnd(8) + ' | ' +
      (c.feeling || 'unknown')
    );
  });

  // Avg HRV by PEM level
  console.log('\n=== Avg HRV by PEM level (same day) ===');
  const hrvByPem = {};
  checkins.forEach(c => {
    const w = whoopByDate[c.date] || {};
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    if (hrv == null || !c.pem) return;
    if (!hrvByPem[c.pem]) hrvByPem[c.pem] = [];
    hrvByPem[c.pem].push(hrv);
  });
  ['none','mild','moderate','severe'].forEach(level => {
    const vals = hrvByPem[level] || [];
    if (!vals.length) return;
    const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
    console.log('  PEM ' + level + ': avg HRV ' + avg + ' (n=' + vals.length + ')');
  });

  // HRV trend during crash cycles
  console.log('\n=== HRV during last crash cycle (Apr 29 - May 5) ===');
  const cycleDates = ['2026-04-29','2026-04-30','2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05'];
  cycleDates.forEach(date => {
    const w = whoopByDate[date] || {};
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    const rec = w.recovery && w.recovery.score ? w.recovery.score.recovery_score : null;
    const c = checkinByDate[date] || {};
    console.log(date + ': HRV=' + (hrv ? hrv.toFixed(1) : 'n/a') + ' rec=' + (rec || 'n/a') + ' PEM=' + (c.pem || 'n/a') + ' feeling=' + (c.feeling || 'n/a'));
  });

  // Does HRV lag or lead PEM improvement?
  console.log('\n=== HRV vs next-day PEM (does HRV predict PEM improvement?) ===');
  checkins.forEach((c, i) => {
    if (i === checkins.length - 1) return;
    const next = checkins[i+1];
    const w = whoopByDate[c.date] || {};
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    if (!hrv || !c.pem || !next.pem) return;
    const pemNow = pemScore[c.pem] != null ? pemScore[c.pem] : '?';
    const pemNext = pemScore[next.pem] != null ? pemScore[next.pem] : '?';
    const dir = pemNext < pemNow ? '↓ better' : pemNext > pemNow ? '↑ worse' : '→ same';
    console.log(c.date + ': HRV=' + hrv.toFixed(1) + ' PEM=' + c.pem + ' → next day PEM=' + next.pem + ' ' + dir);
  });
}

main().catch(console.error).finally(() => client.close());
