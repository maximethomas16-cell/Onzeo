import { buildWidgetPayloadV2, escapeHtml } from "./shared.js?v=roannais-3";
import { loadPublicSeasonData } from "./data-source.js?v=roannais-3";

const el = document.getElementById("widgetStandalone");

function formatRank(rank) {
  return rank ? `#${rank}` : "NC";
}

function renderEmpty(data) {
  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget ecran d'accueil</p>
        <h2 class="widget-mini-title">${escapeHtml(data.club?.name || "FC Regny")}</h2>
      </div>
      <span class="phone-badge">En attente</span>
    </div>
    <p class="widget-mini-copy">Ajoute ou importe les matchs de l'equipe suivie pour alimenter le widget.</p>
  `;
}

function renderTeamsLine(card, showScore) {
  return `
    <div class="widget-inline-match">
      <span>${escapeHtml(card.homeTeam?.name || "Domicile")} <span class="calendar-rank">${escapeHtml(formatRank(card.homeTeam?.rank))}</span></span>
      <strong>${escapeHtml(showScore ? card.scoreLine || "-" : "vs")}</strong>
      <span>${escapeHtml(card.awayTeam?.name || "Exterieur")} <span class="calendar-rank">${escapeHtml(formatRank(card.awayTeam?.rank))}</span></span>
    </div>
  `;
}

function renderStanding(data) {
  const standing = data.standing || {};
  return `
    <section class="widget-split-block widget-standing-block">
      <div class="widget-split-head">
        <p class="eyebrow">Classement</p>
        <span class="phone-badge">${escapeHtml(standing.division || data.season?.division || "D?")}</span>
      </div>
      <div class="widget-hero-rankline">
        <strong class="widget-hero-rank">#${escapeHtml(standing.rank ?? "—")}</strong>
        <div class="widget-hero-copy">
          <h3>${escapeHtml(data.club?.trackedTeam || data.club?.name || "Equipe")}</h3>
          <p>${escapeHtml(standing.points ?? "—")} pts · ${escapeHtml(standing.played ?? "—")} j · Diff ${escapeHtml(
            standing.goalDifference ?? "—",
          )}</p>
        </div>
      </div>
      <div class="standings-context-grid compact">
        ${(standing.focusRows || [])
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
    </section>
  `;
}

function renderLastMatch(card) {
  if (!card) {
    return `
      <section class="widget-split-block">
        <div class="widget-split-head">
          <p class="eyebrow">Dernier match</p>
        </div>
        <p class="widget-mini-copy">Aucun resultat recent disponible.</p>
      </section>
    `;
  }

  return `
    <section class="widget-split-block">
      <div class="widget-split-head">
        <p class="eyebrow">Dernier match</p>
        <span class="phone-badge">${escapeHtml(card.kickoffDateLabel || "--/--")}</span>
      </div>
      ${renderTeamsLine(card, true)}
      <p class="widget-mini-copy">${escapeHtml(card.competition || "")}</p>
    </section>
  `;
}

function renderNextMatch(card) {
  if (!card) {
    return `
      <section class="widget-split-block">
        <div class="widget-split-head">
          <p class="eyebrow">Prochain match</p>
        </div>
        <p class="widget-mini-copy">Aucun prochain match saisi pour le moment.</p>
      </section>
    `;
  }

  return `
    <section class="widget-split-block">
      <div class="widget-split-head">
        <p class="eyebrow">Prochain match</p>
        <span class="phone-badge">${escapeHtml(card.kickoffDateLabel || "--/--")}</span>
      </div>
      <div class="widget-mini-meta">
        <strong>${escapeHtml(card.kickoffTimeLabel || "--:--")}</strong>
        <span>${escapeHtml(card.venue || "Lieu a confirmer")}</span>
      </div>
      ${renderTeamsLine(card, false)}
      <p class="widget-mini-copy">${escapeHtml(card.competition || "")}</p>
    </section>
  `;
}

function renderWidget(data) {
  if (!data || (!data.lastMatch && !data.nextMatch && !data.standing)) {
    renderEmpty(data || {});
    return;
  }

  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget Android ready</p>
        <h1 class="widget-mini-title">${escapeHtml(data.club?.name || "FC Regny")}</h1>
      </div>
      <span class="phone-badge">${escapeHtml(data.season?.team || "Seniors 1")}</span>
    </div>
    ${renderStanding(data)}
    <div class="widget-split-stack">
      ${renderLastMatch(data.lastMatch)}
      ${renderNextMatch(data.nextMatch)}
    </div>
  `;
}

async function init() {
  const seasonData = await loadPublicSeasonData();
  renderWidget(buildWidgetPayloadV2(seasonData));
}

init().catch(() => {
  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget ecran d'accueil</p>
        <h2 class="widget-mini-title">Indisponible</h2>
      </div>
    </div>
    <p class="widget-mini-copy">Impossible de charger les donnees du widget pour le moment.</p>
  `;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ignore service worker registration failures in local preview.
    });
  });
}
