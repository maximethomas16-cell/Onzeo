import { buildWidgetPayloadV2, escapeHtml, getClubLogoUrl } from "./shared.js?v=roannais-4";
import { loadPublicSeasonData } from "./data-source.js?v=roannais-4";

const el = document.getElementById("widgetStandalone");
const STANDING_WINDOW_SIZE = 4;
const previewState = {
  data: null,
  standingOffset: 0,
};

function formatRank(rank) {
  return rank ? `${rank}e` : "NC";
}

function joinParts(parts) {
  return parts.filter(Boolean).join(" - ");
}

function getStandingRows(data) {
  return data?.standing?.rows?.length ? data.standing.rows : data?.standing?.focusRows || [];
}

function getPreferredStandingOffset(rows) {
  if (!rows.length || rows.length <= STANDING_WINDOW_SIZE) {
    return 0;
  }

  const trackedIndex = rows.findIndex((row) => row?.tracked);
  if (trackedIndex < 0) {
    return 0;
  }

  return Math.max(0, Math.min(rows.length - STANDING_WINDOW_SIZE, trackedIndex - 2));
}

function clampStandingOffset(rows, offset) {
  return Math.max(0, Math.min(offset, Math.max(0, rows.length - STANDING_WINDOW_SIZE)));
}

function buildCompactLine(card) {
  if (!card) {
    return "Dernier match indisponible";
  }

  return joinParts([
    formatRank(card.homeTeam?.rank),
    `${card.homeTeam?.name || "Domicile"} ${card.scoreLine || "-"} ${card.awayTeam?.name || "Exterieur"}`,
    formatRank(card.awayTeam?.rank),
  ]);
}

function buildNormalLastLine(card) {
  if (!card) {
    return "Dernier: aucun resultat recent";
  }

  return `Dernier | ${card.kickoffDateLabel || "--/--"} | ${buildCompactLine(card)}`;
}

function buildNormalNextLine(card) {
  if (!card) {
    return "Prochain: en attente de calendrier officiel";
  }

  return joinParts([
    "Prochain",
    `${card.kickoffDateLabel || "--/--"} ${card.kickoffTimeLabel || "--:--"}`.trim(),
    card.venue || "Lieu a confirmer",
  ]);
}

function renderEmpty(data) {
  const clubName = data.club?.name || "FC Regny";
  const crestUrl = getClubLogoUrl(data.club || { name: clubName });
  document.title = `${clubName} - Vue widget`;
  el.innerHTML = `
    <div class="widget-preview-page">
      <div class="widget-mini-head">
        <div class="widget-brand-line">
          <img class="mini-crest" src="${escapeHtml(crestUrl)}" alt="Logo ${escapeHtml(clubName)}" />
          <div>
            <p class="eyebrow">Widgets Android</p>
            <h1 class="widget-mini-title">${escapeHtml(clubName)}</h1>
          </div>
        </div>
        <span class="phone-badge">En attente</span>
      </div>
      <p class="widget-mini-copy">Ajoute ou importe les matchs de l equipe suivie pour alimenter les trois tailles du widget.</p>
    </div>
  `;
}

function renderStandingBadge(standing) {
  if (!standing?.rank) {
    return `<span class="phone-badge">Classement NC</span>`;
  }

  return `<span class="phone-badge">${escapeHtml(formatRank(standing.rank))} sur ${escapeHtml(standing.totalTeams ?? "?")}</span>`;
}

function renderStandingHero(data) {
  const standing = data.standing || {};
  return `
    <section class="widget-split-block widget-standing-block">
      <div class="widget-split-head">
        <p class="eyebrow">Classement</p>
        <span class="phone-badge">${escapeHtml(standing.division || data.season?.division || "D?")}</span>
      </div>
      <div class="widget-hero-rankline">
        <strong class="widget-hero-rank">${escapeHtml(formatRank(standing.rank))}</strong>
        <div class="widget-hero-copy">
          <h3>${escapeHtml(data.club?.trackedTeam || data.club?.name || "Equipe")}</h3>
          <p>${escapeHtml(standing.points ?? "--")} pts - ${escapeHtml(standing.played ?? "--")} j - Diff ${escapeHtml(
            standing.goalDifference ?? "--",
          )}</p>
        </div>
      </div>
    </section>
  `;
}

