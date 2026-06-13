import {
  bindThemeButtons,
  buildStandingSnapshot,
  buildWidgetMatchCard,
  computeSeasonStats,
  escapeHtml,
  filterMatchesForTeam,
  findTeamStanding,
  formatShortDate,
  getClubLogoUrl,
  getLastFinishedMatch,
  getNextMatch,
  isSameTeam,
  isFinished,
  matchSort,
  monthKey,
  normalizeSeasonData,
  resultFor,
} from "./shared.js?v=roannais-4";
import { getDataSourceStatus, loadPublicSeasonData } from "./data-source.js?v=roannais-4";

const els = {
  lastMatchesBlock: document.getElementById("lastMatchesBlock"),
  seasonPills: document.getElementById("seasonPills"),
  summaryTitle: document.getElementById("summaryTitle"),
  seasonSummary: document.getElementById("seasonSummary"),
  widgetDashboard: document.getElementById("widgetDashboard"),
  seasonCalendar: document.getElementById("seasonCalendar"),
  standingsTable: document.getElementById("standingsTable"),
  calendarFilter: document.getElementById("calendarFilter"),
  publicBrandCrest: document.getElementById("publicBrandCrest"),
  publicBrandTitle: document.getElementById("publicBrandTitle"),
  publicBrandLede: document.getElementById("publicBrandLede"),
  tabButtons: [...document.querySelectorAll(".tab-btn")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  toast: document.getElementById("toast"),
};

let state = normalizeSeasonData({});
let activeTab = "summary";

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(els.toast.timer);
  els.toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function getTrackedMatches() {
  return filterMatchesForTeam(state.matches, state.club.trackedTeam);
}

function getLastMatches(limit = 5) {
  return [...getTrackedMatches()]
    .filter(isFinished)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, limit);
}

function isTrackedName(teamName) {
  return isSameTeam(teamName, state.club.trackedTeam);
}

function renderTeamLabelWithRank(teamName) {
  const standing = findTeamStanding(state.standingsTable, teamName);
  const rankLabel = standing?.rank ? `#${standing.rank}` : "NC";
  return `${escapeHtml(teamName)} <span class="calendar-rank">${escapeHtml(rankLabel)}</span>`;
}

function renderHeaderMeta() {
  const clubName = state.club.name || state.club.trackedTeam || "Club";
  const seasonTeam = state.season.team || state.club.trackedTeam || "Equipe";

  document.title = "Onzeo - Espace public";
  els.publicBrandCrest.src = "./assets/logo-onzeo.png";
  els.publicBrandCrest.alt = "Logo Onzeo";
  els.publicBrandTitle.textContent = "Onzeo";
  els.publicBrandLede.textContent = `${clubName} - ${seasonTeam} en lecture simple.`;
  els.summaryTitle.textContent = `${state.club.trackedTeam} - ${state.season.label}`;
  els.seasonPills.innerHTML = `
    <span class="mini-pill">${escapeHtml(state.season.division || "D?")}</span>
    <span class="mini-pill">${escapeHtml(state.season.competition || "Competition")}</span>
    <span class="mini-pill">${escapeHtml(state.season.district || "Roannais")}</span>
  `;
}

function renderSeasonSummary(matches) {
  const stats = computeSeasonStats(matches, state.club.trackedTeam);
  els.seasonSummary.innerHTML = `
    <span class="mini-pill">${escapeHtml(state.club.name || state.club.trackedTeam)}</span>
    <span class="mini-pill">${stats.total} match(s)</span>
    <span class="mini-pill">${stats.wins} V / ${stats.draws} N / ${stats.losses} D</span>
    <span class="mini-pill">${stats.goalsFor} BP / ${stats.goalsAgainst} BC</span>
  `;
}

