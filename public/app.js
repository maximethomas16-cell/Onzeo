import {
  bindThemeButtons,
  computeSeasonStats,
  escapeHtml,
  fetchJson,
  findTeamStanding,
  formatShortDate,
  isFinished,
  matchSort,
  monthKey,
  normalizeSeasonData,
  normalizeTeamName,
  resultFor,
} from "./shared.js";

const els = {
  lastMatchesBlock: document.getElementById("lastMatchesBlock"),
  seasonPills: document.getElementById("seasonPills"),
  summaryTitle: document.getElementById("summaryTitle"),
  seasonSummary: document.getElementById("seasonSummary"),
  seasonCalendar: document.getElementById("seasonCalendar"),
  standingsTable: document.getElementById("standingsTable"),
  calendarFilter: document.getElementById("calendarFilter"),
  tabButtons: [...document.querySelectorAll(".tab-btn")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  toast: document.getElementById("toast"),
};

let state = normalizeSeasonData({});
let activeTab = "summary";

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function getLastMatches(limit = 5) {
  return [...state.matches]
    .filter(isFinished)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, limit);
}

function renderTeamLabelWithRank(teamName) {
  const standing = findTeamStanding(state.standingsTable, teamName);
  const rankLabel = standing?.rank ? `#${standing.rank}` : "NC";
  return `${escapeHtml(teamName)} <span class="calendar-rank">${escapeHtml(rankLabel)}</span>`;
}

function renderHeaderMeta() {
  els.summaryTitle.textContent = `${state.season.team} · ${state.season.label}`;
  els.seasonPills.innerHTML = `
    <span class="mini-pill">${escapeHtml(state.season.competition || "Compétition")}</span>
    <span class="mini-pill">${escapeHtml(state.season.district || "District")}</span>
  `;
}

function renderSeasonSummary(matches) {
  const stats = computeSeasonStats(matches, state.club.trackedTeam);
  els.seasonSummary.innerHTML = `
    <span class="mini-pill">${stats.total} match(s)</span>
    <span class="mini-pill">${stats.wins} V / ${stats.draws} N / ${stats.losses} D</span>
    <span class="mini-pill">${stats.goalsFor} BP / ${stats.goalsAgainst} BC</span>
  `;
}

