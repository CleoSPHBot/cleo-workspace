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

// Reliable Pacific date helper — uses en-CA locale for YYYY-MM-DD output directly
function pacificDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

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

// ── SSE client registry ───────────────────────────────────────────────────
const sseClients = new Map(); // user_id → Set of response objects

function sseAdd(user_id, res) {
  if (!sseClients.has(user_id)) sseClients.set(user_id, new Set());
  sseClients.get(user_id).add(res);
}
function sseRemove(user_id, res) {
  sseClients.get(user_id)?.delete(res);
}
function sseNotify(user_id, type, payload = {}) {
  const clients = sseClients.get(user_id);
  if (!clients?.size) return;
  const data = JSON.stringify({ type, ...payload, ts: Date.now() });
  clients.forEach(res => { try { res.write(`data: ${data}\n\n`); } catch(e) {} });
  console.log(`[SSE] notify user=${user_id} type=${type} clients=${clients.size}`);
}

async function connect() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`Connected to MongoDB: ${DB_NAME}`);
  watchCollections(client);
}

// ── MongoDB Change Streams ─────────────────────────────────────────────────
// Watches whoop_daily and visible_daily for external writes (Lambda, backfill)
// and fans out SSE events to all connected clients for that user.
function watchCollections(client) {
  const watchDb = client.db(DB_NAME);

  // Watch whoop_daily
  const whoopStream = watchDb.collection('whoop_daily').watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace'] } } }],
    { fullDocument: 'updateLookup' }
  );
  whoopStream.on('change', (change) => {
    const doc = change.fullDocument;
    if (!doc) return;
    // Map numeric user_id to string user_id for SSE
    const uid = Object.entries(WHOOP_USER_IDS).find(([, v]) => v === doc.user_id)?.[0];
    if (uid) {
      console.log(`[ChangeStream] whoop_daily updated: user=${uid} date=${doc.date}`);
      sseNotify(uid, 'whoop', { date: doc.date });
    }
  });
  whoopStream.on('error', (e) => console.error('[ChangeStream] whoop_daily error:', e.message));

  // Watch visible_daily
  const visibleStream = watchDb.collection('visible_daily').watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace'] } } }],
    { fullDocument: 'updateLookup' }
  );
  visibleStream.on('change', (change) => {
    const doc = change.fullDocument;
    if (!doc) return;
    const uid = typeof doc.user_id === 'string' ? doc.user_id :
      Object.entries(WHOOP_USER_IDS).find(([, v]) => v === doc.user_id)?.[0];
    if (uid) {
      console.log(`[ChangeStream] visible_daily updated: user=${uid} date=${doc.date}`);
      sseNotify(uid, 'visible', { date: doc.date });
    }
  });
  visibleStream.on('error', (e) => console.error('[ChangeStream] visible_daily error:', e.message));

  console.log('Change streams active: whoop_daily, visible_daily');
}

// Helper: resolve user_id from query param (GET) or body (POST), default to hannah
function resolveUser(req) {
  const u = req.query.user || req.body?.user || DEFAULT_USER;
  // Allowlist to prevent arbitrary user injection
  const allowed = ['hannah', 'david'];
  return allowed.includes(u) ? u : DEFAULT_USER;
}

// POST /api/notify — internal webhook for Lambda → SSE fan-out
// Lambda calls this after writing to whoop_daily
app.post('/api/notify', (req, res) => {
  const { user_id, type, payload } = req.body || {};
  if (!user_id || !type) return res.status(400).json({ error: 'Missing user_id or type' });
  sseNotify(user_id, type, payload || {});
  res.json({ ok: true });
});

