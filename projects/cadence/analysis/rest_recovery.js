#!/usr/bin/env node
/**
 * rest_recovery.js
 * --------------------------------
 * Two questions:
 *   1. When Hannah actively rests, how much does she recover?
 *   2. What's a good "absolute budget" anchor?
 *
 * Approach:
 *   - Find consecutive low-activity days (PacePoints < 5)
 *   - Track WHOOP recovery score before/during/after
 *   - Look at recovery delta per rest day
 *   - Look at the ceiling she reaches after sustained rest (asymptote)
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');

const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const USER_IDS = ['hannah', 6729032];

(async function() {
  const client = await MongoClient.connect(URI);
  const db = client.db('cadence-dev');

  const whoop  = await db.collection('whoop_daily').find({ user_id: { $in: USER_IDS } }).toArray();
  const visible= await db.collection('visible_daily').find({ user_id: { $in: USER_IDS } }).toArray();

  // Index by date
  const byDate = {};
  for (const w of whoop) {
    if (!w.date) continue;
    byDate[w.date] = byDate[w.date] || { date: w.date };
    byDate[w.date].recovery = w.recovery?.score?.recovery_score;
    byDate[w.date].hrv      = w.recovery?.score?.hrv_rmssd_milli;
    byDate[w.date].rhr      = w.recovery?.score?.resting_heart_rate;
    byDate[w.date].strain   = w.strain?.score?.strain;
  }
  for (const v of visible) {
    if (!v.date) continue;
    byDate[v.date] = byDate[v.date] || { date: v.date };
    const obs = v.observations || [];
    byDate[v.date].pace = obs.find(o => o.tracker_name === 'PacePoints')?.value;
  }

  const days = Object.values(byDate)
    .filter(d => d.recovery != null && d.pace != null)
    .sort((a,b) => a.date.localeCompare(b.date));

  console.log(`Days with both WHOOP recovery + Visible PacePoints: ${days.length}`);
  if (days.length < 7) {
    console.log('Not enough overlap to analyze.');
    await client.close();
    return;
  }

  // Find rest streaks (3+ consecutive days with pace < 5)
  const REST_THRESHOLD = 5;
  const streaks = [];
  let current = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const isRest = d.pace < REST_THRESHOLD;
    if (isRest) {
      current.push(d);
    } else {
      if (current.length >= 2) streaks.push(current);
      current = [];
    }
  }
  if (current.length >= 2) streaks.push(current);

  console.log(`\nRest streaks (\u22652 consecutive days with PacePoints < ${REST_THRESHOLD}): ${streaks.length}`);
  console.log('\n══════════════════════════════════════════');
  console.log('  RECOVERY DURING REST STREAKS');
  console.log('══════════════════════════════════════════');

  const allDeltas = [];
  for (const streak of streaks) {
    const startRec = streak[0].recovery;
    const endRec   = streak[streak.length - 1].recovery;
    const delta    = endRec - startRec;
    const perDay   = streak.length > 1 ? delta / (streak.length - 1) : 0;
    const peakRec  = Math.max(...streak.map(d => d.recovery));
    console.log(`\n${streak[0].date} \u2192 ${streak[streak.length-1].date} (${streak.length} days)`);
    console.log(`  PacePoints: ${streak.map(d => d.pace.toFixed(1)).join(' \u2192 ')}`);
    console.log(`  Recovery:   ${streak.map(d => d.recovery).join('% \u2192 ')}%`);
    console.log(`  Net delta:  ${delta > 0 ? '+' : ''}${delta}% (${perDay > 0 ? '+' : ''}${perDay.toFixed(1)}/day)`);
    console.log(`  Peak:       ${peakRec}%`);
    if (streak.length > 1) allDeltas.push(perDay);
  }

  if (allDeltas.length > 0) {
    const avgPerDay = allDeltas.reduce((a,b)=>a+b,0) / allDeltas.length;
    const median = allDeltas.slice().sort((a,b)=>a-b)[Math.floor(allDeltas.length/2)];
    console.log('\n──────────────────────────────────────────');
    console.log(`Avg recovery gain per rest day:    ${avgPerDay > 0 ? '+' : ''}${avgPerDay.toFixed(1)}%`);
    console.log(`Median:                            ${median > 0 ? '+' : ''}${median.toFixed(1)}%`);
  }

  // ── Absolute ceiling: highest sustained recovery ──
  const recoveryScores = days.map(d => d.recovery);
  const sortedRec = recoveryScores.slice().sort((a,b)=>b-a);
  const top10pct = sortedRec.slice(0, Math.max(1, Math.floor(sortedRec.length * 0.1)));
  const top10avg = top10pct.reduce((a,b)=>a+b,0) / top10pct.length;
  const median   = sortedRec[Math.floor(sortedRec.length / 2)];

  console.log('\n══════════════════════════════════════════');
  console.log('  ABSOLUTE BUDGET ANCHOR');
  console.log('══════════════════════════════════════════');
  console.log(`Total days:              ${days.length}`);
  console.log(`Max recovery ever:       ${Math.max(...recoveryScores)}%`);
  console.log(`Top 10% avg recovery:    ${top10avg.toFixed(1)}% (her "recovered ceiling")`);
  console.log(`Median recovery:         ${median}%`);
  console.log(`Min recovery:            ${Math.min(...recoveryScores)}%`);

  // What PacePoints could she sustain at the top-10% recovery?
  // Visible's stated budget is 14 — assume that calibrates to her "average" state
  // If avg recovery = X% maps to budget = 14, then top recovery maps to 14 * (top/avg)
  const avgRec = recoveryScores.reduce((a,b)=>a+b,0) / recoveryScores.length;
  const ratio  = top10avg / avgRec;
  const optimalBudget = 14 * ratio;
  console.log(`\nAvg recovery:            ${avgRec.toFixed(1)}%`);
  console.log(`Top10/avg ratio:         ${ratio.toFixed(2)}x`);
  console.log(`Implied "optimal-state" budget: ${optimalBudget.toFixed(1)} pts`);

  // What about her "good day" feeling correlation? Pull check-in data
  const checkin = await db.collection('self_report').find({ user_id: { $in: USER_IDS } }).toArray();
  const goodDays = [];
  for (const c of checkin) {
    if (c.feeling === 'good' || c.feeling === 'mixed') {
      const dayData = byDate[c.date];
      if (dayData?.pace != null && dayData?.recovery != null) {
        goodDays.push({ date: c.date, feeling: c.feeling, pace: dayData.pace, recovery: dayData.recovery });
      }
    }
  }
  console.log('\n══════════════════════════════════════════');
  console.log('  PACEPOINTS ON GOOD/MIXED FEELING DAYS');
  console.log('══════════════════════════════════════════');
  if (goodDays.length > 0) {
    const goodPaces = goodDays.map(d => d.pace);
    const avgGoodPace = goodPaces.reduce((a,b)=>a+b,0) / goodPaces.length;
    const medGoodPace = goodPaces.slice().sort((a,b)=>a-b)[Math.floor(goodPaces.length/2)];
    console.log(`Days analyzed:           ${goodDays.length}`);
    console.log(`Avg PacePoints:          ${avgGoodPace.toFixed(1)}`);
    console.log(`Median PacePoints:       ${medGoodPace.toFixed(1)}`);
    console.log('\nSample:');
    goodDays.slice(0, 10).forEach(d => {
      console.log(`  ${d.date} (${d.feeling}): pace=${d.pace.toFixed(1)}, recovery=${d.recovery}%`);
    });
  }

  await client.close();
})().catch(e => { console.error(e); process.exit(1); });
