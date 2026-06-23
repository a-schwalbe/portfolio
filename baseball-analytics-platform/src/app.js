const state = {
  rawRows: [],
  columns: [],
  analyzed: [],
  qualified: [],
  activeTab: "dashboard",
  sourceName: "included stats.csv",
  statsMetadata: null,
  statsMetadataSignature: null,
  autoRefreshTimer: null,
};

const selectors = {
  searchInput: document.getElementById("searchInput"),
  minABInput: document.getElementById("minABInput"),
  sortSelect: document.getElementById("sortSelect"),
  viewCountSelect: document.getElementById("viewCountSelect"),
  csvUpload: document.getElementById("csvUpload"),
  resetDataBtn: document.getElementById("resetDataBtn"),
  downloadScoresBtn: document.getElementById("downloadScoresBtn"),
  dataStatus: document.getElementById("dataStatus"),
  statsFreshness: document.getElementById("statsFreshness"),
  summaryCards: document.getElementById("summaryCards"),
  playerCards: document.getElementById("playerCards"),
  signalBoard: document.getElementById("signalBoard"),
  performanceTable: document.getElementById("performanceTable"),
  breakoutCards: document.getElementById("breakoutCards"),
  metricSelect: document.getElementById("metricSelect"),
  metricChart: document.getElementById("metricChart"),
  playerDialog: document.getElementById("playerDialog"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  dialogContent: document.getElementById("dialogContent"),
  performanceHelpBtn: document.getElementById("performanceHelpBtn"),
};

const SORT_OPTIONS = [
  ["performanceScore", "Performance score"],
  ["breakoutScore", "Breakout score"],
  ["trueTalentScore", "Expected skill score"],
  ["contactScore", "Contact quality"],
  ["disciplineScore", "Plate discipline"],
  ["woba", "wOBA"],
  ["xwoba", "xwOBA"],
  ["on_base_plus_slg", "OPS"],
  ["home_run", "Home runs"],
  ["barrel_batted_rate", "Barrel %"],
  ["hard_hit_percent", "Hard-hit %"],
  ["exit_velocity_avg", "Avg EV"],
  ["ab", "AB"],
];

const EXPLORER_METRICS = [
  ["performanceScore", "Performance Score"],
  ["breakoutScore", "Breakout Score"],
  ["trueTalentScore", "Expected Skill Score"],
  ["contactScore", "Contact Quality Score"],
  ["disciplineScore", "Plate Discipline Score"],
  ["batting_avg", "AVG"],
  ["on_base_percent", "OBP"],
  ["slg_percent", "SLG"],
  ["on_base_plus_slg", "OPS"],
  ["isolated_power", "ISO"],
  ["woba", "wOBA"],
  ["xwoba", "xwOBA"],
  ["xwobadiff", "xwOBA - wOBA"],
  ["xba", "xBA"],
  ["xslg", "xSLG"],
  ["xslgdiff_calc", "xSLG - SLG"],
  ["babip", "BABIP"],
  ["barrel_batted_rate", "Barrel %"],
  ["hard_hit_percent", "Hard-hit %"],
  ["exit_velocity_avg", "Avg exit velocity"],
  ["avg_best_speed", "Avg best speed"],
  ["sweet_spot_percent", "Sweet spot %"],
  ["k_percent", "K %"],
  ["bb_percent", "BB %"],
  ["whiff_percent", "Whiff %"],
  ["oz_swing_percent", "Chase %"],
  ["r_total_stolen_base", "Stolen bases"],
];

const LOWER_IS_BETTER = new Set([
  "k_percent",
  "whiff_percent",
  "z_swing_miss_percent",
  "oz_swing_miss_percent",
  "out_zone_swing_miss",
  "oz_swing_percent",
  "poorlyunder_percent",
  "poorlytopped_percent",
  "poorlyweak_percent",
  "popups_percent",
]);

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value);
    if (row.some(cell => cell.trim() !== "")) rows.push(row);
  }

  if (!rows.length) return { columns: [], data: [] };
  const columns = rows[0].map(c => c.replace(/^\uFEFF/, "").trim());
  const data = rows.slice(1).map(cells => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = cells[i] ?? ""; });
    return obj;
  });
  return { columns, data };
}

function numberValue(row, key) {
  if (!row || row[key] === undefined || row[key] === null || row[key] === "") return null;
  const cleaned = String(row[key]).replace(/%/g, "").replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : null;
}

function displayName(row) {
  const raw = row["last_name, first_name"] || row.name || row.player_name || "Unknown Player";
  if (raw.includes(",")) {
    const [last, first] = raw.split(",").map(s => s.trim());
    if (first && last) return `${first} ${last}`;
  }
  return raw;
}