// GET /api/events — Server-Sent Events stream
app.get('/api/events', (req, res) => {
  const user_id = resolveUser(req);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': connected\n\n'); // initial comment to open the stream
  sseAdd(user_id, res);
  req.on('close', () => sseRemove(user_id, res));
});

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
        feeling:      answers.feeling,
        pem:          answers.pem,
        brain_fog:    answers.brain_fog,
        pain:         answers.pain,
        activity:     answers.activity,
        left_home:    answers.left_home,
        food:         answers.food,
        probiotics:   answers.probiotics,
        stimulants:   answers.stimulants  ?? null,
        compression:  answers.compression ?? null,
        sodium_goal:  answers.sodium_goal ?? null,
        hours_upright: answers.hours_upright ?? null,
        ...(answers.notes !== undefined && answers.notes !== null ? { notes: answers.notes } : {}),
      },
      $setOnInsert: {
        submitted_at: submitted_at || now,
      }
    };

    await db.collection(COLLECTION).updateOne(filter, update, { upsert: true });
    console.log(`[${now}] Check-in saved: user=${user_id} date=${date}`);
    sseNotify(user_id, 'checkin', { date });
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
    const today = pacificDate(0);
    const dates = Array.from({ length: days }, (_, i) => pacificDate(i));
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

    // Fetch 5 days so the 3rd day has a previous day for trend arrows
    const dates = [0, 1, 2, 3, 4].map(i => pacificDate(i));

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

    // Meds (last 5 days)
    const medsDocs = await db.collection('med_log')
      .find({ user_id, date: { $in: dates } })
      .toArray();
    const meds = {};
    medsDocs.forEach(m => {
      if (!meds[m.date]) meds[m.date] = {};
      meds[m.date][m.med] = m.count;
    });

    res.json({ whoop, checkins, visible, meds, dates, user_id, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Meds tracker ───────────────────────────────────────────────────────────
// Hannah's med list (canonical keys)
const MED_LIST = [
  { key: 'aleve',      label: 'Aleve',         note: 'naproxen 220 mg' },
  { key: 'aleve_pm',   label: 'Aleve PM',      note: 'naproxen + diphenhydramine' },
  { key: 'allegra',    label: 'Allegra',       note: 'fexofenadine — antihistamine' },
  { key: 'libertrim',  label: 'Libertrim',     note: 'antidiarrheal' },
  { key: 'plidan',     label: 'Plidan',        note: 'cramps + bloating' },
  { key: 'adderall',   label: 'Adderall',      note: 'stimulant' },
  { key: 'melatonin',  label: 'Melatonin',     note: '5 mg — sleep' },
  { key: 'tylenol',    label: 'Tylenol',       note: 'acetaminophen' },
  { key: 'd3_k2_coq10', label: 'Cymbiotika D3+K2+CoQ10', note: 'fat-soluble vitamins + CoQ10' },
  { key: 'colostrum',   label: 'Cymbiotika Colostrum',   note: 'liquid colostrum — immune + gut' },
  { key: 'magnesium',   label: 'Cymbiotika Magnesium Complex', note: 'magnesium — sleep + muscle' },
  { key: 'vitamin_c',   label: 'Aurora Liposomal Vitamin C',  note: 'liposomal vitamin C — immune' },
  { key: 'nad_plus',         label: 'Cymbiotika NAD+',            note: 'NAD+ — cellular energy' },
  { key: 'glutathione',      label: 'Cymbiotika Glutathione',     note: 'master antioxidant' },
  { key: 'mag_glycinate',    label: 'Magnesium Glycinate',        note: '120 mg — sleep + calm' },
  { key: 'propranolol',      label: 'Propranolol',                note: '10 mg — heart rate / dysautonomia' },
  { key: 'precision_hydro',  label: 'Precision Hydration 1000s', note: 'electrolytes — POTS/dysautonomia' },
  { key: 'gut_peptide_blend', label: 'BPC-157 / TB-500 / KPV / Larazotide', note: 'gut healing + tissue repair blend (1 pill) — daily 30 min before breakfast, 12 weeks' },
  { key: 'thymosin',         label: 'Thymosin Alpha 1',          note: 'immune modulation + antiviral — 0.25 mL injection, Mon & Thu, 12 weeks' },
  { key: 'motc',             label: 'MOTS-C',                    note: 'mitochondrial energy + metabolic repair — 50 cc injection, weekly, 12 weeks' },
  { key: 'ss31',             label: 'SS-31',                     note: 'mitochondrial protection + energy — 10 cc, daily, 20 days' },
  { key: 'zyrtec',           label: 'Zyrtec',                    note: 'cetirizine — antihistamine' },
  { key: 'vagus_nerve',      label: 'Pulsetto',                  note: '10 min — vagus nerve stimulation' },
  { key: 'oxygen_conc',      label: 'Oxygen Concentrator',       note: '30 min — oxygenation' },
  { key: 'tart_cherry',      label: 'Tart Cherry Juice',         note: 'anti-inflammatory + sleep' },
  { key: 'creatine',         label: 'Creatine',                  note: 'cellular energy + muscle' },
  { key: 'body_shower',      label: 'Body Shower',               note: 'hygiene / self-care' },
  { key: 'hair_shower',      label: 'Hair Shower',               note: 'hygiene / self-care' },
  { key: 'bath',             label: 'Bath',                      note: 'rest + recovery' },
  { key: 'ldn',              label: 'LDN',                       note: 'low dose naltrexone 4.5 mg — neuroinflammation' },
  { key: 'famotidine',       label: 'Pepcid',                    note: 'famotidine — H2 blocker / MCAS' },
  { key: 'zinc',             label: 'Zinc',                      note: '15 mg — immune + antiviral' },
  { key: 'gniib',            label: 'G-NiiB Elite Probiotic',    note: 'sachet — gut microbiome restoration' },
  { key: 'vitassium',        label: 'Vitassium Electrolytes',    note: '375 mg sodium — POTS/dysautonomia' },
  { key: 'nad_nasal',        label: 'NAD Nasal Spray 500mg',     note: 'cellular energy + brain fog — 2 sprays morning + midday, 12 weeks' },
  { key: 'semax_selan',      label: 'SEMÁX + SELAN Nasal Spray', note: 'cognitive function + neuroprotection — 2 sprays each nostril, morning + midday, avoid after 4pm, 14 days' },
  { key: 'disp',             label: 'DISP 8mg Nasal Spray',      note: 'sleep support — 2 sprays alternating nostrils, 15–30 min before sleep, 3 months' },
  { key: 'urolithin_a',      label: 'Timeline Urolithin A',      note: 'mitophagy + cellular cleanup — 2 gummies/day' },
  { key: 'd_ribose',         label: 'D-Ribose',                  note: 'cellular energy + fatigue recovery — 1 scoop' },
  { key: 'armour_thyroid',   label: 'Armour Thyroid 15mg',       note: 'thyroid support + energy — empty stomach, 1 hr before breakfast, 8 weeks' },
  { key: 'dhea',             label: 'DHEA 10mg',                 note: 'hormone balance + adrenal support — with food, morning, 12 weeks' },
  { key: 'lactoferrin',      label: 'Life Extension Lactoferrin', note: 'immune defense + gut health — 2 capsules/day, 12 weeks' },
  { key: 'omega_epadha',     label: 'Metagenics OmegaGenics EPA-DHA 2400mg', note: 'inflammation + brain health — 5 mL morning + night, 12 weeks' },
  { key: 'lemon_balm',       label: 'Vimergy Lemon Balm Extract', note: 'nervous system calm + sleep — evenings with drink, 3 months' },
  { key: 'vit_d3k2',         label: 'ProHealth Vitamin D3 K2 5000IU', note: 'immune + bone health — 1 capsule with breakfast, 12 weeks' },
  { key: 'icell_water',      label: 'NuBioAge iCell Water',      note: 'cellular hydration + recovery — 2 scoops' },
  { key: 'nicotine_patch',   label: 'Nicotine Patch',             note: 'spike protein clearance — apply morning, remove after 16h, do not sleep in patch' },
  { key: 'red_light',        label: 'Red Light Therapy',          note: 'mitochondrial support + neuroinflammation — as needed' },
  { key: 'vibration_plate',  label: 'Vibration Plate',            note: '10 min — lymphatic + circulation support' },
  { key: 'gi_detox',         label: 'G.I. Detox+',               note: 'toxin binding + gut detox — 1 capsule on empty stomach' },
  { key: 'sauerkraut',       label: 'Sauerkraut',                note: 'gut microbiome + probiotics' },
  { key: 'pendulum_poly',    label: 'Pendulum Polyphenol Booster', note: 'polyphenols — gut microbiome + anti-inflammatory' },
  { key: 'pendulum_meta',    label: 'Pendulum Metabolic Daily',  note: 'metabolic health + gut microbiome' },
  { key: 'pendulum_fuel',    label: 'Pendulum Gut Fuel',         note: 'gut lining + microbiome nourishment' },
  { key: 'fiberblend',       label: 'Thorne FiberBlend Prebiotic', note: 'prebiotic fiber — gut microbiome + motility' },
  { key: 'matcha',           label: 'Matcha',                    note: 'polyphenols + antioxidants — anti-inflammatory' },
  { key: 'bone_broth',       label: 'Bone Broth',                note: 'collagen + glycine — gut lining repair' },
  { key: 'manuka_honey',     label: 'Manuka Honey',              note: 'antimicrobial + gut soothing' },
];
const MED_KEYS = new Set(MED_LIST.map(m => m.key));

// GET /api/meds/list — return the active med catalog
app.get('/api/meds/list', (req, res) => {
  res.json({ meds: MED_LIST });
});

// GET /api/meds?date=YYYY-MM-DD — fetch counts for one day
app.get('/api/meds', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const date = req.query.date || pacificDate(0);
    const docs = await db.collection('med_log').find({ user_id, date }).toArray();
    const counts = {};
    docs.forEach(d => { counts[d.med] = d.count; });
    res.json({ user_id, date, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meds/set — set absolute count for { med, date, count }
app.post('/api/meds/set', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const { med, date, count } = req.body || {};
    if (!med || !MED_KEYS.has(med)) return res.status(400).json({ error: 'invalid med' });
    const d = date || pacificDate(0);
    const c = Math.max(0, Math.min(50, parseInt(count, 10) || 0));
    const now = new Date();
    if (c === 0) {
      // Delete row when count is 0 to keep the collection sparse
      await db.collection('med_log').deleteOne({ user_id, date: d, med });
    } else {
      await db.collection('med_log').updateOne(
        { user_id, date: d, med },
        { $set: { user_id, date: d, med, count: c, updated_at: now } },
        { upsert: true }
      );
    }
    sseNotify(user_id, 'meds', { date: d, med, count: c });
    res.json({ ok: true, user_id, date: d, med, count: c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meds/inc — increment by delta { med, date, delta }
app.post('/api/meds/inc', async (req, res) => {
  try {
    const user_id = resolveUser(req);
    const { med, date, delta } = req.body || {};
    if (!med || !MED_KEYS.has(med)) return res.status(400).json({ error: 'invalid med' });
    const d = date || pacificDate(0);
    const delt = Math.max(-10, Math.min(10, parseInt(delta, 10) || 0));
    const now = new Date();
    const existing = await db.collection('med_log').findOne({ user_id, date: d, med });
    const newCount = Math.max(0, Math.min(50, (existing?.count || 0) + delt));
    if (newCount === 0) {
      await db.collection('med_log').deleteOne({ user_id, date: d, med });
    } else {
      await db.collection('med_log').updateOne(
        { user_id, date: d, med },
        { $set: { user_id, date: d, med, count: newCount, updated_at: now } },
        { upsert: true }
      );
    }
    sseNotify(user_id, 'meds', { date: d, med, count: newCount });
    res.json({ ok: true, user_id, date: d, med, count: newCount });
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
    sseNotify(user_id, 'visible', { days: dates.length });
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
    const dates = [0,1,2,3,4,5,6].map(pacificDate);
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

// ── Supplement Correlation API ──────────────────────────────────────────────
app.get('/api/supplement-correlations', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const lag = parseInt(req.query.lag || '2');

    const feelingScore = { 'good': 3, 'mixed': 2, 'bad': 1 };
    const pemScore    = { 'none': 3, 'mild': 2, 'moderate': 1.5, 'severe': 1 };
    const fogScore    = { 'none': 3, 'mild': 2, 'moderate': 1.5, 'severe': 1 };

    const reports = await db.collection('self_report')
      .find({ user_id: 'hannah', feeling: { $ne: null } })
      .sort({ date: 1 })
      .toArray();

    const meds = await db.collection('med_log')
      .find({ user_id: 'hannah' })
      .sort({ date: 1 })
      .toArray();

    // Build maps
    const medsByDate = {};
    meds.forEach(m => {
      if (!medsByDate[m.date]) medsByDate[m.date] = [];
      medsByDate[m.date].push(m.med);
    });

    const scoreByDate = {};
    reports.forEach(r => {
      const scores = [];
      if (r.feeling && feelingScore[r.feeling]) scores.push(feelingScore[r.feeling]);
      if (r.pem    && pemScore[r.pem])          scores.push(pemScore[r.pem]);
      if (r.brain_fog && fogScore[r.brain_fog]) scores.push(fogScore[r.brain_fog]);
      if (scores.length > 0)
        scoreByDate[r.date] = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    const dates    = Object.keys(scoreByDate).sort();
    const medNames = [...new Set(meds.map(m => m.med))];

    const results = [];
    medNames.forEach(med => {
      const withMed = [], withoutMed = [];
      dates.forEach(date => {
        const d = new Date(date);
        d.setDate(d.getDate() - lag);
        const lagDate = d.toISOString().split('T')[0];
        const score = scoreByDate[date];
        if (score === undefined) return;
        const took = medsByDate[lagDate] && medsByDate[lagDate].includes(med);
        if (took) withMed.push(score);
        else       withoutMed.push(score);
      });
      if (withMed.length >= 5 && withoutMed.length >= 3) {
        const avgWith    = withMed.reduce((a, b) => a + b, 0) / withMed.length;
        const avgWithout = withoutMed.reduce((a, b) => a + b, 0) / withoutMed.length;
        results.push({
          med,
          avgWith:    parseFloat(avgWith.toFixed(2)),
          avgWithout: parseFloat(avgWithout.toFixed(2)),
          diff:       parseFloat((avgWith - avgWithout).toFixed(2)),
          n:          withMed.length,
          totalDays:  dates.length,
        });
      }
    });

    results.sort((a, b) => b.diff - a.diff);
    res.json({ lag, totalDays: dates.length, results });
  } catch (err) {
    console.error('Error in /api/supplement-correlations:', err);
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
