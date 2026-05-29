# Model Methodology

This app uses the uploaded batting CSV only. Every score is recalculated in the browser whenever the AB qualifier or uploaded dataset changes.

## Normalization

For each metric, the app calculates percentile ranks against the currently qualified player pool. The default qualifier is 100 AB. For metrics where lower is better, such as K%, whiff%, chase rate, and swing-miss rates, the percentile is inverted.

## Performance Score

The Performance Score is a 0-100 composite designed to answer: **who has been the best hitter in this dataset so far?**

Weights:

- 52% production: wOBA, OPS, xwOBA, SLG, OBP, ISO, HR/PA, RBI/PA, AVG
- 25% contact quality: barrel rate, hard-hit rate, average exit velocity, xSLG, xISO, average best speed, sweet-spot rate, solid contact
- 15% plate discipline: BB%, K%, whiff%, chase rate, in-zone contact, zone swing-miss
- 8% speed/baserunning: stolen bases, SB/PA, caught-stealing avoidance, runs

A small plate-appearance reliability adjustment is included so very small samples are not treated exactly the same as larger samples.

## Breakout Score

The Breakout Score is designed to answer: **who is a buy-low or future-improvement candidate?** It intentionally does not simply rank the best current hitters.

Inputs:

- Positive expected-stat gaps: xwOBA - wOBA, xSLG - SLG, xBA - AVG
- Low BABIP with stronger expected indicators
- Expected skill score, built from xwOBA, xSLG, xBA, xOBP, contact quality, discipline, and opportunity
- Contact quality: barrel rate, hard-hit rate, average EV, xSLG, xISO, best speed, sweet spot, solid contact
- Plate discipline: BB%, K%, whiff%, chase rate, contact skills
- Opportunity: AB and PA percentile
- Buy-low lag: expected skill minus current production

Penalties are applied when a player is already strongly overperforming expected stats, already producing at a very high level, or has a weak expected-skill profile.

## What the app does not know

The model does not know injuries, team lineup changes, park changes, handedness splits, upcoming schedule, weather, or roster/news context unless those fields are added to the CSV. Those can be added later with a backend or API layer.