function format(value, type = "number") {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (type === "pct") return `${Number(value).toFixed(1)}%`;
  if (type === "score") return Math.round(value).toString();
  if (type === "avg") return Number(value).toFixed(3).replace(/^0/, "");
  if (type === "gap") {
    const n = Number(value);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(3).replace(/^(-?)0/, "$1")}`;
  }
  if (type === "one") return Number(value).toFixed(1);
  if (type === "int") return Math.round(value).toString();
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function mean(values) {
  const clean = values.filter(v => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function percentile(sortedValues, rawValue, invert = false) {
  if (!Number.isFinite(rawValue) || sortedValues.length === 0) return 50;
  if (sortedValues.length === 1) return 50;
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sortedValues[mid] <= rawValue) low = mid + 1;
    else high = mid;
  }
  const pct = (low - 1) / (sortedValues.length - 1) * 100;
  const safePct = clamp(pct);
  return invert ? 100 - safePct : safePct;
}

function weighted(items) {
  let totalWeight = 0;
  let total = 0;
  for (const [value, weight] of items) {
    if (Number.isFinite(value)) {
      total += value * weight;
      totalWeight += weight;
    }
  }
  return totalWeight ? total / totalWeight : 50;
}

function makeDistribution(players, keys) {
  const dist = {};
  keys.forEach(key => {
    dist[key] = players
      .map(p => p[key])
      .filter(v => Number.isFinite(v))
      .sort((a, b) => a - b);
  });
  return dist;
}

function pctx(player, dist, key, invert = LOWER_IS_BETTER.has(key)) {
  return percentile(dist[key] || [], player[key], invert);
}

function getPlayerNumeric(row) {
  const obj = { original: row, name: displayName(row) };
  const keys = state.columns.filter(col => col !== "last_name, first_name");
  keys.forEach(key => obj[key] = numberValue(row, key));

  obj.id = row.player_id || obj.player_id || obj.name;
  obj.ab = obj.ab ?? 0;
  obj.pa = obj.pa ?? 0;
  obj.hr_per_pa = obj.pa ? (obj.home_run ?? 0) / obj.pa : null;
  obj.walk_per_pa = obj.pa ? (obj.walk ?? 0) / obj.pa : null;
  obj.rbi_per_pa = obj.pa ? (obj.b_rbi ?? 0) / obj.pa : null;
  obj.sb_per_pa = obj.pa ? (obj.r_total_stolen_base ?? 0) / obj.pa : null;
  obj.xwobadiff = Number.isFinite(obj.xwoba) && Number.isFinite(obj.woba) ? obj.xwoba - obj.woba : null;
  obj.xslgdiff_calc = Number.isFinite(obj.xslg) && Number.isFinite(obj.slg_percent) ? obj.xslg - obj.slg_percent : null;
  obj.xbadiff_calc = Number.isFinite(obj.xba) && Number.isFinite(obj.batting_avg) ? obj.xba - obj.batting_avg : null;
  obj.babip_gap = Number.isFinite(obj.babip) ? 0.300 - obj.babip : null;
  return obj;
}

function analyze() {
  const minAB = Number(selectors.minABInput.value || 100);
  const players = state.rawRows.map(getPlayerNumeric);
  const qualified = players.filter(p => (p.ab ?? 0) >= minAB);
  const maxPA = Math.max(...qualified.map(p => p.pa || 0), 1);

  const metricKeys = [
    "batting_avg", "on_base_percent", "slg_percent", "on_base_plus_slg", "isolated_power",
    "woba", "xwoba", "xobp", "xba", "xslg", "xiso", "babip", "home_run", "b_rbi",
    "hr_per_pa", "rbi_per_pa", "bb_percent", "k_percent", "whiff_percent", "oz_swing_percent",
    "oz_contact_percent", "iz_contact_percent", "z_swing_miss_percent", "barrel_batted_rate",
    "hard_hit_percent", "exit_velocity_avg", "avg_best_speed", "avg_hyper_speed", "sweet_spot_percent",
    "solidcontact_percent", "ideal_angle_rate", "r_total_stolen_base", "r_total_caught_stealing", "sb_per_pa",
    "r_run", "xwobadiff", "xslgdiff_calc", "xbadiff_calc", "babip_gap", "pa", "ab"
  ];
  const dist = makeDistribution(qualified, metricKeys);
  const poolMeans = Object.fromEntries(metricKeys.map(key => [key, mean(qualified.map(p => p[key]))]));

  const analyzed = players.map(player => {
    const productionScore = weighted([
      [pctx(player, dist, "woba"), 20],
      [pctx(player, dist, "on_base_plus_slg"), 17],
      [pctx(player, dist, "xwoba"), 15],
      [pctx(player, dist, "slg_percent"), 10],
      [pctx(player, dist, "on_base_percent"), 9],
      [pctx(player, dist, "isolated_power"), 8],
      [pctx(player, dist, "hr_per_pa"), 6],
      [pctx(player, dist, "rbi_per_pa"), 4],
      [pctx(player, dist, "batting_avg"), 6],
    ]);

    const contactScore = weighted([
      [pctx(player, dist, "barrel_batted_rate"), 20],
      [pctx(player, dist, "hard_hit_percent"), 18],
      [pctx(player, dist, "exit_velocity_avg"), 15],
      [pctx(player, dist, "xslg"), 14],
      [pctx(player, dist, "xiso"), 10],
      [pctx(player, dist, "avg_best_speed"), 9],
      [pctx(player, dist, "sweet_spot_percent"), 8],
      [pctx(player, dist, "solidcontact_percent"), 6],
    ]);

    const disciplineScore = weighted([
      [pctx(player, dist, "bb_percent"), 23],
      [pctx(player, dist, "k_percent", true), 23],
      [pctx(player, dist, "whiff_percent", true), 22],
      [pctx(player, dist, "oz_swing_percent", true), 14],
      [pctx(player, dist, "iz_contact_percent"), 10],
      [pctx(player, dist, "z_swing_miss_percent", true), 8],
    ]);

    const speedScore = weighted([
      [pctx(player, dist, "r_total_stolen_base"), 54],
      [pctx(player, dist, "sb_per_pa"), 28],
      [pctx(player, dist, "r_total_caught_stealing", true), 8],
      [pctx(player, dist, "r_run"), 10],
    ]);

    const trueTalentScore = weighted([
      [pctx(player, dist, "xwoba"), 24],
      [pctx(player, dist, "xslg"), 18],
      [pctx(player, dist, "xba"), 10],
      [pctx(player, dist, "xobp"), 9],
      [contactScore, 22],
      [disciplineScore, 12],
      [pctx(player, dist, "pa"), 5],
    ]);

    const reliability = clamp(((player.pa || 0) / ((player.pa || 0) + 130)) * 100, 35, 100);
    const opportunityScore = weighted([
      [pctx(player, dist, "pa"), 65],
      [pctx(player, dist, "ab"), 35],
    ]);

    const performanceScore = weighted([
      [productionScore, 52],
      [contactScore, 25],
      [disciplineScore, 15],
      [speedScore, 8],
    ]) * 0.94 + reliability * 0.06;

    const regressionGapScore = weighted([
      [pctx(player, dist, "xwobadiff"), 40],
      [pctx(player, dist, "xslgdiff_calc"), 28],
      [pctx(player, dist, "xbadiff_calc"), 18],
      [pctx(player, dist, "babip_gap"), 14],
    ]);

    // The breakout model should favor buy-low profiles, not simply elite players who are already producing.
    // actualLagScore rewards players whose expected skill is clearly ahead of their current production.
    const actualLagScore = clamp((trueTalentScore - productionScore + 30) * 1.7);
    let breakoutScore = weighted([
      [regressionGapScore, 32],
      [trueTalentScore, 22],
      [contactScore, 15],
      [disciplineScore, 10],
      [opportunityScore, 7],
      [actualLagScore, 14],
    ]);

    if (Number.isFinite(player.xwobadiff) && player.xwobadiff < -0.010) breakoutScore -= 10;
    if (Number.isFinite(player.xslgdiff_calc) && player.xslgdiff_calc < -0.030) breakoutScore -= 8;
    if (productionScore > 70) breakoutScore -= (productionScore - 70) * 0.80;
    if (performanceScore > 78) breakoutScore -= (performanceScore - 78) * 0.70;
    if (trueTalentScore < 45) breakoutScore -= 8;
    breakoutScore = clamp(breakoutScore);

    const signals = buildSignals(player, dist, { productionScore, contactScore, disciplineScore, trueTalentScore });
    const risks = buildRisks(player, dist);

    return {
      ...player,
      productionScore: clamp(productionScore),
      contactScore: clamp(contactScore),
      disciplineScore: clamp(disciplineScore),
      speedScore: clamp(speedScore),
      trueTalentScore: clamp(trueTalentScore),
      performanceScore: clamp(performanceScore),
      breakoutScore,
      opportunityScore: clamp(opportunityScore),
      reliability,
      regressionGapScore: clamp(regressionGapScore),
      signals,
      risks,
      poolMeans,
    };
  });

  state.analyzed = analyzed;
  state.qualified = analyzed.filter(p => (p.ab ?? 0) >= minAB);
  populateMetricSelect();
  render();
}

function buildSignals(p, dist, scores) {
  const signals = [];
  if (Number.isFinite(p.xwobadiff) && p.xwobadiff >= 0.020) signals.push(`xwOBA is ${format(p.xwobadiff, "gap")} above wOBA`);
  if (Number.isFinite(p.xslgdiff_calc) && p.xslgdiff_calc >= 0.045) signals.push(`xSLG is ${format(p.xslgdiff_calc, "gap")} above SLG`);
  if (Number.isFinite(p.xbadiff_calc) && p.xbadiff_calc >= 0.020) signals.push(`xBA is ${format(p.xbadiff_calc, "gap")} above AVG`);
  if (Number.isFinite(p.babip) && p.babip <= percentileValue(dist.babip, 25) && Number.isFinite(p.xbadiff_calc) && p.xbadiff_calc > 0) signals.push(`Low BABIP (${format(p.babip, "avg")}) with better xBA`);
  if (scores.contactScore >= 75) signals.push(`Top-tier contact quality score (${format(scores.contactScore, "score")})`);
  if (p.barrel_batted_rate >= percentileValue(dist.barrel_batted_rate, 75)) signals.push(`Barrel rate is in the top quartile (${format(p.barrel_batted_rate, "pct")})`);
  if (p.hard_hit_percent >= percentileValue(dist.hard_hit_percent, 75)) signals.push(`Hard-hit rate is in the top quartile (${format(p.hard_hit_percent, "pct")})`);
  if (scores.disciplineScore >= 70) signals.push(`Strong plate-discipline foundation (${format(scores.disciplineScore, "score")})`);
  if (scores.trueTalentScore >= 75) signals.push(`Expected skill score supports upside (${format(scores.trueTalentScore, "score")})`);
  return signals.slice(0, 5);
}

function buildRisks(p, dist) {
  const risks = [];
  if (Number.isFinite(p.xwobadiff) && p.xwobadiff <= -0.015) risks.push(`xwOBA trails wOBA by ${format(Math.abs(p.xwobadiff), "avg")}`);
  if (Number.isFinite(p.k_percent) && p.k_percent >= percentileValue(dist.k_percent, 80)) risks.push(`High K rate (${format(p.k_percent, "pct")})`);
  if (Number.isFinite(p.whiff_percent) && p.whiff_percent >= percentileValue(dist.whiff_percent, 80)) risks.push(`High whiff rate (${format(p.whiff_percent, "pct")})`);
  if (Number.isFinite(p.oz_swing_percent) && p.oz_swing_percent >= percentileValue(dist.oz_swing_percent, 80)) risks.push(`Aggressive chase rate (${format(p.oz_swing_percent, "pct")})`);
  if (Number.isFinite(p.barrel_batted_rate) && p.barrel_batted_rate <= percentileValue(dist.barrel_batted_rate, 25)) risks.push(`Below-average barrel rate (${format(p.barrel_batted_rate, "pct")})`);
  return risks.slice(0, 3);
}

function percentileValue(sorted, pct) {
  if (!sorted || !sorted.length) return NaN;
  const idx = clamp(Math.round((pct / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx];
}

function getVisiblePlayers() {
  const term = selectors.searchInput.value.trim().toLowerCase();
  const sortKey = selectors.sortSelect.value || "performanceScore";
  const maxCount = Number(selectors.viewCountSelect.value || 24);
  return state.qualified
    .filter(p => !term || p.name.toLowerCase().includes(term))
    .sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity))
    .slice(0, maxCount);
}

function render() {
  const updatedShort = formatStatsUpdatedShort();
  const updateText = updatedShort ? ` · Updated ${updatedShort}` : "";

  selectors.dataStatus.textContent =
    `${state.qualified.length} qualified / ${state.rawRows.length} total · ${state.sourceName}${updateText}`;

  renderStatsFreshness();
  renderSummary();
  renderDashboardCards();
  renderSignalBoard();
  renderPerformanceTable();
  renderBreakoutCards();
  renderMetricExplorer();
}

function renderSummary() {
  const q = state.qualified;
  const topPerf = [...q].sort((a, b) => b.performanceScore - a.performanceScore)[0];
  const topBreakout = [...q].sort((a, b) => b.breakoutScore - a.breakoutScore)[0];
  const avgOPS = mean(q.map(p => p.on_base_plus_slg));
  const avgXwoba = mean(q.map(p => p.xwoba));
  selectors.summaryCards.innerHTML = [
    summaryCard("Qualified hitters", q.length, `AB ≥ ${selectors.minABInput.value || 100}`),
    summaryCard("Top performance", topPerf ? topPerf.name : "--", topPerf ? `${format(topPerf.performanceScore, "score")} score` : "No data"),
    summaryCard("Top breakout", topBreakout ? topBreakout.name : "--", topBreakout ? `${format(topBreakout.breakoutScore, "score")} score` : "No data"),
    summaryCard("Pool averages", `${format(avgOPS, "avg")} OPS`, `${format(avgXwoba, "avg")} avg xwOBA`),
  ].join("");
}

function summaryCard(title, value, sub) {
  return `<article class="summary-card"><h3>${escapeHTML(title)}</h3><strong>${escapeHTML(String(value))}</strong><span>${escapeHTML(sub)}</span></article>`;
}

function renderDashboardCards() {
  const players = getVisiblePlayers();
  selectors.playerCards.innerHTML = players.map(playerCard).join("") || emptyState("No players match the current filters.");
  selectors.playerCards.querySelectorAll("[data-player]").forEach(btn => {
    btn.addEventListener("click", () => openPlayer(btn.dataset.player));
  });
}

function playerCard(p) {
  return `<article class="player-card">
    <div class="card-top">
      <div>
        <h3 class="player-name">${escapeHTML(p.name)}</h3>
        <div class="player-sub">Age ${format(p.player_age, "int")} · ${format(p.ab, "int")} AB · ${format(p.pa, "int")} PA</div>
      </div>
      <div class="score-badge">${format(p.performanceScore, "score")}</div>
    </div>
    <div class="metric-row">
      ${metricBox("OPS", format(p.on_base_plus_slg, "avg"))}
      ${metricBox("wOBA", format(p.woba, "avg"))}
      ${metricBox("xwOBA", format(p.xwoba, "avg"))}
      ${metricBox("Barrel", format(p.barrel_batted_rate, "pct"))}
    </div>
    ${scoreBar("Breakout", p.breakoutScore)}
    <ul class="signal-list">${(p.signals.length ? p.signals : ["Balanced profile with no major positive regression stack."]).slice(0,2).map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul>
    <button class="small-button" data-player="${escapeHTML(String(p.id))}" type="button">Open player analysis</button>
  </article>`;
}

function metricBox(label, val) {
  return `<div class="metric"><span>${escapeHTML(label)}</span><b>${escapeHTML(val)}</b></div>`;
}

function scoreBar(label, value) {
  return `<div class="bar-mini"><div class="bar-label"><span>${escapeHTML(label)}</span><b>${format(value, "score")}</b></div><div class="bar-track"><div class="bar-fill" style="--w:${clamp(value)}%"></div></div></div>`;
}

function renderSignalBoard() {
  const q = state.qualified;
  const topBreakouts = [...q].sort((a, b) => b.breakoutScore - a.breakoutScore).slice(0, 3);
  const underperformers = q.filter(p => p.xwobadiff > 0.02).sort((a, b) => b.xwobadiff - a.xwobadiff).slice(0, 3);
  const contactKings = [...q].sort((a, b) => b.contactScore - a.contactScore).slice(0, 3);

  selectors.signalBoard.innerHTML = `
    <div class="signal-item"><h3>Best breakout stack</h3><p>${topBreakouts.map(p => `${p.name} (${format(p.breakoutScore, "score")})`).join(", ") || "--"}</p></div>
    <div class="signal-item"><h3>Largest xwOBA gaps</h3><p>${underperformers.map(p => `${p.name} ${format(p.xwobadiff, "gap")}`).join(", ") || "--"}</p></div>
    <div class="signal-item"><h3>Best contact quality</h3><p>${contactKings.map(p => `${p.name} (${format(p.contactScore, "score")})`).join(", ") || "--"}</p></div>
    <div class="signal-item"><h3>Reminder</h3><p>The model ranks players from your data only. It does not know injuries, lineup changes, park changes, or playing-time news unless those are added to the dataset.</p></div>
  `;
}

function renderPerformanceTable() {
  const rows = [...state.qualified].sort((a, b) => b.performanceScore - a.performanceScore);
  selectors.performanceTable.innerHTML = `<table>
    <thead><tr>
      <th>Rank</th><th>Player</th><th>Perf</th><th>Expected</th><th>Contact</th><th>Disc.</th><th>AVG/OBP/SLG</th><th>wOBA</th><th>xwOBA</th><th>Barrel</th><th>K / BB</th><th>Open</th>
    </tr></thead>
    <tbody>
      ${rows.map((p, i) => `<tr>
        <td class="rank">#${i + 1}</td>
        <td><strong>${escapeHTML(p.name)}</strong><br><span class="muted">${format(p.ab, "int")} AB · ${format(p.pa, "int")} PA</span></td>
        <td class="table-score">${format(p.performanceScore, "score")}</td>
        <td>${format(p.trueTalentScore, "score")}</td>
        <td>${format(p.contactScore, "score")}</td>
        <td>${format(p.disciplineScore, "score")}</td>
        <td>${format(p.batting_avg, "avg")} / ${format(p.on_base_percent, "avg")} / ${format(p.slg_percent, "avg")}</td>
        <td>${format(p.woba, "avg")}</td>
        <td>${format(p.xwoba, "avg")}</td>
        <td>${format(p.barrel_batted_rate, "pct")}</td>
        <td>${format(p.k_percent, "pct")} / ${format(p.bb_percent, "pct")}</td>
        <td><button class="link-button" data-player="${escapeHTML(String(p.id))}" type="button">details</button></td>
      </tr>`).join("")}
    </tbody>
  </table>`;
  selectors.performanceTable.querySelectorAll("[data-player]").forEach(btn => btn.addEventListener("click", () => openPlayer(btn.dataset.player)));
}

function renderBreakoutCards() {
  const rows = [...state.qualified]
    .filter(p => p.breakoutScore >= 48)
    .sort((a, b) => b.breakoutScore - a.breakoutScore)
    .slice(0, 24);

  selectors.breakoutCards.innerHTML = rows.map(p => {
    const headline = p.signals[0] || "Composite expected-skill profile is stronger than surface production.";
    return `<article class="breakout-card">
      <div class="card-top">
        <div>
          <h3 class="player-name">${escapeHTML(p.name)}</h3>
          <div class="player-sub">${format(p.ab, "int")} AB · xwOBA gap ${format(p.xwobadiff, "gap")} · xSLG gap ${format(p.xslgdiff_calc, "gap")}</div>
        </div>
        <div class="score-badge gold">${format(p.breakoutScore, "score")}</div>
      </div>
      <p class="reason"><strong>Why:</strong> ${escapeHTML(headline)}</p>
      <div class="metric-row">
        ${metricBox("Perf", format(p.performanceScore, "score"))}
        ${metricBox("Expected", format(p.trueTalentScore, "score"))}
        ${metricBox("Contact", format(p.contactScore, "score"))}
        ${metricBox("Disc", format(p.disciplineScore, "score"))}
      </div>
      <div class="breakout-meta">
        ${(p.signals.length ? p.signals : ["No major positive-regression signal."]).slice(0,4).map(s => `<span class="pill good">${escapeHTML(s)}</span>`).join("")}
        ${p.risks.slice(0,2).map(s => `<span class="pill warn">${escapeHTML(s)}</span>`).join("")}
      </div>
      <button class="small-button" data-player="${escapeHTML(String(p.id))}" type="button">Open player analysis</button>
    </article>`;
  }).join("") || emptyState("No breakout candidates meet the current filters.");

  selectors.breakoutCards.querySelectorAll("[data-player]").forEach(btn => btn.addEventListener("click", () => openPlayer(btn.dataset.player)));
}

function populateMetricSelect() {
  if (selectors.metricSelect.options.length) return;
  selectors.metricSelect.innerHTML = EXPLORER_METRICS.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
}

function renderMetricExplorer() {
  const key = selectors.metricSelect.value || "performanceScore";
  const rows = [...state.qualified]
    .filter(p => Number.isFinite(p[key]))
    .sort((a, b) => b[key] - a[key])
    .slice(0, 30);
  const max = Math.max(...rows.map(p => Math.abs(p[key])), 1);
  selectors.metricChart.innerHTML = rows.map((p, i) => {
    const width = Math.max(3, Math.abs(p[key]) / max * 100);
    return `<div class="chart-row">
      <div class="chart-name"><span class="rank">#${i + 1}</span> ${escapeHTML(p.name)}</div>
      <div class="chart-track"><div class="chart-fill" style="--w:${width}%"></div></div>
      <div class="chart-value">${formatExplorerValue(key, p[key])}</div>
    </div>`;
  }).join("") || emptyState("No metric values are available for this view.");
}

function formatExplorerValue(key, val) {
  if (["performanceScore", "breakoutScore", "trueTalentScore", "contactScore", "disciplineScore"].includes(key)) return format(val, "score");
  if (["batting_avg", "on_base_percent", "slg_percent", "on_base_plus_slg", "isolated_power", "woba", "xwoba", "xba", "xslg", "xobp", "babip", "xwobadiff", "xslgdiff_calc"].includes(key)) return format(val, key.includes("diff") ? "gap" : "avg");
  if (key.includes("percent") || key.includes("rate")) return format(val, "pct");
  return format(val, "one");
}

function openPlayer(playerId) {
  const p = state.analyzed.find(row => String(row.id) === String(playerId));
  if (!p) return;
  selectors.dialogContent.innerHTML = `<div class="dialog-inner">
    <p class="eyebrow">Player analysis</p>
    <h2>${escapeHTML(p.name)}</h2>
    <p class="muted">Age ${format(p.player_age, "int")} · ${format(p.ab, "int")} AB · ${format(p.pa, "int")} PA · Player ID ${escapeHTML(String(p.player_id ?? "--"))}</p>
    <div class="summary-grid">
      ${summaryCard("Performance", format(p.performanceScore, "score"), "current + expected composite")}
      ${summaryCard("Breakout", format(p.breakoutScore, "score"), "positive-regression signal")}
      ${summaryCard("Expected skill", format(p.trueTalentScore, "score"), "x-stats + approach")}
      ${summaryCard("Contact", format(p.contactScore, "score"), "EV/barrel/hard-hit")}
    </div>
    <div class="dialog-grid">
      <div class="detail-card"><h3>Surface and expected stats</h3>
        ${detail("AVG", format(p.batting_avg, "avg"))}
        ${detail("OBP", format(p.on_base_percent, "avg"))}
        ${detail("SLG", format(p.slg_percent, "avg"))}
        ${detail("OPS", format(p.on_base_plus_slg, "avg"))}
        ${detail("wOBA", format(p.woba, "avg"))}
        ${detail("xwOBA", format(p.xwoba, "avg"))}
        ${detail("xwOBA gap", format(p.xwobadiff, "gap"))}
        ${detail("xSLG gap", format(p.xslgdiff_calc, "gap"))}
      </div>
      <div class="detail-card"><h3>Skill indicators</h3>
        ${detail("Barrel %", format(p.barrel_batted_rate, "pct"))}
        ${detail("Hard-hit %", format(p.hard_hit_percent, "pct"))}
        ${detail("Avg EV", format(p.exit_velocity_avg, "one"))}
        ${detail("Sweet spot %", format(p.sweet_spot_percent, "pct"))}
        ${detail("K %", format(p.k_percent, "pct"))}
        ${detail("BB %", format(p.bb_percent, "pct"))}
        ${detail("Whiff %", format(p.whiff_percent, "pct"))}
        ${detail("Chase %", format(p.oz_swing_percent, "pct"))}
      </div>
      <div class="detail-card"><h3>Positive signals</h3><ul class="signal-list">${(p.signals.length ? p.signals : ["No major positive-regression stack."]).map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul></div>
      <div class="detail-card"><h3>Risk flags</h3><ul class="risk-list">${(p.risks.length ? p.risks : ["No major model risk flags from this dataset."]).map(s => `<li>${escapeHTML(s)}</li>`).join("")}</ul></div>
    </div>
  </div>`;
  selectors.playerDialog.showModal();
}

function detail(label, value) {
  return `<div class="detail-row"><span>${escapeHTML(label)}</span><b>${escapeHTML(value)}</b></div>`;
}

function emptyState(text) {
  return `<div class="signal-item"><h3>No results</h3><p>${escapeHTML(text)}</p></div>`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function populateSelects() {
  selectors.sortSelect.innerHTML = SORT_OPTIONS.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  populateMetricSelect();
}

function downloadScores() {
  const rows = [...state.qualified].sort((a, b) => b.performanceScore - a.performanceScore);
  const headers = [
    "name", "player_id", "age", "ab", "pa", "performance_score", "breakout_score", "expected_skill_score",
    "contact_score", "discipline_score", "speed_score", "avg", "obp", "slg", "ops", "woba", "xwoba",
    "xwoba_gap", "xslg_gap", "barrel_rate", "hard_hit_rate", "avg_ev", "k_percent", "bb_percent", "top_signals", "risk_flags"
  ];
  const csvRows = [headers.join(",")];
  rows.forEach(p => {
    const values = [
      p.name, p.player_id, p.player_age, p.ab, p.pa, p.performanceScore, p.breakoutScore, p.trueTalentScore,
      p.contactScore, p.disciplineScore, p.speedScore, p.batting_avg, p.on_base_percent, p.slg_percent,
      p.on_base_plus_slg, p.woba, p.xwoba, p.xwobadiff, p.xslgdiff_calc, p.barrel_batted_rate,
      p.hard_hit_percent, p.exit_velocity_avg, p.k_percent, p.bb_percent, p.signals.join(" | "), p.risks.join(" | ")
    ];
    csvRows.push(values.map(csvEscape).join(","));
  });
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "scored_baseball_players.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


async function loadStatsMetadata() {
  try {
    const response = await fetch(`data/last_updated.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      state.statsMetadata = null;
      return;
    }

    state.statsMetadata = await response.json();
  } catch (err) {
    console.warn("Could not load stats update metadata:", err);
    state.statsMetadata = null;
  }
}

