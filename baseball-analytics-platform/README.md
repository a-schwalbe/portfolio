# Diamond Signal Lab - Baseball Player Analytics Platform

This is the complete final static web app built around your uploaded batting dataset. It ranks hitters, creates player cards, calculates current-year performance scores, and finds breakout candidates using expected stats and advanced batted-ball indicators.

There are no placeholder files required to run the app. The included app works immediately with the uploaded `stats.csv` and also supports newer CSV uploads from your Excel sheet.

## What is implemented

- Searchable player cards
- Default 100 AB qualifier, adjustable from the UI
- Dashboard summary cards
- Player Performance tab with sortable 0-100 composite performance score
- Breakout Finder tab for underperforming players with strong expected/contact indicators
- Metric Explorer tab for top-player rankings by individual metric
- Full player detail modal with signals and risk flags
- CSV upload for updated Excel exports
- Browser persistence for uploaded CSV files
- Reset button to return to the included dataset
- Downloadable scored CSV export
- Built-in embedded dataset fallback, so the app can run even when opened directly from disk
- Free static deployment compatibility: GitHub Pages, Netlify, Vercel, Cloudflare Pages

## Quick start in VS Code

1. Unzip the project.
2. Open the folder in VS Code.
3. Open a terminal in that folder.
4. Run either command:

```bash
python serve.py
```

or:

```bash
python -m http.server 5173
```

5. Open:

```text
http://localhost:5173
```

## Updating the data

### Option 1 - Browser upload

Export your Excel sheet as CSV, then use **Upload updated CSV** in the app. This is the fastest workflow. The app saves the uploaded CSV in your browser until you click reset.

### Option 2 - Replace the project CSV

Replace:

```text
data/stats.csv
```

with a newer CSV that has the same column names. Then refresh the browser.

To update the embedded fallback too, run:

```bash
python tools/regenerate_embedded_data.py
```

or, if you use npm scripts:

```bash
npm run embed:data
```

## Default qualifier

The default qualifier is **100 AB**, matching your request. You can change it at the top of the app.

## Scoring model summary

### Performance Score

A 0-100 score built from:

- 52% production: wOBA, OPS, xwOBA, SLG, OBP, ISO, HR/PA, RBI/PA, AVG
- 25% contact quality: barrel rate, hard-hit rate, average exit velocity, xSLG, xISO, best speed, sweet-spot rate, solid contact
- 15% plate discipline: BB%, K%, whiff%, chase rate, in-zone contact, zone swing-miss
- 8% speed/baserunning: stolen bases, SB/PA, caught-stealing avoidance, runs

### Breakout Score

A forward-looking 0-100 score built from:

- Positive regression gaps: xwOBA - wOBA, xSLG - SLG, xBA - AVG
- Low BABIP with stronger expected stats
- Expected skill score
- Contact quality
- Plate discipline
- Opportunity/playing time
- Buy-low lag where expected skill is better than current production

The model penalizes players who are already strongly overperforming expected stats or whose expected skill profile is weak.

More detail is in:

```text
docs/model-methodology.md
```

## Deploying online

This is a static app, so no database or backend is required.

### GitHub Pages

1. Push the project folder to a GitHub repository.
2. Go to Settings → Pages.
3. Serve from the root folder.

### Netlify

Drag the unzipped folder into Netlify, or connect the GitHub repository. `netlify.toml` is included.

### Vercel

Import the repository as a static project. `vercel.json` is included.

## Important limitation

The model only knows what is in the CSV. It does not automatically know injuries, depth-chart changes, lineup changes, park/weather context, or news. Those can be added later as additional columns or with a backend/API layer.

## Automatic Baseball Savant refresh

This version includes a scheduled-refresh pipeline for the Baseball Savant Custom Leaderboard URL in `config/savant_leaderboard_url.txt`.

Test it locally:

```bash
python tools/fetch_savant_leaderboard.py --dry-run
```

Run the update locally:

```bash
python tools/fetch_savant_leaderboard.py
```

Or with npm:

```bash
npm run fetch:savant:dry
npm run fetch:savant
```

For GitHub-hosted projects, `.github/workflows/update-savant-data.yml` runs the fetcher every morning and commits updated data when the leaderboard changes.

More detail: `docs/automatic-savant-refresh.md`.
