const { MongoClient } = require('mongodb');
const fs = require('fs');
const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('cadence-dev');
  const col = db.collection('whoop_daily');

  // Last 7 days
  const recent = await col.find({ user_id: 206067 })
    .sort({ date: -1 }).limit(7).toArray();

  console.log('Date       | HRV (ms) | Recovery | RHR | SpO2 | Sleep% | Strain');
  console.log('─'.repeat(75));
  for (const d of recent) {
    const rec = d.recovery?.score;
    const slp = d.sleep?.score;
    const hrv  = rec?.hrv_rmssd_milli?.toFixed(1) ?? '—';
    const recS = rec?.recovery_score ?? '—';
    const rhr  = rec?.resting_heart_rate ?? '—';
    const spo2 = rec?.spo2_percentage ?? '—';
    const slpP = slp?.sleep_performance_percentage ?? '—';
    const str  = d.strain?.score?.strain?.toFixed(1) ?? '—';
    console.log(`${d.date} | ${String(hrv).padEnd(8)} | ${String(recS).padEnd(8)} | ${String(rhr).padEnd(3)} | ${String(spo2).padEnd(4)} | ${String(slpP).padEnd(6)} | ${str}`);
  }

  await client.close();
}
main().catch(e => console.error(e));
