#!/usr/bin/env python3
"""Generate Hannah HRV + spend chart as PNG."""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.dates as mdates
from datetime import datetime, timedelta
from pymongo import MongoClient

# MongoDB
uri = open('/home2/cleo/mongo_uri').read().strip()
client = MongoClient(uri)
db = client['cadence-dev']

start = '2026-04-15'
end   = '2026-05-05'

whoop_docs = list(db['whoop_daily'].find(
    {'user_id': 6729032, 'date': {'$gte': start, '$lte': end}},
    sort=[('date', 1)]
))
visible_docs = list(db['visible_daily'].find(
    {'user_id': 'hannah', 'date': {'$gte': start, '$lte': end}},
    sort=[('date', 1)]
))
checkins = list(db['self_report'].find(
    {'user_id': 'hannah', 'date': {'$gte': start, '$lte': end}},
    sort=[('date', 1)]
))
client.close()

vis_by_date = {d['date']: d for d in visible_docs}
ci_by_date  = {d['date']: d for d in checkins}

rows = []
for w in whoop_docs:
    date_str = w['date']
    hrv = w.get('recovery', {}).get('score', {}).get('hrv_rmssd_milli')
    strain = w.get('strain', {}).get('score', {}).get('strain')
    vis = vis_by_date.get(date_str, {})
    obs = vis.get('observations', [])
    pp = next((o['value'] for o in obs if o['tracker_name'] == 'PacePoints'), None)
    ci = ci_by_date.get(date_str, {})
    pem = ci.get('pem')
    feeling = ci.get('feeling')
    # Exclude outlier (Apr 18 pp=155)
    if pp and pp > 100:
        pp = None
    spend = (strain is not None and strain > 2)
    rows.append({
        'date': datetime.strptime(date_str, '%Y-%m-%d'),
        'hrv': hrv,
        'strain': strain,
        'pp': pp,
        'pem': pem,
        'feeling': feeling,
        'spend': spend,
    })

dates   = [r['date'] for r in rows]
hrvs    = [r['hrv'] for r in rows]

# ── Plot ──────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
fig.patch.set_facecolor('#0d1520')
ax.set_facecolor('#111d2b')

# HRV line
valid = [(d, h) for d, h in zip(dates, hrvs) if h is not None]
vdates, vhrvs = zip(*valid) if valid else ([], [])
ax.plot(vdates, vhrvs, color='#5bc8e8', linewidth=2.5, zorder=3, label='HRV (ms)')
ax.fill_between(vdates, vhrvs, alpha=0.07, color='#5bc8e8')

# Threshold line
ax.axhline(34, color='#3a5a78', linewidth=1.2, linestyle='--', alpha=0.7, label='Threshold (34ms)')

# Spend markers — red triangles below the HRV point
for r in rows:
    if r['spend'] and r['hrv'] is not None:
        ax.scatter(r['date'], r['hrv'] - 1.5, marker='v', color='#e05a5a',
                   s=80, zorder=5, linewidths=0)

# Severe PEM — yellow diamonds at y=20
for r in rows:
    if r['pem'] == 'severe':
        ax.scatter(r['date'], 20, marker='D', color='#f0c040',
                   s=50, zorder=4, linewidths=0, alpha=0.85)

# Good feeling — green dot on the line
for r in rows:
    if r['feeling'] == 'good' and r['hrv'] is not None:
        ax.scatter(r['date'], r['hrv'], marker='o', color='#4caf7d',
                   s=90, zorder=6, linewidths=0)

# Spend day shading
for r in rows:
    if r['spend']:
        ax.axvspan(r['date'] - timedelta(hours=12),
                   r['date'] + timedelta(hours=12),
                   alpha=0.07, color='#e05a5a', zorder=1)

# Axes styling
ax.set_ylim(17, 50)
ax.xaxis.set_major_formatter(mdates.DateFormatter('%-m/%-d'))
ax.xaxis.set_major_locator(mdates.DayLocator(interval=2))
plt.xticks(rotation=45, ha='right', color='#5a7a98', fontsize=9)
plt.yticks(color='#5a7a98', fontsize=9)
ax.set_ylabel('HRV rMSSD (ms)', color='#5a7a98', fontsize=10)
ax.tick_params(colors='#5a7a98')
for spine in ax.spines.values():
    spine.set_edgecolor('#1e2d3d')
ax.grid(axis='y', color='#1e2d3d', linewidth=0.7)
ax.grid(axis='x', color='#1e2d3d', linewidth=0.4, alpha=0.5)

# Title
ax.set_title('Hannah — HRV & WHOOP Strain Spend  ·  Apr 15 – May 5, 2026',
             color='#c9a84c', fontsize=12, fontweight='bold', pad=12)

# Legend
legend_items = [
    mpatches.Patch(color='#5bc8e8', label='HRV (ms)'),
    mpatches.Patch(color='#3a5a78', label='Threshold 34ms', alpha=0.7),
    plt.Line2D([0],[0], marker='v', color='w', markerfacecolor='#e05a5a', markersize=9, label='Spend (strain >2)'),
    plt.Line2D([0],[0], marker='D', color='w', markerfacecolor='#f0c040', markersize=8, label='Severe PEM'),
    plt.Line2D([0],[0], marker='o', color='w', markerfacecolor='#4caf7d', markersize=9, label='Feeling good'),
]
ax.legend(handles=legend_items, loc='upper right', facecolor='#111d2b',
          edgecolor='#1e2d3d', labelcolor='#7a9ab8', fontsize=9)

plt.tight_layout()
out = '/home2/cleo/.openclaw/workspace/hannah_hrv_spend.png'
plt.savefig(out, dpi=150, facecolor=fig.get_facecolor())
plt.close()
print(f'Saved: {out}')
