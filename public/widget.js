import { escapeHtml, fetchJson } from "./shared.js";

const el = document.getElementById("widgetStandalone");

function formatRank(rank) {
  return rank ? `#${rank}` : "NC";
}

function renderEmpty(data) {
  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget écran d'accueil</p>
        <h2 class="widget-mini-title">${escapeHtml(data.club?.name || "FC Régny")}</h2>
      </div>
      <span class="phone-badge">En attente</span>
    </div>
    <p class="widget-mini-copy">Ajoute des matchs dans l'admin pour alimenter le dernier et le prochain rendez-vous.</p>
  `;
}

function renderTeamsLine(card, showScore) {
  return `
    <div class="widget-inline-match">
      <span>${escapeHtml(card.homeTeam?.name || "Domicile")} <span class="calendar-rank">${escapeHtml(formatRank(card.homeTeam?.rank))}</span></span>
      <strong>${escapeHtml(showScore ? card.scoreLine || "—" : "vs")}</strong>
      <span>${escapeHtml(card.awayTeam?.name || "Extérieur")} <span class="calendar-rank">${escapeHtml(formatRank(card.awayTeam?.rank))}</span></span>
    </div>
  `;
}

function renderLastMatch(card) {
  if (!card) {
    return `
      <section class="widget-split-block">
        <div class="widget-split-head">
          <p class="eyebrow">Dernier match</p>
        </div>
        <p class="widget-mini-copy">Aucun résultat récent disponible.</p>
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
        <span>•</span>
        <span>${escapeHtml(card.venue || "Lieu à confirmer")}</span>
      </div>
      ${renderTeamsLine(card, false)}
      <p class="widget-mini-copy">${escapeHtml(card.competition || "")}</p>
    </section>
  `;
}

function renderWidget(data) {
  if (!data || (!data.lastMatch && !data.nextMatch)) {
    renderEmpty(data || {});
    return;
  }

  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget Android ready</p>
        <h1 class="widget-mini-title">${escapeHtml(data.club?.name || "FC Régny")}</h1>
      </div>
      <span class="phone-badge">${escapeHtml(data.season?.team || "Seniors 1")}</span>
    </div>
    <div class="widget-split-stack">
      ${renderLastMatch(data.lastMatch)}
      ${renderNextMatch(data.nextMatch)}
    </div>
  `;
}

async function init() {
  const payload = await fetchJson("/api/public/widget", { method: "GET" });
  renderWidget(payload.data);
}

init().catch(() => {
  el.innerHTML = `
    <div class="widget-mini-head">
      <div>
        <p class="eyebrow">Widget écran d'accueil</p>
        <h2 class="widget-mini-title">Indisponible</h2>
      </div>
    </div>
    <p class="widget-mini-copy">Impossible de charger les données du widget pour le moment.</p>
  `;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore service worker registration failures in local preview.
    });
  });
}
