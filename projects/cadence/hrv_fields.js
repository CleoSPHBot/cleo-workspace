const { MongoClient } = require('mongodb');
const fs = require('fs');
const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('cadence-dev');

  // Today's WHOOP doc — all HRV-related fields
  const wDoc = await db.collection('whoop_daily').findOne({ user_id: 206067, date: '2026-07-15' });
  console.log('=== WHOOP daily 2026-07-15 ===');
  console.log('recovery.score.hrv_rmssd_milli:', wDoc?.recovery?.score?.hrv_rmssd_milli);
  console.log('recovery.score_state:          ', wDoc?.recovery?.score_state);
  console.log('recovery.created_at:           ', wDoc?.recovery?.created_at);
  console.log('recovery.updated_at:           ', wDoc?.recovery?.updated_at);
  console.log('sleep present?                 ', !!wDoc?.sleep);
  if (wDoc?.sleep) {
    console.log('sleep.score.sleep_performance_percentage:', wDoc?.sleep?.score?.sleep_performance_percentage);
  }
  // Any other hrv field?
  const str = JSON.stringify(wDoc);
  const hrvMatches = [...str.matchAll(/"hrv[^"]*"\s*:\s*([\d.]+)/g)];
  console.log('All HRV fields in doc:', hrvMatches.map(m => `${m[0]}`));

  // Today's Visible doc
  const vDoc = await db.collection('visible_daily').findOne({ user_id: 'hannah', date: '2026-07-15' });
  console.log('\n=== Visible daily 2026-07-15 ===');
  if (!vDoc) {
    console.log('No Visible doc for today');
  } else {
    // Find HRV in observations
    const obs = vDoc.observations || [];
    const hrv = obs.find(o => o.tracker_name?.toLowerCase().includes('hrv'));
    console.log('HRV observation:', hrv ?? 'not found');
    console.log('All observations:', obs.map(o => `${o.tracker_name}=${o.value}`).join(', '));
  }

  // Yesterday's Visible doc (in case dashboard is showing yesterday)
  const vYest = await db.collection('visible_daily').findOne({ user_id: 'hannah', date: '2026-07-14' });
  console.log('\n=== Visible daily 2026-07-14 ===');
  if (!vYest) {
    console.log('No Visible doc for Jul 14');
  } else {
    const obs = vYest.observations || [];
    const hrv = obs.find(o => o.tracker_name?.toLowerCase().includes('hrv'));
    console.log('HRV observation:', hrv ?? 'not found');
  }

  await client.close();
}
main().catch(e => console.error(e));
