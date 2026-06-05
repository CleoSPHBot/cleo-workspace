#!/usr/bin/env node
// Pull full self-report fields for the window
const { MongoClient } = require('/home2/cleo/.openclaw/workspace/projects/cadence/node_modules/mongodb');
const fs = require('fs');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db('cadence-dev');
    const checkins = db.collection('self_report');
    
    const reports = await checkins.find({
      user_id: 'hannah',
      date: { $gte: '2026-05-22', $lte: '2026-06-04' }
    }).sort({ date: 1 }).toArray();
    
    for (const r of reports) {
      console.log(`\n${r.date}:`);
      console.log(`  feeling: ${r.feeling}  brain_fog: ${r.brain_fog}  activity: ${r.activity}`);
      console.log(`  pain: ${r.pain}  left_home: ${r.left_home}  hours_upright: ${r.hours_upright}`);
      console.log(`  notes: ${r.notes || '(none)'}`);
    }
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
