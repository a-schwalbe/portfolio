# Automatic Baseball Savant Data Refresh

This project can refresh `data/stats.csv` from a Baseball Savant Custom Leaderboard URL.

## Local one-time test

```bash
python tools/fetch_savant_leaderboard.py --dry-run
```

If that succeeds, run the real update:

```bash
python tools/fetch_savant_leaderboard.py
```

The script reads the leaderboard URL from:

```text
config/savant_leaderboard_url.txt
```

It preserves your Baseball Savant query, adds `csv=true`, downloads the CSV, validates the columns, updates `data/stats.csv`, regenerates `src/embeddedData.js`, and writes `data/last_updated.json`.

## Daily GitHub Actions update

The workflow at `.github/workflows/update-savant-data.yml` runs every day at 11:00 UTC, which is 7:00 AM Eastern during daylight saving time.

When it finds changed data, it commits:

```text
data/stats.csv
data/last_updated.json
src/embeddedData.js
```

If your app is deployed from GitHub through Vercel or Netlify, that commit should trigger a fresh deploy.

## Important note

Do not run this every minute or on every user page load. This should be a low-frequency scheduled refresh, such as once per morning.
