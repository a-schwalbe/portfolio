# Data refresh workflow

This app should not scrape Baseball Savant pages. Baseball Savant provides a downloadable CSV button on its leaderboards, and MLB's Terms of Use restrict automated scripts that collect information from MLB Digital Properties. The safe workflow is manual export followed by local import.

## Recommended workflow

1. Go to Baseball Savant → Custom Leaderboard.
2. Select **Batters**.
3. Select the current season, for example 2026.
4. Choose the minimum PA threshold you want.
5. Under **Custom Columns**, include the same metrics the app already expects:
   - basic batting stats: AB, PA, H, HR, SO, BB, K%, BB%, AVG, SLG, OBP, OPS, ISO, BABIP, RBI, SB, CS, R
   - expected stats: xBA, xSLG, wOBA, xwOBA, xOBP, xISO
   - quality of contact: Avg EV, Barrel%, Hard Hit%, EV50, LA Sweet-Spot%, Solid Contact%
   - discipline/location: Whiff%, Out of Zone Swing%, In Zone Contact%, Zone Swing & Miss%
   - bat tracking metrics if available: Bat Speed, Fast Swing %, Squared-Up, Blasts, Swing Length
6. Click **Download CSV**.
7. Run:

```bash
python tools/import_savant_export.py ~/Downloads/YOUR_FILE.csv
```

The script will:

- validate required columns
- show row/year/max PA/qualified hitter counts
- save a timestamped backup beside `data/stats.csv`
- replace `data/stats.csv`
- regenerate `src/embeddedData.js`

## Common commands

Validate without changing files:

```bash
python tools/import_savant_export.py ~/Downloads/YOUR_FILE.csv --dry-run
```

Import but skip the embedded fallback refresh:

```bash
python tools/import_savant_export.py ~/Downloads/YOUR_FILE.csv --no-embed
```

Force an import even if columns are missing, only when you are also changing the scoring model:

```bash
python tools/import_savant_export.py ~/Downloads/YOUR_FILE.csv --allow-missing
```
