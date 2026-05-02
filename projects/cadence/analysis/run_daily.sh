#!/bin/bash
# Daily correlation analysis for Cadence
# Runs at 14:00 UTC (after dream cron, after WHOOP nightly backfill)

set -e
cd /home2/cleo/.openclaw/workspace/projects/cadence

LOG_DIR=analysis/logs
mkdir -p "$LOG_DIR"
DATE=$(date -u +%Y-%m-%d)
LOG_FILE="$LOG_DIR/correlate-${DATE}.log"

{
  echo "═══════════════════════════════════════════"
  echo "  Cadence Daily Correlation Run"
  echo "  $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  echo "═══════════════════════════════════════════"
  echo

  # Refresh proxy scores (in case Visible data backfilled)
  echo "── Step 1: Update proxy scores ──"
  node analysis/proxy_score.js

  echo
  echo "── Step 2: Run correlation analysis ──"
  node analysis/correlate.js

  echo
  echo "✅ Daily run complete: $(date -u +'%H:%M:%S UTC')"
} 2>&1 | tee "$LOG_FILE"

# Keep last 30 days of logs
find "$LOG_DIR" -name "correlate-*.log" -mtime +30 -delete 2>/dev/null || true
