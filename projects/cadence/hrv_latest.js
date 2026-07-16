const { MongoClient } = require('mongodb');
const fs = require('fs');
const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('cadence-dev');

  // Get latest WHOOP recovery entries
  const whoopCol = db.collection('whoop_recovery');
  const latest = await whoopCol.find({}).sort({ created_at: -1 }).limit(5).toArray();

  console.log('Latest WHOOP recovery docs:');
  latest.forEach(d => {
    console.log(JSON.stringify({
      date: d.created_at || d.date || d.start,
      hrv: d.score?.hrv_rmssd_milli,
      recovery: d.score?.recovery_score,
      rhr: d.score?.resting_heart_rate,
      spo2: d.score?.spo2_percentage,
    }));
  });

  // Also check visible for today
  const visCol = db.collection('visible');
  const visLatest = await visCol.find({}).sort({ date: -1 }).limit(3).toArray();
  console.log('\nLatest Visible docs:');
  visLatest.forEach(d => {
    console.log(JSON.stringify({
      date: d.date,
      hrv: d.hrv,
      pace_points: d.pace_points,
      stability: d.stability,
      crash: d.crash,
    }));
  });

  await client.close();
}
main().catch(e => console.error(e));