function renderMatchBlock(title, text) {
  return `
    <section class="widget-split-block">
      <div class="widget-split-head">
        <p class="eyebrow">${escapeHtml(title)}</p>
      </div>
      <p class="widget-density-line widget-density-line-large">${escapeHtml(text)}</p>
    </section>
  `;
}

function renderFullStandings(data) {
  const rows = getStandingRows(data);
  if (!rows.length) {
    return `<p class="widget-mini-copy">Classement non disponible.</p>`;
  }

  const offset = clampStandingOffset(rows, previewState.standingOffset);
  const visibleRows = rows.slice(offset, offset + STANDING_WINDOW_SIZE);
  const maxOffset = Math.max(0, rows.length - STANDING_WINDOW_SIZE);
  const lastRow = rows[rows.length - 1];
  previewState.standingOffset = offset;

  return `
    <div class="widget-standing-nav">
      <span class="widget-standing-window">${escapeHtml(`${Math.min(rows.length, offset + 1)}-${Math.min(rows.length, offset + visibleRows.length)} / ${rows.length}`)}</span>
      <div class="widget-standing-nav-actions">
        <button class="widget-standing-arrow" data-standing-nav="up" type="button" ${offset <= 0 ? "disabled" : ""}>&#9650;</button>
        <button class="widget-standing-arrow" data-standing-nav="down" type="button" ${offset >= maxOffset ? "disabled" : ""}>&#9660;</button>
      </div>
    </div>
    <div class="widget-standings-list">
      ${visibleRows
        .map(
          (row) => `
            <div class="widget-standings-line ${row.tracked ? "tracked" : ""}">
              <span>${escapeHtml(formatRank(row.rank))}</span>
              <strong>${escapeHtml(row.team || "Equipe")}</strong>
              <span>${escapeHtml(row.points ?? "--")} pts</span>
              <span>J${escapeHtml(row.played ?? "--")}</span>
              <span>Diff ${escapeHtml(row.goalDifference ?? "--")}</span>
            </div>
          `,
        )
        .join("")}
    </div>
    <p class="widget-standing-tail">Dernier: ${escapeHtml(formatRank(lastRow?.rank))} - ${escapeHtml(lastRow?.team || "Equipe")} - ${escapeHtml(lastRow?.points ?? "--")} pts</p>
  `;
}

function renderCompactCard(data, crestUrl) {
  return `
    <article class="widget-preview-card widget-preview-compact">
      <div class="widget-preview-label">Compact</div>
      <div class="widget-preview-surface widget-card widget-density-card widget-density-card-compact">
        <div class="widget-density-topline">
          <div class="widget-brand-line">
            <img class="mini-crest mini-crest-compact" src="${escapeHtml(crestUrl)}" alt="Logo ${escapeHtml(data.club?.name || "Club")}" />
            <strong class="widget-density-club">${escapeHtml(data.club?.name || "Club")}</strong>
          </div>
          ${renderStandingBadge(data.standing)}
        </div>
        <p class="widget-density-line widget-density-line-compact">${escapeHtml(buildCompactLine(data.lastMatch))}</p>
      </div>
    </article>
  `;
}

function renderNormalCard(data, crestUrl) {
  return `
    <article class="widget-preview-card widget-preview-normal">
      <div class="widget-preview-label">Normal</div>
      <div class="widget-preview-surface widget-card widget-density-card widget-density-card-normal">
        <div class="widget-density-topline">
          <div class="widget-brand-line">
            <img class="mini-crest mini-crest-compact" src="${escapeHtml(crestUrl)}" alt="Logo ${escapeHtml(data.club?.name || "Club")}" />
            <strong class="widget-density-club">${escapeHtml(data.club?.name || "Club")}</strong>
          </div>
          <span class="phone-badge">${escapeHtml(data.season?.division || data.season?.team || "Equipe")}</span>
        </div>
        <div class="widget-density-stack">
          <p class="widget-density-line">${escapeHtml(buildNormalLastLine(data.lastMatch))}</p>
          <p class="widget-density-line">${escapeHtml(buildNormalNextLine(data.nextMatch))}</p>
        </div>
      </div>
    </article>
  `;
}