function renderCompactTeamsLine(card, showScore) {
  return `
    <div class="widget-inline-match">
      <span>${escapeHtml(card.homeTeam?.name || "Domicile")} <span class="calendar-rank">${escapeHtml(
        card.homeTeam?.rank ? `#${card.homeTeam.rank}` : "NC",
      )}</span></span>
      <strong>${escapeHtml(showScore ? card.scoreLine || "-" : "vs")}</strong>
      <span>${escapeHtml(card.awayTeam?.name || "Exterieur")} <span class="calendar-rank">${escapeHtml(
        card.awayTeam?.rank ? `#${card.awayTeam.rank}` : "NC",
      )}</span></span>
    </div>
  `;
}

function renderDashboardMatch(card, emptyLabel) {
  if (!card) {
    const emptyMessage =
      emptyLabel === "Prochain match" ? "En attente de calendrier officiel." : "Information non disponible pour le moment.";
    return `
      <article class="widget-split-block">
        <div class="widget-split-head">
          <p class="eyebrow">${escapeHtml(emptyLabel)}</p>
        </div>
        <p class="widget-mini-copy">${escapeHtml(emptyMessage)}</p>
      </article>
    `;
  }

  return `
    <article class="widget-split-block">
      <div class="widget-split-head">
        <p class="eyebrow">${escapeHtml(card.title || emptyLabel)}</p>
        <span class="phone-badge">${escapeHtml(card.kickoffDateLabel || "--/--")}</span>
      </div>
      ${card.isFinished ? renderCompactTeamsLine(card, true) : ""}
      ${!card.isFinished ? `<div class="widget-mini-meta"><strong>${escapeHtml(card.kickoffTimeLabel || "--:--")}</strong><span>${escapeHtml(card.venue || "Lieu a confirmer")}</span></div>` : ""}
      ${!card.isFinished ? renderCompactTeamsLine(card, false) : ""}
      <p class="widget-mini-copy">${escapeHtml(card.competition || "")}</p>
    </article>
  `;
}

function renderStandingContext(standing) {
  if (!standing.focusRows?.length) {
    return `<p class="meta-note">Le contexte de classement apparaitra ici apres import.</p>`;
  }

  return `
    <div class="standings-context-grid">
      ${standing.focusRows
        .map(
          (row) => `
            <div class="standings-context-row ${row.tracked ? "tracked" : ""}">
              <span>#${escapeHtml(row.rank ?? "—")}</span>
              <strong>${escapeHtml(row.team)}</strong>
              <span>${escapeHtml(row.points ?? "—")} pts</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWidgetDashboard() {
  const standing = buildStandingSnapshot(state);
  const lastCard = buildWidgetMatchCard(getLastFinishedMatch(state.matches, state.club.trackedTeam), state, "Dernier match");
  const nextCard = buildWidgetMatchCard(getNextMatch(state.matches, state.club.trackedTeam), state, "Prochain match");

  els.widgetDashboard.innerHTML = `
    <div class="widget-dashboard-grid">
      <section class="widget-hero-card">
        <p class="eyebrow">Classement actuel</p>
        <div class="widget-hero-rankline">
          <strong class="widget-hero-rank">#${escapeHtml(standing.rank ?? "—")}</strong>
          <div class="widget-hero-copy">
            <h3>${escapeHtml(state.club.trackedTeam || state.club.name)}</h3>
            <p>${escapeHtml(standing.division || state.season.division || "D?")} · ${escapeHtml(
              standing.points ?? "—",
            )} pts · ${escapeHtml(standing.played ?? "—")} j · Diff ${escapeHtml(standing.goalDifference ?? "—")}</p>
          </div>
        </div>
        ${renderStandingContext(standing)}
      </section>
      <section class="widget-match-column">
        ${renderDashboardMatch(lastCard, "Dernier match")}
        ${renderDashboardMatch(nextCard, "Prochain match")}
      </section>
    </div>
  `;
}

function renderLastMatches() {
  const lastMatches = getLastMatches(5);

  if (!lastMatches.length) {
    els.lastMatchesBlock.innerHTML = `<p class="meta-note">Aucun resultat recent disponible.</p>`;
    return;
  }

  els.lastMatchesBlock.innerHTML = `
    <div class="panel-head">
      <div>
        <p class="eyebrow">Forme recente</p>
        <h2>Derniers resultats</h2>
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
  return getTrackedMatches()
    .filter((match) => {
      const competition = String(match.competition || "").toLowerCase();
      if (filter === "league") return competition.includes("district") || competition.includes("championnat");
      if (filter === "cup") return competition.includes("coupe");
      if (filter === "home") return isTrackedName(match.homeTeam);
      if (filter === "away") return isTrackedName(match.awayTeam);
      if (filter === "future") return !isFinished(match);
      return true;
    })
    .sort(matchSort);
}

function renderCalendar() {
  const matches = filteredMatchesForCalendar();

  if (!matches.length) {
    els.seasonCalendar.innerHTML = `<p class="meta-note">Aucun match a afficher avec ce filtre.</p>`;
    return;
  }

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
          const homeTracked = isTrackedName(match.homeTeam);
          const awayTracked = isTrackedName(match.awayTeam);
          const result = resultFor(match, state.club.trackedTeam);
          const score = isFinished(match) ? `${match.homeScore}-${match.awayScore}` : "—";

          return `
            <div class="calendar-row">
              <div>${escapeHtml(formatShortDate(match.date))}</div>
              <div class="calendar-competition competition">${escapeHtml(match.competition || "Competition")}</div>
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
    els.standingsTable.innerHTML = `<p class="meta-note">Aucun classement charge.</p>`;
    return;
  }

  const standing = buildStandingSnapshot(state);

  els.standingsTable.innerHTML = `
    <div class="standings-overview">
      <span class="overview-chip"><strong>Pos.</strong><span>${escapeHtml(standing.rank ?? "—")}</span></span>
      <span class="overview-chip"><strong>Pts</strong><span>${escapeHtml(standing.points ?? "—")}</span></span>
      <span class="overview-chip"><strong>J</strong><span>${escapeHtml(standing.played ?? "—")}</span></span>
      <span class="overview-chip"><strong>Diff.</strong><span>${escapeHtml(standing.goalDifference ?? "—")}</span></span>
    </div>
    ${renderStandingContext(standing)}
    <div class="table-shell">
      <div class="standings-mobile">
        ${state.standingsTable
          .map((row) => {
            const highlight = isSameTeam(row.team, state.club.trackedTeam);
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
              <th>Equipe</th>
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
                const highlight = isSameTeam(row.team, state.club.trackedTeam);
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
      <p class="meta-note">Classement sous reserve des corrections officielles.</p>
    </div>
  `;
}

function render() {
  const trackedMatches = getTrackedMatches();
  renderHeaderMeta();
  renderSeasonSummary(trackedMatches);
  renderWidgetDashboard();
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
  state = normalizeSeasonData(await loadPublicSeasonData());
  render();
}

async function refresh() {
  try {
    await loadPublicData();
  } catch (error) {
    toast(`Impossible de charger les donnees: ${error.message}`);
  }
}

bindThemeButtons();
els.tabButtons.forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
els.calendarFilter.addEventListener("change", renderCalendar);
setTab(activeTab);
const dataSourceStatus = getDataSourceStatus();
if (dataSourceStatus.provider === "local") {
  toast("Mode local actif. Les changements admin sont testes dans ce navigateur.");
}
refresh();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ignore service worker registration failures in local preview.
    });
  });
}
