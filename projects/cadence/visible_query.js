const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const client = new MongoClient(uri);
async function main() {
  await client.connect();
  const db = client.db('cadence-dev');

  // Visible daily data
  const visible = await db.collection('visible_daily').find({user_id: 'hannah'}).sort({date: 1}).toArray();
  console.log('=== VISIBLE DATA ===');
  console.log('Total records:', visible.length);
  if (visible.length > 0) {
    console.log('Date range:', visible[0].date, 'to', visible[visible.length-1].date);
    // Print each day
    visible.forEach(v => {
      const obs = v.observations || [];
      const stab = (obs.find(o => o.tracker_name === 'Stability Score') || {}).value;
      const pace = (obs.find(o => o.tracker_name === 'PacePoints') || {}).value;
      const pem = (obs.find(o => o.tracker_name === 'PEM') || {}).value;
      const hr = (obs.find(o => o.tracker_name === 'Heart Rate') || {}).value;
      console.log(v.date + ' | stability=' + stab + ' | pace=' + pace + ' | pem=' + pem + ' | hr=' + hr);
    });
  }

  // Also get WHOOP recent for cross-reference
  const whoop = await db.collection('whoop_daily').find({user_id: 6729032}).sort({date: -1}).limit(90).toArray();
  console.log('\n=== WHOOP RECENT 90 DAYS ===');
  whoop.reverse().forEach(w => {
    const rec = w.recovery && w.recovery.score ? w.recovery.score.recovery_score : null;
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    const sleep = w.sleep && w.sleep.score ? w.sleep.score.sleep_performance_percentage : null;
    const strain = w.strain && w.strain.score ? w.strain.score.strain : null;
    console.log(w.date + ' | rec=' + rec + ' | hrv=' + hrv + ' | sleep=' + sleep + ' | strain=' + strain);
  });

  // Self-report recent
  const checkins = await db.collection('self_report').find({user_id: 'hannah'}).sort({date: -1}).limit(60).toArray();
  console.log('\n=== SELF-REPORT RECENT 60 ===');
  checkins.reverse().forEach(c => {
    console.log(c.date + ' | feeling=' + c.feeling + ' | pem=' + c.pem + ' | notes=' + (c.notes||'').substring(0,80));
  });

  await client.close();
}
main().catch(console.error);
