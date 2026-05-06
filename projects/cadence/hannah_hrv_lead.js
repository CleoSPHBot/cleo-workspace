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
  const feelScore = { good: 3, mixed: 2, bad: 1 };

  function lagDate(dateStr, lag) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + lag); // forward lag
    return d.toISOString().slice(0,10);
  }

  function getHRV(date) {
    const w = whoopByDate[date] || {};
    return w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
  }

  // For each whoop day with HRV, look at feeling/PEM 1, 2, 3 days LATER
  console.log('=== Does HRV today predict feeling/PEM in 1-3 days? ===');
  console.log('date        | HRV   | +1d feeling/PEM        | +2d feeling/PEM        | +3d feeling/PEM');
  console.log('------------|-------|------------------------|------------------------|------------------------');
  whoopDocs.forEach(w => {
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    if (!hrv) return;
    const c1 = checkinByDate[lagDate(w.date, 1)];
    const c2 = checkinByDate[lagDate(w.date, 2)];
    const c3 = checkinByDate[lagDate(w.date, 3)];
    const fmt = c => c ? (c.feeling + '/' + (c.pem || '?')).padEnd(22) : 'no data               ';
    console.log(w.date + ' | ' + hrv.toFixed(1).padStart(5) + ' | ' + fmt(c1) + ' | ' + fmt(c2) + ' | ' + fmt(c3));
  });

  // Spearman-style: rank correlations of HRV vs future feeling
  console.log('\n=== Avg future feeling score by HRV tier ===');
  const high = [], mid = [], low = [];
  whoopDocs.forEach(w => {
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    if (!hrv) return;
    // collect feeling scores at lag 1, 2, 3
    [1,2,3].forEach(lag => {
      const c = checkinByDate[lagDate(w.date, lag)];
      if (!c || !c.feeling) return;
      const fs = feelScore[c.feeling];
      if (hrv >= 37) high.push(fs);
      else if (hrv >= 32) mid.push(fs);
      else low.push(fs);
    });
  });

  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2) : 'n/a';
  console.log('  HRV >=37 (high):  avg future feeling=' + avg(high) + ' (n=' + high.length + ') [1=bad, 2=mixed, 3=good]');
  console.log('  HRV 32-36 (mid):  avg future feeling=' + avg(mid)  + ' (n=' + mid.length + ')');
  console.log('  HRV <32 (low):    avg future feeling=' + avg(low)  + ' (n=' + low.length + ')');

  // Same for PEM
  console.log('\n=== Avg future PEM score by HRV tier ===');
  const highP = [], midP = [], lowP = [];
  whoopDocs.forEach(w => {
    const hrv = w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null;
    if (!hrv) return;
    [1,2,3].forEach(lag => {
      const c = checkinByDate[lagDate(w.date, lag)];
      if (!c || !c.pem || pemScore[c.pem] == null) return;
      const ps = pemScore[c.pem];
      if (hrv >= 37) highP.push(ps);
      else if (hrv >= 32) midP.push(ps);
      else lowP.push(ps);
    });
  });
  console.log('  HRV >=37 (high):  avg future PEM=' + avg(highP) + ' (n=' + highP.length + ') [0=none, 1=mild, 2=mod, 3=severe]');
  console.log('  HRV 32-36 (mid):  avg future PEM=' + avg(midP)  + ' (n=' + midP.length + ')');
  console.log('  HRV <32 (low):    avg future PEM=' + avg(lowP)  + ' (n=' + lowP.length + ')');
}

main().catch(console.error).finally(() => client.close());
