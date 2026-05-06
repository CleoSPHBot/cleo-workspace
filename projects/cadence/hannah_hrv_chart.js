const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db('cadence-dev');

  // 3 weeks = 21 days back
  const startDate = new Date('2026-04-15');
  const endDate = new Date('2026-05-05');

  const whoopDocs = await db.collection('whoop_daily')
    .find({ user_id: 6729032, date: { $gte: '2026-04-15', $lte: '2026-05-05' } })
    .sort({ date: 1 }).toArray();

  const visibleDocs = await db.collection('visible_daily')
    .find({ user_id: 'hannah', date: { $gte: '2026-04-15', $lte: '2026-05-05' } })
    .sort({ date: 1 }).toArray();

  const checkins = await db.collection('self_report')
    .find({ user_id: 'hannah', date: { $gte: '2026-04-15', $lte: '2026-05-05' } })
    .sort({ date: 1 }).toArray();

  const visibleByDate = {};
  visibleDocs.forEach(d => { visibleByDate[d.date] = d; });
  const checkinByDate = {};
  checkins.forEach(c => { checkinByDate[c.date] = c; });

  // Build data array
  const data = whoopDocs.map(d => {
    const hrv = d.recovery && d.recovery.score ? d.recovery.score.hrv_rmssd_milli : null;
    const rec = d.recovery && d.recovery.score ? d.recovery.score.recovery_score : null;
    const vis = visibleByDate[d.date];
    const obs = vis ? vis.observations || [] : [];
    const pacePoints = (obs.find(o => o.tracker_name === 'PacePoints') || {}).value;
    const strain = d.strain && d.strain.score ? d.strain.score.strain : null;
    const ci = checkinByDate[d.date];
    const pem = ci ? ci.pem : null;
    const feeling = ci ? ci.feeling : null;
    // "spend" = strain > 2 OR pacePoints > 8
    const spend = (strain != null && strain > 2) || (pacePoints != null && pacePoints > 8);
    return { date: d.date, hrv, rec, strain, pacePoints, pem, feeling, spend };
  });

  console.log(JSON.stringify(data, null, 2));
  await client.close();
}

main().catch(console.error);
