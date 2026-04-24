const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parse } = require('csv-parse');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const DB_NAME = 'cadence-dev';
const COLLECTION = 'self_report';
const PORT = 8765;
const DEFAULT_USER = 'hannah';

const app = express();
app.use(express.json());

// Multer: in-memory storage for CSV uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Named routes must come before static middleware
app.get('/dashboard', (req, res) => {
  res.redirect('/dashboard.html');
});

app.use(express.static(path.join(__dirname, 'prototype'), {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

let db;

async function connect() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB: ${DB_NAME}`);
}

// Helper: resolve user_id from query param (GET) or body (POST), default to hannah
function resolveUser(req) {
  const u = req.query.user || req.body?.user || DEFAULT_USER;
  // Allowlist to prevent arbitrary user injection
  const allowed = ['hannah', 'david'];
  return allowed.includes(u) ? u : DEFAULT_USER;
}

// POST /api/checkin — upsert by { user_id, date }
app.post('/api/checkin', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const { date, answers, submitted_at } = req.body;
    if (!date || !answers) return res.status(400).json({ error: 'Missing date or answers' });

    const now = new Date().toISOString();
    const filter = { user_id, date };
    const update = {
      $set: {
        user_id,
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
    console.log(`[${now}] Check-in saved: user=${user_id} date=${date}`);
    res.json({ ok: true, date, user_id });
  } catch (err) {
    console.error('Error saving check-in:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/checkin/status?days=7 — which days have entries? (must be before /:date)
app.get('/api/checkin/status', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const days = parseInt(req.query.days) || 7;
    // Use Eastern time for date boundaries
    const toEasternDate = (offsetDays = 0) => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const today = toEasternDate(0);
    const dates = Array.from({ length: days }, (_, i) => toEasternDate(i));
    const docs = await db.collection(COLLECTION)
      .find({ user_id, date: { $in: dates } }, { projection: { date: 1, feeling: 1 } })
      .toArray();
    const completed = {};
    docs.forEach(d => { completed[d.date] = d.feeling; });
    res.json({ completed, today, user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WHOOP user_id mapping
const WHOOP_USER_IDS = { hannah: 6729032, david: 206067 };

// GET /api/dashboard — aggregated data for past 3 days
app.get('/api/dashboard', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const whoopUserId = WHOOP_USER_IDS[user_id] || WHOOP_USER_IDS.hannah;

    // Use Eastern time (Hannah's timezone) for date boundaries
    const toEasternDate = (offsetDays = 0) => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    };
    // Fetch 4 days so the 3rd visible day has a previous day for trend arrows
    const dates = [0, 1, 2, 3].map(i => toEasternDate(i));

    // WHOOP — use mapped user id
    const whoopDocs = await db.collection('whoop_daily')
      .find({ user_id: whoopUserId, date: { $in: dates } })
      .toArray();
    const whoop = {};
    whoopDocs.forEach(w => { whoop[w.date] = w; });

    // Check-ins
    const checkinDocs = await db.collection('self_report')
      .find({ user_id, date: { $in: dates } })
      .toArray();
    const checkins = {};
    checkinDocs.forEach(c => { checkins[c.date] = c; });

    // Visible
    const visibleDocs = await db.collection('visible_daily')
      .find({ user_id, date: { $in: dates } })
      .toArray();
    const visible = {};
    visibleDocs.forEach(v => { visible[v.date] = v; });

    res.json({ whoop, checkins, visible, dates, user_id, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/checkin/:date — fetch stored answers for a specific date
app.get('/api/checkin/:date', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const { date } = req.params;
    const doc = await db.collection(COLLECTION).findOne({ user_id, date });
    if (!doc) return res.json({ found: false });
    res.json({ found: true, data: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/visible/upload — parse Visible CSV and upsert into visible_daily
app.post('/api/visible/upload', upload.single('file'), async (req, res) => {
  try {
    const user_id = resolveUser(req);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const csvText = req.file.buffer.toString('utf8');

    // Parse CSV
    const records = await new Promise((resolve, reject) => {
      parse(csvText, { columns: true, skip_empty_lines: true, trim: true }, (err, data) => {
        if (err) reject(err); else resolve(data);
      });
    });

    if (!records.length) return res.status(400).json({ error: 'Empty or invalid CSV' });

    // Group rows by observation_date
    const byDate = {};
    for (const row of records) {
      const date = row.observation_date;
      if (!date) continue;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        tracker_name: row.tracker_name,
        tracker_category: row.tracker_category,
        value: isNaN(row.observation_value) ? row.observation_value : parseFloat(row.observation_value),
      });
    }

    const dates = Object.keys(byDate);
    const now = new Date().toISOString();
    let upserted = 0, updated = 0;

    for (const date of dates) {
      const filter = { user_id, date };
      const update = {
        $set: {
          user_id,
          date,
          observations: byDate[date],
          updated_at: now,
          source: 'visible_csv_upload',
        },
        $setOnInsert: { imported_at: now }
      };
      const result = await db.collection('visible_daily').updateOne(filter, update, { upsert: true });
      if (result.upsertedCount) upserted++; else updated++;
    }

    console.log(`[${now}] Visible upload: ${dates.length} days, ${records.length} rows — ${upserted} new, ${updated} updated`);
    res.json({
      ok: true,
      days_imported: dates.length,
      rows: records.length,
      new_days: upserted,
      updated_days: updated,
      date_range: dates.length ? `${dates.sort()[0]} → ${dates.sort().slice(-1)[0]}` : null,
    });
  } catch (err) {
    console.error('Error processing Visible upload:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patterns — PEM risk detection for Hannah
app.get('/api/patterns', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const whoopUserId = 6729032;

    // Pull last 7 days of visible + whoop data
    const toEasternDate = (offsetDays = 0) => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().slice(0, 10);
    };
    const dates = [0,1,2,3,4,5,6].map(toEasternDate);
    const oldest = dates[dates.length - 1];

    const visibleDocs = await db.collection('visible_daily')
      .find({ user_id: whoopUserId, date: { $gte: oldest } })
      .toArray();
    const whoopDocs = await db.collection('whoop_daily')
      .find({ user_id: whoopUserId, date: { $gte: oldest } })
      .toArray();

    const vis = {};
    visibleDocs.forEach(d => { vis[d.date] = d; });
    const whoop = {};
    whoopDocs.forEach(d => { whoop[d.date] = d; });

    const alerts = [];
    const today = dates[0];
    const yesterday = dates[1];

    // Alert 1: Low HRV + prior active day
    const todayWhoop = whoop[today] || {};
    const yestVisible = vis[yesterday] || {};
    const todayHRV = todayWhoop.recovery?.score?.hrv_rmssd_milli
      || vis[today]?.measurements?.HRV;
    const yestActive = yestVisible.symptoms?.['Physically active']
      || yestVisible.measurements?.['Physically active'];
    const yestPacePoints = yestVisible.measurements?.PacePoints;

    if (todayHRV && todayHRV < 45 && yestActive >= 2) {
      alerts.push({
        level: 'warning',
        icon: '⚠️',
        title: `Low HRV (${Math.round(todayHRV)}ms) after active day`,
        body: `Yesterday: physically active=${yestActive}, PacePoints=${yestPacePoints ?? '—'}. HRV <45 + prior exertion = elevated PEM risk. Rest today.`,
      });
    } else if (todayHRV && todayHRV < 45) {
      alerts.push({
        level: 'warning',
        icon: '⚠️',
        title: `Low HRV today (${Math.round(todayHRV)}ms)`,
        body: `HRV below 45ms threshold. Monitor fatigue closely and keep activity minimal.`,
      });
    }

    // Alert 2: Consecutive high-fatigue days → crash risk
    const fatigue0 = vis[today]?.symptoms?.Fatigue || 0;
    const fatigue1 = vis[yesterday]?.symptoms?.Fatigue || 0;
    const fatigue2 = vis[dates[2]]?.symptoms?.Fatigue || 0;
    if (fatigue0 >= 2 && fatigue1 >= 2) {
      alerts.push({
        level: fatigue0 >= 3 ? 'critical' : 'warning',
        icon: fatigue0 >= 3 ? '🚨' : '⚠️',
        title: `Fatigue ≥2 for ${fatigue2 >= 2 ? '3+' : '2'} consecutive days`,
        body: `Fatigue scores: today=${fatigue0}, yesterday=${fatigue1}${fatigue2 >= 2 ? `, 2 days ago=${fatigue2}` : ''}. Crash risk is elevated. Strict rest protocol.`,
      });
    }

    // Alert 3: Crash flagged today or yesterday
    const crashToday = vis[today]?.experience?.Crash || 0;
    const crashYest = vis[yesterday]?.experience?.Crash || 0;
    if (crashToday) {
      alerts.push({
        level: 'critical',
        icon: '🚨',
        title: 'Crash reported today',
        body: 'Hannah flagged a crash in Visible today. Full rest — no exertion.',
      });
    } else if (crashYest) {
      alerts.push({
        level: 'warning',
        icon: '⚠️',
        title: 'Crash reported yesterday — recovery day',
        body: 'Post-crash recovery in progress. Expect low capacity today. Minimal activity.',
      });
    }

    // Alert 4: High PacePoints yesterday (over-exertion signal)
    if (yestPacePoints && yestPacePoints > 20) {
      alerts.push({
        level: 'warning',
        icon: '📊',
        title: `High PacePoints yesterday (${yestPacePoints})`,
        body: `Visible flagged exertion above pacing budget. Typical range is 5–15. Watch for delayed PEM in next 24–48h.`,
      });
    }

    // Summary status
    const hasCritical = alerts.some(a => a.level === 'critical');
    const hasWarning = alerts.some(a => a.level === 'warning');
    const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok';

    res.json({
      status,
      alerts,
      meta: {
        today,
        yesterday,
        todayHRV,
        yestActive,
        yestPacePoints,
        fatigue_today: fatigue0,
        fatigue_yesterday: fatigue1,
        crash_today: crashToday,
        crash_yesterday: crashYest,
      }
    });
  } catch (err) {
    console.error('Error in /api/patterns:', err);
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
