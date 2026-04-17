const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const DB_NAME = 'cadence-dev';
const COLLECTION = 'self_report';
const PORT = 8765;
const USER_ID = 'hannah'; // hardcoded for now; will come from auth later

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'prototype')));

let db;

async function connect() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB: ${DB_NAME}`);
}

// POST /api/checkin — upsert by { user_id, date }
app.post('/api/checkin', async (req, res) => {
  try {
    const { date, answers, submitted_at } = req.body;
    if (!date || !answers) return res.status(400).json({ error: 'Missing date or answers' });

    const now = new Date().toISOString();
    const filter = { user_id: USER_ID, date };
    const update = {
      $set: {
        user_id: USER_ID,
        date,
        updated_at: now,
        source: 'web',
        feeling:    answers.feeling,
        pem:        answers.pem,
        brain_fog:  answers.brain_fog,
        pain:       answers.pain,
        activity:   answers.activity,
        left_home:  answers.left_home,
        food:       answers.food,
        probiotics: answers.probiotics,
        notes:      answers.notes || null,
      },
      $setOnInsert: {
        submitted_at: submitted_at || now,
      }
    };

    await db.collection(COLLECTION).updateOne(filter, update, { upsert: true });
    console.log(`[${now}] Check-in saved: user=${USER_ID} date=${date}`);
    res.json({ ok: true, date, user_id: USER_ID });
  } catch (err) {
    console.error('Error saving check-in:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/checkin/status?days=7 — which days have entries?
app.get('/api/checkin/status', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    // Build date range: today back N days
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const docs = await db.collection(COLLECTION)
      .find({ user_id: USER_ID, date: { $in: dates } }, { projection: { date: 1, feeling: 1 } })
      .toArray();
    const completed = {};
    docs.forEach(d => { completed[d.date] = d.feeling; });
    res.json({ completed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

connect().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cadence server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
