#!/usr/bin/env python3
"""Generate a preview mockup of the crash line status bar."""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch

fig, axes = plt.subplots(1, 3, figsize=(13, 3.5))
fig.patch.set_facecolor('#0d1520')

states = [
    {
        'state': 'above',
        'bg': '#0f2d1f',
        'border': '#4caf7d',
        'icon': '●',
        'title': 'Above the crash line',
        'title_color': '#4caf7d',
        'detail': 'HRV and activity levels are in\nthe repair zone. Keep it here.',
        'hrv': '33ms', 'hrv_c': '#4caf7d',
        'pp': '1.5',   'pp_c':  '#4caf7d',
        'strain': '0.6', 'strain_c': '#4caf7d',
    },
    {
        'state': 'borderline',
        'bg': '#2a1f0a',
        'border': '#f0c040',
        'icon': '●',
        'title': 'On the line',
        'title_color': '#f0c040',
        'detail': 'Close to the edge. Stay\nconservative — don\'t spend today.',
        'hrv': '33ms', 'hrv_c': '#f0c040',
        'pp': '5.8',   'pp_c':  '#4caf7d',
        'strain': '1.8', 'strain_c': '#4caf7d',
    },
    {
        'state': 'below',
        'bg': '#2d0f0f',
        'border': '#e05a5a',
        'icon': '●',
        'title': 'Below the crash line',
        'title_color': '#e05a5a',
        'detail': 'One or more signals in crash\nrisk territory. Full rest today.',
        'hrv': '29ms', 'hrv_c': '#e05a5a',
        'pp': '10.5',  'pp_c':  '#e05a5a',
        'strain': '3.2', 'strain_c': '#e05a5a',
    },
]

for ax, s in zip(axes, states):
    ax.set_facecolor(s['bg'])
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # Border
    for spine in ax.spines.values():
        spine.set_visible(True)
        spine.set_edgecolor(s['border'])
        spine.set_linewidth(2)

    # Icon + title
    ax.text(0.4, 8.5, s['icon'], fontsize=22, va='top', color=s['title_color'])
    ax.text(1.8, 9.1, s['title'], color=s['title_color'],
            fontsize=11, fontweight='bold', va='top')
    ax.text(1.8, 7.8, s['detail'], color='#7a9ab8',
            fontsize=8.5, va='top', linespacing=1.5)

    # Metric pills
    metrics = [
        ('HRV', s['hrv'], s['hrv_c']),
        ('PacePoints', s['pp'], s['pp_c']),
        ('Strain', s['strain'], s['strain_c']),
    ]
    pill_x = [0.3, 3.6, 6.9]
    for (label, val, col), x in zip(metrics, pill_x):
        pill = FancyBboxPatch((x, 1.0), 2.8, 3.2,
                              boxstyle='round,pad=0.1',
                              facecolor='#0d1520', edgecolor='#1e2d3d', linewidth=1)
        ax.add_patch(pill)
        ax.text(x + 1.4, 3.7, label, color='#5a7a98',
                fontsize=7.5, fontweight='bold', ha='center', va='center',
                transform=ax.transData)
        ax.text(x + 1.4, 2.0, val, color=col,
                fontsize=14, fontweight='bold', ha='center', va='center',
                transform=ax.transData)

plt.suptitle('Crash Line Status Bar — States Preview',
             color='#c9a84c', fontsize=12, fontweight='bold', y=1.02)
plt.tight_layout(pad=1.2)
out = '/home2/cleo/.openclaw/workspace/crash_line_preview.png'
plt.savefig(out, dpi=150, facecolor=fig.get_facecolor(), bbox_inches='tight')
plt.close()
print(f'Saved: {out}')