function getStatsUpdatedDate() {
  const rawTime = state.statsMetadata?.last_updated_utc;
  if (!rawTime) return null;

  const updatedDate = new Date(rawTime);
  if (Number.isNaN(updatedDate.getTime())) return null;

  return updatedDate;
}

function formatStatsUpdatedLong() {
  const updatedDate = getStatsUpdatedDate();
  if (!updatedDate) return "";

  return updatedDate.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function formatStatsUpdatedShort() {
  const updatedDate = getStatsUpdatedDate();
  if (!updatedDate) return "";

  return updatedDate.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function renderStatsFreshness() {
  if (!selectors.statsFreshness) return;

  if (localStorage.getItem("diamondSignalCSV")) {
    selectors.statsFreshness.textContent =
      "Using browser-saved uploaded CSV. Click Reset to included data to use the latest published Savant refresh.";
    selectors.statsFreshness.title = "";
    return;
  }

  const longTime = formatStatsUpdatedLong();

  if (!longTime) {
    selectors.statsFreshness.textContent =
      "Stats freshness unavailable. Data is loaded from the current published CSV.";
    selectors.statsFreshness.title = "";
    return;
  }

  const rowCount = state.statsMetadata?.row_count || state.rawRows.length;
  const source = state.statsMetadata?.source || "Baseball Savant";
  const utcTime = state.statsMetadata?.last_updated_utc || "";

  selectors.statsFreshness.textContent =
    `Latest Baseball Savant refresh: ${longTime} · ${rowCount} players`;

  selectors.statsFreshness.title = utcTime
    ? `Exact UTC refresh time: ${utcTime}`
    : "";
}

function getStatsMetadataSignature(meta) {
  if (!meta) return "";

  return [
    meta.last_updated_utc,
    meta.row_count,
    meta.column_count,
    meta.fetch_method,
  ]
    .filter(Boolean)
    .join("|");
}

async function fetchPublishedStatsCsv() {
  const response = await fetch(`data/stats.csv?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest stats.csv: ${response.status}`);
  }

  return response.text();
}

async function checkForPublishedDataUpdate({ force = false } = {}) {
  // Do not overwrite a user's manually uploaded CSV.
  if (localStorage.getItem("diamondSignalCSV")) {
    return;
  }

  const previousSignature = state.statsMetadataSignature;

  await loadStatsMetadata();

  const nextSignature = getStatsMetadataSignature(state.statsMetadata);

  if (!nextSignature) {
    return;
  }

  if (!state.statsMetadataSignature) {
    state.statsMetadataSignature = nextSignature;
    renderStatsFreshness();
    return;
  }

  const hasChanged = previousSignature && previousSignature !== nextSignature;

  if (!force && !hasChanged) {
    renderStatsFreshness();
    return;
  }

  try {
    selectors.dataStatus.textContent = "New published stats detected. Refreshing dashboard...";

    const latestCsv = await fetchPublishedStatsCsv();

    state.statsMetadataSignature = nextSignature;

    await setDataFromText(latestCsv, "data/stats.csv");

    renderStatsFreshness();

    console.info("Published Baseball Savant stats refreshed in open tab.");
  } catch (err) {
    console.warn("Could not refresh published stats in open tab:", err);
  }
}

function startPublishedDataAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
  }

  state.autoRefreshTimer = setInterval(() => {
    checkForPublishedDataUpdate();
  }, 5 * 60 * 1000);

  window.addEventListener("focus", () => {
    checkForPublishedDataUpdate();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      checkForPublishedDataUpdate();
    }
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

async function loadInitialData() {
  let text = localStorage.getItem("diamondSignalCSV");
  if (text) {
    state.sourceName = "browser-saved uploaded CSV";
    return text;
  }

  try {
    const response = await fetch("data/stats.csv", { cache: "no-store" });
    if (response.ok) {
      state.sourceName = "data/stats.csv";
      return await response.text();
    }
  } catch (err) {
    // File opened directly from disk; embedded fallback keeps the app usable.
  }

  state.sourceName = "included embedded stats.csv";
  return window.DEFAULT_BATTING_CSV || "";
}

async function setDataFromText(text, sourceName) {
  const parsed = parseCSV(text);
  if (!parsed.data.length) {
    alert("No rows were found in the CSV. Please check the file format.");
    return;
  }
  state.rawRows = parsed.data;
  state.columns = parsed.columns;
  state.sourceName = sourceName;
  analyze();
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
      state.activeTab = tab.dataset.tab;
      render();
    });
  });

  [selectors.searchInput, selectors.sortSelect, selectors.viewCountSelect].forEach(el => el.addEventListener("input", render));
  selectors.minABInput.addEventListener("input", analyze);
  selectors.metricSelect.addEventListener("input", renderMetricExplorer);
  selectors.downloadScoresBtn.addEventListener("click", downloadScores);
  selectors.closeDialogBtn.addEventListener("click", () => selectors.playerDialog.close());
  selectors.performanceHelpBtn.addEventListener("click", () => alert("Performance Score = 52% production, 25% contact quality, 15% plate discipline, 8% speed/baserunning, with a small PA reliability adjustment. Each input is normalized against the current qualified player pool."));

  selectors.csvUpload.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      localStorage.setItem("diamondSignalCSV", text);
      state.statsMetadata = null;
      setDataFromText(text, file.name);
    };
    reader.readAsText(file);
  });

  selectors.resetDataBtn.addEventListener("click", async () => {
    localStorage.removeItem("diamondSignalCSV");

    await loadStatsMetadata();
    state.statsMetadataSignature = getStatsMetadataSignature(state.statsMetadata);

    const text = await loadInitialData();
    await setDataFromText(text, state.sourceName);

    await checkForPublishedDataUpdate({ force: true });
  });
}

async function init() {
  populateSelects();
  bindEvents();

  await loadStatsMetadata();
  state.statsMetadataSignature = getStatsMetadataSignature(state.statsMetadata);

  const text = await loadInitialData();
  await setDataFromText(text, state.sourceName);

  startPublishedDataAutoRefresh();
}

init();
