const DEFAULT_DATA = {
  club: {
    name: "FC Régny",
    fullName: "Football Club de Régny",
    trackedTeam: "REGNY FC",
    defaultVenue: "Rue du Collège, 42630 Régny",
    sourceLabel: "FFF / SportCorico",
    logoPath: "./assets/logo-fc-regny.png",
  },
  season: {
    label: "2025/2026",
    team: "Seniors 1",
    competition: "District 4 R - Senior - Poule C",
    district: "Délégation du Roannais",
  },
  summary: {
    rank: null,
    points: null,
    played: null,
    goalDifference: null,
  },
  standingsTable: [],
  matches: [],
  lastUpdated: null,
};

export const THEME_STORAGE_KEY = "fcRegnyThemeV2";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : raw;
}

function buildMatchId(match) {
  const datePart = (match.date || "date").slice(0, 10);
  const home = slugify(match.homeTeam || "domicile");
  const away = slugify(match.awayTeam || "exterieur");
  return `${datePart}-${home}-${away}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizeStandingRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    rank: toNumberOrNull(row.rank),
    team: String(row.team || "").trim(),
    points: toNumberOrNull(row.points),
    played: toNumberOrNull(row.played),
    wins: toNumberOrNull(row.wins),
    draws: toNumberOrNull(row.draws),
    losses: toNumberOrNull(row.losses),
    goalsFor: toNumberOrNull(row.goalsFor),
    goalsAgainst: toNumberOrNull(row.goalsAgainst),
    goalDifference: toNumberOrNull(row.goalDifference),
  };
}

function normalizeMatch(match) {
  if (!match || typeof match !== "object") return null;
  const date = normalizeDate(match.date);
  if (!date) return null;

  return {
    id: String(match.id || buildMatchId(match)).trim(),
    date,
    competition: String(match.competition || "").trim(),
    round: String(match.round || "").trim(),
    type: String(match.type || "").trim(),
    homeTeam: String(match.homeTeam || "").trim(),
    awayTeam: String(match.awayTeam || "").trim(),
    homeScore: toNumberOrNull(match.homeScore),
    awayScore: toNumberOrNull(match.awayScore),
    status: String(match.status || "scheduled").trim(),
    venue: String(match.venue || "").trim(),
  };
}

export function normalizeSeasonData(input) {
  const safe = clone(DEFAULT_DATA);
  const data = input && typeof input === "object" ? input : {};
  const standingsTable = Array.isArray(data.standingsTable)
    ? data.standingsTable.map(normalizeStandingRow).filter(Boolean)
    : safe.standingsTable;
  const matches = Array.isArray(data.matches) ? data.matches.map(normalizeMatch).filter(Boolean) : safe.matches;

  return {
    club: {
      ...safe.club,
      ...(data.club || {}),
    },
    season: {
      ...safe.season,
      ...(data.season || {}),
    },
    summary: {
      ...safe.summary,
      ...(data.summary || {}),
      rank: toNumberOrNull(data.summary?.rank ?? safe.summary.rank),
      points: toNumberOrNull(data.summary?.points ?? safe.summary.points),
      played: toNumberOrNull(data.summary?.played ?? safe.summary.played),
      goalDifference: toNumberOrNull(data.summary?.goalDifference ?? safe.summary.goalDifference),
    },
    standingsTable: standingsTable.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    matches: matches.sort(matchSort),
    lastUpdated: normalizeDate(data.lastUpdated) || null,
  };
}

export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Ignore localStorage failures.
  }

  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = safeTheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
  } catch {
    // Ignore localStorage failures.
  }

  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === safeTheme);
  });

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", safeTheme === "light" ? "#ff7a18" : "#050505");
}

export function bindThemeButtons() {
  applyTheme(loadTheme());
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeOption));
  });
}

export function matchSort(a, b) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

export function isFinished(match) {
  return (
    match.status === "finished" ||
    (match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined)
  );
}

export function normalizeTeamName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function teamTokens(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/ ]+/g, " ")
    .replace(/[/.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function teamSimilarityScore(left, right) {
  const leftNorm = normalizeTeamName(left);
  const rightNorm = normalizeTeamName(right);
  if (!leftNorm || !rightNorm) return -1;
  if (leftNorm === rightNorm) return 120;
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return 85 - Math.abs(leftNorm.length - rightNorm.length);
  }

  const leftTokens = teamTokens(left);
  const rightTokens = teamTokens(right);
  let score = 0;

  leftTokens.forEach((leftToken) => {
    if (rightTokens.includes(leftToken)) {
      score += leftToken.length >= 4 ? 12 : 5;
      return;
    }

    const closeToken = rightTokens.find(
      (rightToken) =>
        (leftToken.length >= 4 || rightToken.length >= 4) &&
        (leftToken.startsWith(rightToken) || rightToken.startsWith(leftToken)),
    );

    if (closeToken) score += 8;
  });

  const leftDigits = leftTokens.filter((token) => /^\d+$/.test(token)).join("-");
  const rightDigits = rightTokens.filter((token) => /^\d+$/.test(token)).join("-");
  if (leftDigits && rightDigits && leftDigits === rightDigits) {
    score += 6;
  }

  return score;
}

export function findTeamStanding(standingsTable, teamName) {
  let bestRow = null;
  let bestScore = 0;

  standingsTable.forEach((row) => {
    const score = teamSimilarityScore(teamName, row.team);
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  });

  return bestScore >= 12 ? bestRow : null;
}

export function resultFor(match, trackedTeam) {
  const tracked = normalizeTeamName(trackedTeam);
  const home = normalizeTeamName(match.homeTeam);
  const away = normalizeTeamName(match.awayTeam);
  const isHome = home.includes(tracked) || tracked.includes(home);
  const isAway = away.includes(tracked) || tracked.includes(away);

  if (!isFinished(match) || (!isHome && !isAway)) {
    return { label: "A", cls: "" };
  }

  const goalsFor = isHome ? match.homeScore : match.awayScore;
  const goalsAgainst = isHome ? match.awayScore : match.homeScore;

  if (goalsFor > goalsAgainst) return { label: "V", cls: "win" };
  if (goalsFor < goalsAgainst) return { label: "D", cls: "loss" };
  return { label: "N", cls: "draw" };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
}

export function formatShortDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--/--";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(/\.$/, "");
}

export function formatUpdatedAt(iso) {
  if (!iso) return "Jamais mise à jour";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Jamais mise à jour";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function monthKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

export function getNextMatch(matches) {
  const now = Date.now();
  return [...matches].sort(matchSort).find((match) => !isFinished(match) && new Date(match.date).getTime() >= now);
}

export function getLastFinishedMatch(matches) {
  return [...matches]
    .filter(isFinished)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
}

export function formatWidgetDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--/--";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replace(/\.$/, "");
}

export function formatWidgetTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWidgetDateLong(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date a confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function buildWidgetTeam(standingsTable, trackedTeam, teamName, score) {
  const standing = findTeamStanding(standingsTable, teamName);
  return {
    name: teamName,
    rank: standing?.rank ?? null,
    points: standing?.points ?? null,
    tracked: teamSimilarityScore(teamName, trackedTeam) >= 12,
    score,
  };
}

export function buildWidgetMatchCard(match, seasonData, title) {
  if (!match) return null;

  const homeTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.homeTeam, match.homeScore);
  const awayTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.awayTeam, match.awayScore);
  const venue = match.venue || seasonData.club.defaultVenue || "Lieu a confirmer";
  const finished = isFinished(match);

  return {
    title,
    competition: match.competition || seasonData.season.competition,
    round: match.round || "",
    venue,
    venueShort: venue,
    kickoffIso: match.date,
    kickoffDateLabel: formatWidgetDate(match.date),
    kickoffDateLongLabel: formatWidgetDateLong(match.date),
    kickoffTimeLabel: formatWidgetTime(match.date),
    status: match.status,
    scoreLine: finished ? `${match.homeScore ?? "-"} - ${match.awayScore ?? "-"}` : "Match a venir",
    homeTeam,
    awayTeam,
    trackedSide: homeTeam.tracked ? "home" : awayTeam.tracked ? "away" : "neutral",
    isFinished: finished,
    sourceLastUpdated: seasonData.lastUpdated,
  };
}

export function buildWidgetPayloadV2(seasonData) {
  const nextMatch = getNextMatch(seasonData.matches);
  const lastMatch = getLastFinishedMatch(seasonData.matches);

  if (!nextMatch && !lastMatch) {
    return {
      widgetVersion: 2,
      generatedAt: new Date().toISOString(),
      refreshAfterSeconds: 1800,
      mode: "empty",
      club: {
        name: seasonData.club.name,
        logoPath: seasonData.club.logoPath,
      },
      season: {
        label: seasonData.season.label,
        team: seasonData.season.team,
      },
      lastMatch: null,
      nextMatch: null,
      deepLinks: {
        app: "./index.html",
        widget: "./widget.html",
      },
    };
  }

  return {
    widgetVersion: 2,
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: 1800,
    mode: "split",
    club: {
      name: seasonData.club.name,
      fullName: seasonData.club.fullName,
      logoPath: seasonData.club.logoPath,
      trackedTeam: seasonData.club.trackedTeam,
    },
    season: {
      label: seasonData.season.label,
      team: seasonData.season.team,
      competition: seasonData.season.competition,
    },
    lastMatch: buildWidgetMatchCard(lastMatch, seasonData, "Dernier match"),
    nextMatch: buildWidgetMatchCard(nextMatch, seasonData, "Prochain match"),
    deepLinks: {
      app: "./index.html",
      widget: "./widget.html",
    },
  };
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body?.error ? body.error : response.statusText;
    throw new Error(message || "Erreur réseau");
  }

  return body;
}

export function parseFrenchDate(dateText) {
  const months = {
    jan: 0,
    janvier: 0,
    fev: 1,
    fevrier: 1,
    "fév": 1,
    "février": 1,
    mar: 2,
    mars: 2,
    avr: 3,
    avril: 3,
    mai: 4,
    juin: 5,
    juil: 6,
    juillet: 6,
    aout: 7,
    "août": 7,
    sep: 8,
    sept: 8,
    septembre: 8,
    oct: 9,
    octobre: 9,
    nov: 10,
    novembre: 10,
    dec: 11,
    decembre: 11,
    "déc": 11,
    "décembre": 11,
  };

  const clean = String(dateText || "").toLowerCase().replace(/\./g, "");
  const match = clean.match(/(\d{1,2})\s+([a-zéûôîàùç]+)\s+(\d{4}).*?(\d{1,2})h(\d{2})?/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = months[match[2]];
  const year = Number(match[3]);
  const hour = Number(match[4] || 15);
  const minute = Number(match[5] || 0);
  if (month === undefined) return null;

  const date = new Date(year, month, day, hour, minute, 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parsePastedText(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const matches = [];
  const compactRegex = /^(.*?)([A-Za-zÀ-ÿ .'/-]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s*-\s*(\d+)\s+(.+)$/;

  for (const line of lines) {
    const compact = line.match(compactRegex);
    if (!compact) continue;
    const [, competitionRaw, homeRaw, dateRaw, homeScore, awayScore, awayRaw] = compact;
    const [day, month, year] = dateRaw.split("/").map(Number);
    const iso = new Date(year, month - 1, day, 15, 0, 0).toISOString();

    matches.push(
      normalizeMatch({
        id: `${dateRaw}-${homeRaw}-${awayRaw}`,
        date: iso,
        competition: competitionRaw.trim() || "Compétition",
        round: "",
        type: competitionRaw.toLowerCase().includes("coupe") ? "cup" : "championship",
        homeTeam: homeRaw.trim(),
        awayTeam: awayRaw.trim(),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        status: "finished",
        venue: "",
      })
    );
  }

  for (let index = 0; index < lines.length - 4; index += 1) {
    const iso = parseFrenchDate(lines[index]);
    if (!iso) continue;
    const competition = lines[index + 1] || "Compétition";
    const homeTeam = lines[index + 2] || "Domicile";
    const score = (lines[index + 3] || "").match(/^(\d+)\s+(\d+)$/);
    const awayTeam = lines[index + 4] || "Extérieur";
    if (!score) continue;

    matches.push(
      normalizeMatch({
        id: `${iso}-${homeTeam}-${awayTeam}`,
        date: iso,
        competition,
        round: "",
        type: competition.toLowerCase().includes("coupe") ? "cup" : "championship",
        homeTeam,
        awayTeam,
        homeScore: Number(score[1]),
        awayScore: Number(score[2]),
        status: "finished",
        venue: "",
      })
    );
  }

  const unique = new Map();
  matches.filter(Boolean).forEach((match) => unique.set(match.id, match));
  return [...unique.values()].sort(matchSort);
}

export function computeSeasonStats(matches, trackedTeam) {
  const finished = matches.filter(isFinished);
  const results = finished.map((match) => resultFor(match, trackedTeam));
  let goalsFor = 0;
  let goalsAgainst = 0;
  const tracked = normalizeTeamName(trackedTeam);

  for (const match of finished) {
    const home = normalizeTeamName(match.homeTeam);
    const away = normalizeTeamName(match.awayTeam);
    const isHome = home.includes(tracked) || tracked.includes(home);
    const isAway = away.includes(tracked) || tracked.includes(away);
    if (isHome) {
      goalsFor += Number(match.homeScore || 0);
      goalsAgainst += Number(match.awayScore || 0);
    }
    if (isAway) {
      goalsFor += Number(match.awayScore || 0);
      goalsAgainst += Number(match.homeScore || 0);
    }
  }

  return {
    total: matches.length,
    wins: results.filter((result) => result.label === "V").length,
    draws: results.filter((result) => result.label === "N").length,
    losses: results.filter((result) => result.label === "D").length,
    goalsFor,
    goalsAgainst,
  };
}