function renderLastMatches() {
  const lastMatches = getLastMatches(5);

  if (!lastMatches.length) {
    els.lastMatchesBlock.innerHTML = `<p class="meta-note">Aucun résultat récent disponible.</p>`;
    return;
  }

  els.lastMatchesBlock.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow">Résultats récents</p>
        <h2>Derniers matchs</h2>
      </div>
    </div>
    <div class="last-list">
      ${lastMatches
        .map((match) => {
          const result = resultFor(match, state.club.trackedTeam);
          return `
            <div class="last-item">
              <span class="result-chip ${result.cls}">${escapeHtml(result.label)}</span>
              <span>${escapeHtml(match.homeTeam)} - ${escapeHtml(match.awayTeam)}</span>
              <strong>${escapeHtml(match.homeScore)}-${escapeHtml(match.awayScore)}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function filteredMatchesForCalendar() {
  const filter = els.calendarFilter.value;
  const tracked = normalizeTeamName(state.club.trackedTeam);
  return [...state.matches]
    .filter((match) => {
      const competition = String(match.competition || "").toLowerCase();
      const homeTracked = normalizeTeamName(match.homeTeam).includes(tracked) || tracked.includes(normalizeTeamName(match.homeTeam));
      const awayTracked = normalizeTeamName(match.awayTeam).includes(tracked) || tracked.includes(normalizeTeamName(match.awayTeam));
      if (filter === "league") return competition.includes("district") || competition.includes("championnat");
      if (filter === "cup") return competition.includes("coupe");
      if (filter === "home") return homeTracked;
      if (filter === "away") return awayTracked;
      if (filter === "future") return !isFinished(match);
      return true;
    })
    .sort(matchSort);
}

function renderCalendar() {
  const matches = filteredMatchesForCalendar();

  if (!matches.length) {
    els.seasonCalendar.innerHTML = `<p class="meta-note">Aucun match à afficher avec ce filtre.</p>`;
    return;
  }

  const tracked = normalizeTeamName(state.club.trackedTeam);
  const groups = new Map();

  matches.forEach((match) => {
    const key = monthKey(match.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(match);
  });

  els.seasonCalendar.innerHTML = [...groups.entries()]
    .map(([month, monthMatches]) => {
      const rows = monthMatches
        .map((match) => {
          const homeTracked = normalizeTeamName(match.homeTeam).includes(tracked) || tracked.includes(normalizeTeamName(match.homeTeam));
          const awayTracked = normalizeTeamName(match.awayTeam).includes(tracked) || tracked.includes(normalizeTeamName(match.awayTeam));
          const result = resultFor(match, state.club.trackedTeam);
          const score = isFinished(match) ? `${match.homeScore}-${match.awayScore}` : "—";

          return `
            <div class="calendar-row">
              <div>${escapeHtml(formatShortDate(match.date))}</div>
              <div class="calendar-competition competition">${escapeHtml(match.competition || "Compétition")}</div>
              <div class="calendar-home ${homeTracked ? "tracked-team" : ""}">${renderTeamLabelWithRank(match.homeTeam)}</div>
              <div class="calendar-score">${escapeHtml(score)}</div>
              <div class="calendar-away ${awayTracked ? "tracked-team" : ""}">${renderTeamLabelWithRank(match.awayTeam)}</div>
              <span class="calendar-result result-chip ${result.cls}">${escapeHtml(result.label)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <section class="month-block">
          <h3 class="month-title">${escapeHtml(month)}</h3>
          <div class="calendar-list">${rows}</div>
        </section>
      `;
    })
    .join("");
}

function renderStandings() {
  if (!state.standingsTable.length) {
    els.standingsTable.innerHTML = `<p class="meta-note">Aucun classement chargé.</p>`;
    return;
  }

  const tracked = normalizeTeamName(state.club.trackedTeam);
  const summary = state.summary || {};

  els.standingsTable.innerHTML = `
    <div class="standings-overview">
      <span class="overview-chip"><strong>Pos.</strong><span>${escapeHtml(summary.rank ?? "—")}</span></span>
      <span class="overview-chip"><strong>Pts</strong><span>${escapeHtml(summary.points ?? "—")}</span></span>
      <span class="overview-chip"><strong>J</strong><span>${escapeHtml(summary.played ?? "—")}</span></span>
      <span class="overview-chip"><strong>Diff.</strong><span>${escapeHtml(summary.goalDifference ?? "—")}</span></span>
    </div>
    <div class="table-shell">
      <div class="standings-mobile">
        ${state.standingsTable
          .map((row) => {
            const highlight = normalizeTeamName(row.team).includes(tracked) || tracked.includes(normalizeTeamName(row.team));
            return `
              <article class="standings-mobile-card ${highlight ? "highlight" : ""}">
                <div class="standings-mobile-head">
                  <strong>#${escapeHtml(row.rank ?? "—")}</strong>
                  <span>${escapeHtml(row.team)}</span>
                </div>
                <div class="standings-mobile-metrics">
                  <span>Pts ${escapeHtml(row.points ?? "—")}</span>
                  <span>J ${escapeHtml(row.played ?? "—")}</span>
                  <span>G ${escapeHtml(row.wins ?? "—")}</span>
                  <span>N ${escapeHtml(row.draws ?? "—")}</span>
                  <span>P ${escapeHtml(row.losses ?? "—")}</span>
                  <span>Diff ${escapeHtml(row.goalDifference ?? "—")}</span>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="table-frame">
        <table>
          <thead>
            <tr>
              <th>Pr.</th>
              <th>Équipe</th>
              <th>Pts</th>
              <th>J</th>
              <th>G</th>
              <th>N</th>
              <th>P</th>
              <th>BP</th>
              <th>BC</th>
              <th>Diff.</th>
            </tr>
          </thead>
          <tbody>
            ${state.standingsTable
              .map((row) => {
                const highlight = normalizeTeamName(row.team).includes(tracked) || tracked.includes(normalizeTeamName(row.team));
                return `
                  <tr class="${highlight ? "highlight" : ""}">
                    <td>${escapeHtml(row.rank ?? "—")}</td>
                    <td>${escapeHtml(row.team)}</td>
                    <td>${escapeHtml(row.points ?? "—")}</td>
                    <td>${escapeHtml(row.played ?? "—")}</td>
                    <td>${escapeHtml(row.wins ?? "—")}</td>
                    <td>${escapeHtml(row.draws ?? "—")}</td>
                    <td>${escapeHtml(row.losses ?? "—")}</td>
                    <td>${escapeHtml(row.goalsFor ?? "—")}</td>
                    <td>${escapeHtml(row.goalsAgainst ?? "—")}</td>
                    <td>${escapeHtml(row.goalDifference ?? "—")}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="meta-note">Classement sous réserve des corrections officielles.</p>
    </div>
  `;
}

function render() {
  renderHeaderMeta();
  renderSeasonSummary(state.matches);
  renderLastMatches();
  renderCalendar();
  renderStandings();
}

function setTab(name) {
  activeTab = name;
  els.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  els.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
}

async function loadPublicData() {
  const payload = await fetchJson("/api/public/season", { method: "GET" });
  state = normalizeSeasonData(payload.data);
  render();
}

async function refresh() {
  try {
    await loadPublicData();
  } catch (error) {
    toast(`Impossible de charger les données: ${error.message}`);
  }
}

bindThemeButtons();
els.tabButtons.forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
els.calendarFilter.addEventListener("change", renderCalendar);
setTab(activeTab);
refresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore service worker registration failures in local preview.
    });
  });
}
