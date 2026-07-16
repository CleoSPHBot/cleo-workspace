const { MongoClient } = require('mongodb');
const fs = require('fs');
const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('cadence-dev');
  const col = db.collection('whoop_daily');

  const doc = await col.findOne({ user_id: 206067, date: '2026-07-15' });
  console.log('date:        ', doc.date);
  console.log('created_at:  ', doc.created_at);
  console.log('updated_at:  ', doc.updated_at);
  console.log('hrv_rmssd:   ', doc.recovery?.score?.hrv_rmssd_milli);
  console.log('recovery:    ', doc.recovery?.score?.recovery_score);
  console.log('score_state: ', doc.recovery?.score_state);
  console.log('sleep scored?', doc.sleep?.score ? 'yes' : 'no / missing');

  await client.close();
}
main().catch(e => console.error(e));
