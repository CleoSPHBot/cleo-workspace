const { MongoClient } = require('mongodb');
const fs = require('fs');
const uri = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const client = new MongoClient(uri);

async function main() {
  await client.connect();
  const db = client.db('cadence-dev');

  const checkins = await db.collection('self_report').find({user_id: 'hannah'}).sort({date: 1}).toArray();
  const whoopDocs = await db.collection('whoop_daily').find({user_id: 6729032}).sort({date: 1}).toArray();
  const visibleDocs = await db.collection('visible_daily').find({user_id: 'hannah'}).sort({date: 1}).toArray();

  const whoopByDate = {};
  whoopDocs.forEach(d => { whoopByDate[d.date] = d; });
  const visibleByDate = {};
  visibleDocs.forEach(d => { visibleByDate[d.date] = d; });
  const checkinByDate = {};
  checkins.forEach(c => { checkinByDate[c.date] = c; });

  function getMetrics(date) {
    const w = whoopByDate[date] || {};
    const v = visibleByDate[date] || {};
    const obs = v.observations || [];
    const stability = (obs.find(o => o.tracker_name === 'Stability Score') || {}).value;
    const strain = w.strain && w.strain.score ? w.strain.score.strain : null;
    return {
      recovery: w.recovery && w.recovery.score ? w.recovery.score.recovery_score : null,
      hrv: w.recovery && w.recovery.score ? w.recovery.score.hrv_rmssd_milli : null,
      sleep: w.sleep && w.sleep.score ? w.sleep.score.sleep_performance_percentage : null,
      strain: strain,
      stability: stability != null ? stability : null
    };
  }

  function lagDate(dateStr, lag) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - lag);
    return d.toISOString().slice(0,10);
  }

  function avgOf(days, lag, field) {
    const vals = days.map(c => getMetrics(lagDate(c.date, lag))[field]).filter(v => v != null);
    if (!vals.length) return 'n/a';
    return (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1);
  }

  const goodDays = checkins.filter(c => c.feeling === 'good');
  const badDays = checkins.filter(c => c.feeling === 'bad');
  const mixedDays = checkins.filter(c => c.feeling === 'mixed');

  console.log('Total check-ins: ' + checkins.length + ' | good: ' + goodDays.length + ' | mixed: ' + mixedDays.length + ' | bad: ' + badDays.length);

  console.log('\n=== Avg metrics preceding GOOD days (n=' + goodDays.length + ') ===');
  ['recovery','hrv','sleep','strain','stability'].forEach(f => {
    console.log('  ' + f + ': lag1=' + avgOf(goodDays,1,f) + '  lag2=' + avgOf(goodDays,2,f) + '  lag3=' + avgOf(goodDays,3,f));
  });

  console.log('\n=== Avg metrics preceding BAD days (n=' + badDays.length + ') ===');
  ['recovery','hrv','sleep','strain','stability'].forEach(f => {
    console.log('  ' + f + ': lag1=' + avgOf(badDays,1,f) + '  lag2=' + avgOf(badDays,2,f) + '  lag3=' + avgOf(badDays,3,f));
  });

  console.log('\n=== PEM day before good days ===');
  const pemCounts = {};
  goodDays.forEach(c => {
    const prev = checkinByDate[lagDate(c.date, 1)];
    const pem = prev ? (prev.pem || 'unknown') : 'no data';
    pemCounts[pem] = (pemCounts[pem] || 0) + 1;
  });
  Object.entries(pemCounts).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v + ' times'));

  console.log('\n=== Consecutive non-bad days before good days ===');
  const streakCounts = {};
  goodDays.forEach(c => {
    let streak = 0;
    for (let i = 1; i <= 7; i++) {
      const prev = checkinByDate[lagDate(c.date, i)];
      if (prev && prev.feeling !== 'bad') streak++;
      else break;
    }
    streakCounts[streak] = (streakCounts[streak] || 0) + 1;
  });
  Object.entries(streakCounts).sort((a,b) => Number(a[0])-Number(b[0])).forEach(([k,v]) => console.log('  ' + k + ' non-bad days before: ' + v + ' times'));

  console.log('\n=== Recovery score (lag1) before good vs bad ===');
  const goodRec = goodDays.map(c => getMetrics(lagDate(c.date,1)).recovery).filter(v => v != null);
  const badRec = badDays.map(c => getMetrics(lagDate(c.date,1)).recovery).filter(v => v != null);
  const above70good = goodRec.filter(v => v >= 70).length;
  const above70bad = badRec.filter(v => v >= 70).length;
  console.log('  Recovery >=70 day before good: ' + above70good + '/' + goodRec.length + ' (' + (goodRec.length ? (100*above70good/goodRec.length).toFixed(0) : 'n/a') + '%)');
  console.log('  Recovery >=70 day before bad:  ' + above70bad + '/' + badRec.length + ' (' + (badRec.length ? (100*above70bad/badRec.length).toFixed(0) : 'n/a') + '%)');

  console.log('\n=== HRV (lag1) before good vs bad ===');
  const goodHRV = goodDays.map(c => getMetrics(lagDate(c.date,1)).hrv).filter(v => v != null);
  const badHRV = badDays.map(c => getMetrics(lagDate(c.date,1)).hrv).filter(v => v != null);
  const goodAvgHRV = goodHRV.length ? (goodHRV.reduce((a,b)=>a+b,0)/goodHRV.length).toFixed(1) : 'n/a';
  const badAvgHRV = badHRV.length ? (badHRV.reduce((a,b)=>a+b,0)/badHRV.length).toFixed(1) : 'n/a';
  console.log('  Avg HRV day before good days: ' + goodAvgHRV);
  console.log('  Avg HRV day before bad days:  ' + badAvgHRV);
}

main().catch(console.error).finally(() => client.close());