function renderLargeCard(data, crestUrl) {
  return `
    <article class="widget-preview-card widget-preview-large">
      <div class="widget-preview-label">Grand</div>
      <div class="widget-preview-surface widget-card widget-mini">
        <div class="widget-mini-head">
          <div class="widget-brand-line">
            <img class="mini-crest" src="${escapeHtml(crestUrl)}" alt="Logo ${escapeHtml(data.club?.name || "Club")}" />
            <div>
              <p class="eyebrow">Vue complete</p>
              <h2 class="widget-mini-title">${escapeHtml(data.club?.name || "Club")}</h2>
            </div>
          </div>
          <span class="phone-badge">${escapeHtml(data.season?.division || "D?")}</span>
        </div>
        ${renderStandingHero(data)}
        <div class="widget-split-stack">
          ${renderMatchBlock("Dernier match", buildNormalLastLine(data.lastMatch))}
          ${renderMatchBlock("Prochain match", buildNormalNextLine(data.nextMatch))}
        </div>
        <section class="widget-split-block">
          <div class="widget-split-head">
            <p class="eyebrow">Classement complet</p>
            <span class="phone-badge">${escapeHtml(data.standing?.competition || "District")}</span>
          </div>
          ${renderFullStandings(data)}
        </section>
      </div>
    </article>
  `;
}

function bindStandingNav() {
  const rows = getStandingRows(previewState.data);
  const buttons = el.querySelectorAll("[data-standing-nav]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.getAttribute("data-standing-nav") === "down" ? 1 : -1;
      previewState.standingOffset = clampStandingOffset(rows, previewState.standingOffset + delta);
      renderWidget(previewState.data);
    });
  });
}

function renderWidget(data) {
  if (!data || (!data.lastMatch && !data.nextMatch && !data.standing)) {
    renderEmpty(data || {});
    return;
  }

  const clubName = data.club?.name || "FC Regny";
  const crestUrl = getClubLogoUrl(data.club || { name: clubName });
  document.title = `${clubName} - Vue widget`;
  previewState.data = data;
  previewState.standingOffset = clampStandingOffset(getStandingRows(data), previewState.standingOffset);

  el.innerHTML = `
    <div class="widget-preview-page">
      <div class="widget-mini-head widget-preview-head">
        <div class="widget-brand-line">
          <img class="mini-crest" src="${escapeHtml(crestUrl)}" alt="Logo ${escapeHtml(clubName)}" />
          <div>
            <p class="eyebrow">Widgets Android ready</p>
            <h1 class="widget-mini-title">${escapeHtml(clubName)}</h1>
          </div>
        </div>
        <span class="phone-badge">${escapeHtml(data.season?.team || "Seniors 1")}</span>
      </div>
      <p class="widget-mini-copy widget-preview-copy">Compact pour le score express, normal pour le score et le prochain rendez-vous, grand pour la vue complete et le classement pilotable.</p>
      <div class="widget-preview-grid">
        ${renderCompactCard(data, crestUrl)}
        ${renderNormalCard(data, crestUrl)}
        ${renderLargeCard(data, crestUrl)}
      </div>
    </div>
  `;

  bindStandingNav();
}

async function init() {
  const seasonData = await loadPublicSeasonData();
  const widgetData = buildWidgetPayloadV2(seasonData);
  previewState.standingOffset = getPreferredStandingOffset(getStandingRows(widgetData));
  renderWidget(widgetData);
}

init().catch(() => {
  el.innerHTML = `
    <div class="widget-preview-page">
      <div class="widget-mini-head">
        <div>
          <p class="eyebrow">Widgets Android</p>
          <h2 class="widget-mini-title">Indisponible</h2>
        </div>
      </div>
      <p class="widget-mini-copy">Impossible de charger les donnees du widget pour le moment.</p>
    </div>
  `;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ignore service worker registration failures in local preview.
    });
  });
}
