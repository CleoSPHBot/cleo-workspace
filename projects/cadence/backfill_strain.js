/**
 * backfill_strain.js
 * Fetches WHOOP cycle/strain data for all dates in whoop_daily that are missing strain,
 * then updates each doc with { strain: { score: { strain, kilojoule, average_heart_rate, max_heart_rate } } }
 *
 * Uses: GET /developer/v1/cycle?limit=25&nextToken=...
 * Matches cycles to dates by cycle start time (Eastern date).
 */

const { MongoClient } = require('mongodb');
const https = require('https');
const fs = require('fs');

const MONGO_URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();
const DB_NAME   = 'cadence-dev';
const WHOOP_BASE = 'api.prod.whoop.com';
const CLIENT_ID     = '82c7e662-e8cd-419b-9159-a15ba0fcdd3d';
const CLIENT_SECRET = '91b7f6e9fdea816f9fd113b989295ea1a4566dce71a2bb86bc31a66c6eadc6cd';

function toEasternDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function whoopGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: WHOOP_BASE,
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`WHOOP ${res.statusCode}: ${body}`));
        try { resolve(JSON.parse(body)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function refreshToken(db, user) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: user.refresh_token,
    scope: user.scope,
  }).toString();

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: WHOOP_BASE,
      path: '/oauth/oauth2/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', async () => {
        const json = JSON.parse(data);
        if (json.access_token) {
          const now = new Date().toISOString();
          await db.collection('user').updateOne(
            { user_id: user.user_id },
            { $set: { access_token: json.access_token, refresh_token: json.refresh_token, last_updated: now } }
          );
          console.log(`  Refreshed token for user ${user.user_id}`);
          resolve(json.access_token);
        } else {
          reject(new Error(`Token refresh failed: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchAllCycles(token) {
  const cycles = [];
  let nextToken = null;
  do {
    const qs = nextToken ? `?limit=25&nextToken=${encodeURIComponent(nextToken)}` : '?limit=25';
    const resp = await whoopGet(`/developer/v1/cycle${qs}`, token);
    cycles.push(...(resp.records || []));
    nextToken = resp.next_token || null;
    if (nextToken) await new Promise(r => setTimeout(r, 300)); // rate limit
  } while (nextToken);
  return cycles;
}

async function backfillUser(db, user) {
  console.log(`\n── User ${user.user_id} (${user.first_name}) ──`);

  // Refresh token first
  let token;
  try { token = await refreshToken(db, user); }
  catch(e) { console.warn('  Token refresh failed, using existing:', e.message); token = user.access_token; }

  // Find whoop_daily docs missing strain for this user
  const docs = await db.collection('whoop_daily')
    .find({ user_id: user.user_id, strain: { $exists: false } })
    .sort({ date: -1 })
    .toArray();

  if (!docs.length) { console.log('  No docs missing strain — skipping'); return; }
  console.log(`  ${docs.length} docs missing strain`);

  const missingDates = new Set(docs.map(d => d.date));

  // Fetch all cycles from WHOOP
  console.log('  Fetching cycles from WHOOP...');
  let cycles;
  try { cycles = await fetchAllCycles(token); }
  catch(e) { console.error('  Failed to fetch cycles:', e.message); return; }
  console.log(`  Got ${cycles.length} cycles`);

  // Map cycles to Eastern dates
  const cycleByDate = {};
  for (const cycle of cycles) {
    const date = toEasternDate(cycle.start);
    if (missingDates.has(date)) {
      cycleByDate[date] = cycle;
    }
  }

  // Update MongoDB
  let updated = 0, skipped = 0;
  for (const date of missingDates) {
    const cycle = cycleByDate[date];
    if (!cycle?.score) { skipped++; continue; }

    const strainData = {
      id: cycle.id,
      score: {
        strain:              cycle.score.strain,
        kilojoule:           cycle.score.kilojoule,
        average_heart_rate:  cycle.score.average_heart_rate,
        max_heart_rate:      cycle.score.max_heart_rate,
      },
      start: cycle.start,
      end:   cycle.end,
    };

    await db.collection('whoop_daily').updateOne(
      { user_id: user.user_id, date },
      { $set: { strain: strainData, updated_at: new Date().toISOString() } }
    );
    console.log(`  ✓ ${date} — strain: ${cycle.score.strain?.toFixed(1)} | kJ: ${cycle.score.kilojoule?.toFixed(0)}`);
    updated++;
  }

  console.log(`  Done: ${updated} updated, ${skipped} skipped (no cycle data)`);
}

async function main() {
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db(DB_NAME);

  const users = await db.collection('user').find({}).toArray();
  for (const user of users) {
    await backfillUser(db, user);
  }

  await client.close();
  console.log('\nBackfill complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
