#!/usr/bin/env python3
"""
backfill_strain.py
Fetches WHOOP v1 cycle/strain data for all whoop_daily docs missing strain.
"""

import os, sys, time, json, argparse
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import requests
from pymongo import MongoClient

MONGO_URI   = open('/home2/cleo/mongo_uri').read().strip()
DB_NAME     = 'cadence-dev'
TOKEN_URL   = 'https://api.prod.whoop.com/oauth/oauth2/token'
CYCLE_URL   = 'https://api.prod.whoop.com/developer/v1/cycle'
CLIENT_ID   = '82c7e662-e8cd-419b-9159-a15ba0fcdd3d'
CLIENT_SECRET = '91b7f6e9fdea816f9fd113b989295ea1a4566dce71a2bb86bc31a66c6eadc6cd'

def to_eastern_date(iso_str):
    from datetime import timezone as tz
    import datetime as dt
    # Parse ISO and convert to Eastern
    ts = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
    eastern = ts.astimezone(tz(dt.timedelta(hours=-4)))  # EDT
    return eastern.strftime('%Y-%m-%d')

def refresh_token(db, user):
    scope = user.get('scope', '')
    data = {
        'grant_type': 'refresh_token',
        'refresh_token': user['refresh_token'],
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'scope': quote(scope, safe=''),
    }
    resp = requests.post(TOKEN_URL, data=data, headers={
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
    })
    j = resp.json()
    if 'access_token' not in j:
        raise Exception(f"Token refresh failed: {j}")
    now = datetime.now(timezone.utc).isoformat()
    db['user'].update_one(
        {'user_id': user['user_id']},
        {'$set': {'access_token': j['access_token'], 'refresh_token': j['refresh_token'], 'last_updated': now}}
    )
    print(f"  Token refreshed for user {user['user_id']}")
    return j['access_token']

def fetch_cycles(token, start_date=None):
    """Fetch all cycles, paginating until done or start_date is passed."""
    cycles = []
    next_token = None
    page = 0
    while True:
        params = {'limit': 25}
        if next_token:
            params['nextToken'] = next_token
        resp = requests.get(CYCLE_URL, headers={'Authorization': f'Bearer {token}'}, params=params)
        if resp.status_code == 429:
            print("  Rate limited — waiting 10s...")
            time.sleep(10)
            continue
        if resp.status_code != 200:
            raise Exception(f"WHOOP {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        records = data.get('records', [])
        cycles.extend(records)
        next_token = data.get('next_token')
        page += 1
        print(f"  Page {page}: {len(records)} cycles (total: {len(cycles)})")
        if not next_token:
            break
        # Stop early if we've gone past start_date
        if start_date and records:
            oldest = records[-1].get('start', '')
            if oldest and oldest[:10] < start_date:
                print(f"  Reached start_date {start_date}, stopping.")
                break
        time.sleep(0.3)
    return cycles

def backfill_user(db, user):
    uid = user['user_id']
    print(f"\n── User {uid} ({user.get('first_name', '?')}) ──")

    try:
        token = refresh_token(db, user)
    except Exception as e:
        print(f"  Token refresh failed: {e}, using cached token")
        token = user['access_token']

    # Find docs missing strain (optionally limited to last N days)
    query = {'user_id': uid, 'strain': {'$exists': False}}
    if args.days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime('%Y-%m-%d')
        query['date'] = {'$gte': cutoff}
    missing = list(db['whoop_daily'].find(query, {'date': 1}).sort('date', -1))

    if not missing:
        print("  No docs missing strain.")
        return

    missing_dates = {d['date'] for d in missing}
    oldest_date = min(missing_dates)
    print(f"  {len(missing_dates)} dates missing strain (oldest: {oldest_date})")

    print("  Fetching cycles from WHOOP...")
    try:
        cycles = fetch_cycles(token, start_date=oldest_date)
    except Exception as e:
        print(f"  ERROR fetching cycles: {e}")
        return

    # Map cycles to Eastern dates
    cycle_by_date = {}
    for c in cycles:
        if c.get('start'):
            date = to_eastern_date(c['start'])
            cycle_by_date[date] = c

    print(f"  Mapped {len(cycle_by_date)} cycle dates from WHOOP")

    # Update MongoDB
    updated = skipped = 0
    now = datetime.now(timezone.utc).isoformat()
    for date in sorted(missing_dates, reverse=True):
        cycle = cycle_by_date.get(date)
        if not cycle or not cycle.get('score'):
            skipped += 1
            continue
        score = cycle['score']
        strain_data = {
            'id': cycle.get('id'),
            'score': {
                'strain':             score.get('strain'),
                'kilojoule':          score.get('kilojoule'),
                'average_heart_rate': score.get('average_heart_rate'),
                'max_heart_rate':     score.get('max_heart_rate'),
            },
            'start': cycle.get('start'),
            'end':   cycle.get('end'),
        }
        db['whoop_daily'].update_one(
            {'user_id': uid, 'date': date},
            {'$set': {'strain': strain_data, 'updated_at': now}}
        )
        s = score.get('strain')
        print(f"  ✓ {date} — strain: {s:.1f}" if s else f"  ✓ {date} — strain: null")
        updated += 1

    print(f"  Done: {updated} updated, {skipped} skipped (no cycle data)")

def main():
    global args
    parser = argparse.ArgumentParser(description='Backfill WHOOP strain data')
    parser.add_argument('--days', type=int, default=None,
                        help='Only backfill last N days (default: all missing)')
    args = parser.parse_args()

    if args.days:
        print(f'Backfilling strain for last {args.days} days...')
    else:
        print('Backfilling all missing strain data...')

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    users = list(db['user'].find({}))
    for user in users:
        backfill_user(db, user)
    client.close()
    print("\nBackfill complete.")

if __name__ == '__main__':
    main()
