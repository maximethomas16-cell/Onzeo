const DEFAULT_DATA = {
  club: {
    name: "FC Regny",
    fullName: "Football Club de Regny",
    trackedTeam: "REGNY FC",
    defaultVenue: "Rue du College, 42630 Regny",
    sourceLabel: "FFF / SportCorico",
    logoPath: "./assets/logo-fc-regny.png",
  },
  season: {
    label: "2025/2026",
    team: "Seniors 1",
    division: "D4",
    competition: "District 4 R - Senior - Poule C",
    district: "Delegation du Roannais",
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

const DEFAULT_CLUB_LOGO_PATH = DEFAULT_DATA.club.logoPath;
const DEFAULT_CLUB_NAME = DEFAULT_DATA.club.name;

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

function inferDivisionFromCompetition(value) {
  const raw = String(value || "");
  const match = raw.match(/district\s*([1-5])/i);
  return match ? `D${match[1]}` : "";
}

export function normalizeDivision(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const direct = raw.match(/D\s*([1-5])/);
  if (direct) return `D${direct[1]}`;
  const district = raw.match(/DISTRICT\s*([1-5])/);
  if (district) return `D${district[1]}`;
  const digit = raw.match(/\b([1-5])\b/);
  return digit ? `D${digit[1]}` : "";
}

function titleizeToken(token) {
  const upper = token.toUpperCase();
  const acronyms = new Set(["AS", "CS", "ES", "FC", "JS", "OC", "OL", "OS", "SC", "US"]);
  if (!token) return "";
  if (/^\d+$/.test(token)) return token;
  if (acronyms.has(upper) || token.length <= 2) return upper;
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

function prettifyTeamName(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .map(titleizeToken)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferClubNameFromTeamName(teamName) {
  const raw = String(teamName || "")
    .replace(/\s+[1-9]$/u, "")
    .replace(/\s+[ABCD]$/u, "")
    .trim();
  return prettifyTeamName(raw);
}

export function clubInitials(value) {
  const stopWords = new Set(["DE", "DES", "DU", "LA", "LE", "LES", "ET"]);
  const genericWords = new Set(["FOOTBALL", "CLUB", "FC", "AS", "US", "ES", "SC", "JS", "OL", "OC", "OS"]);
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  const significant = tokens.filter((token) => {
    const upper = token.toUpperCase();
    return !stopWords.has(upper) && !genericWords.has(upper) && !/^\d+$/.test(upper);
  });

  const source = significant.length ? significant : tokens.filter((token) => !/^\d+$/.test(token));
  const initials = source
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join("");

  return initials || "CL";
}

export function buildClubBadgeDataUri(clubName) {
  const initials = clubInitials(clubName);
  const safeLabel = String(clubName || "Club")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${safeLabel}">
      <defs>
        <linearGradient id="clubBadgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffb347"/>
          <stop offset="48%" stop-color="#f28c1b"/>
          <stop offset="100%" stop-color="#183064"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="144" height="144" rx="40" fill="url(#clubBadgeGradient)"/>
      <rect x="16" y="16" width="128" height="128" rx="34" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
      <text x="80" y="96" text-anchor="middle" font-family="Aptos, Trebuchet MS, Segoe UI, sans-serif" font-size="54" font-weight="800" fill="#fff8f1">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveLogoPath(logoPath, baseUrl = window.location.href) {
  const raw = String(logoPath || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

export function getClubLogoUrl(club, baseUrl = window.location.href) {
  const resolved = resolveLogoPath(club?.logoPath, baseUrl);
  return resolved || buildClubBadgeDataUri(club?.name || club?.trackedTeam || "Club");
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

  const normalized = {
    club: {
      ...safe.club,
      ...(data.club || {}),
    },
    season: {
      ...safe.season,
      ...(data.season || {}),
      division:
        normalizeDivision(data.season?.division) ||
        inferDivisionFromCompetition(data.season?.competition) ||
        safe.season.division,
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

  return syncSummaryFromStandings(normalized);
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

const TEAM_STOP_TOKENS = new Set([
  "A",
  "AS",
  "C",
  "CA",
  "CO",
  "CS",
  "DE",
  "DES",
  "DU",
  "E",
  "ES",
  "ET",
  "FC",
  "JS",
  "L",
  "LA",
  "LE",
  "LES",
  "O",
  "OC",
  "OL",
  "OS",
  "S",
  "SC",
  "ST",
  "STE",
  "U",
  "US",
]);

const TEAM_GENERIC_CORE_TOKENS = new Set(["FOOT", "FOOTBALL", "SECTION", "SPORT", "SPORTIVE"]);

function normalizeTeamToken(token) {
  return String(token || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildTeamIdentity(value) {
  const tokens = teamTokens(value).map(normalizeTeamToken).filter(Boolean);
  const squadNumber = [...tokens].reverse().find((token) => /^\d+$/.test(token)) || "";
  const nameTokens = tokens.filter((token) => !/^\d+$/.test(token) && !TEAM_STOP_TOKENS.has(token));
  const coreTokens = nameTokens.filter((token) => !TEAM_GENERIC_CORE_TOKENS.has(token) && token.length >= 2);
  const acronym = nameTokens.length >= 2 ? nameTokens.map((token) => token.charAt(0)).join("") : nameTokens[0] || "";

  return {
    acronym,
    coreTokens,
    squadNumber,
    tokens,
  };
}

export function teamSimilarityScore(left, right) {
  const leftNorm = normalizeTeamName(left);
  const rightNorm = normalizeTeamName(right);
  if (!leftNorm || !rightNorm) return -1;
  if (leftNorm === rightNorm) return 120;
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return 85 - Math.abs(leftNorm.length - rightNorm.length);
  }

  const leftIdentity = buildTeamIdentity(left);
  const rightIdentity = buildTeamIdentity(right);
  let score = 0;
  let matchedCoreTokenCount = 0;

  leftIdentity.coreTokens.forEach((leftToken) => {
    if (rightIdentity.coreTokens.includes(leftToken)) {
      matchedCoreTokenCount += 1;
      score += leftToken.length >= 4 ? 14 : 6;
      return;
    }

    const closeToken = rightIdentity.coreTokens.find(
      (rightToken) =>
        (leftToken.length >= 4 || rightToken.length >= 4) &&
        (leftToken.startsWith(rightToken) || rightToken.startsWith(leftToken)),
    );

    if (closeToken) {
      matchedCoreTokenCount += 1;
      score += 10;
    }
  });

  const acronymMatches =
    (leftIdentity.acronym && leftIdentity.acronym === rightIdentity.acronym && leftIdentity.acronym.length >= 2) ||
    leftIdentity.coreTokens.includes(rightIdentity.acronym) ||
    rightIdentity.coreTokens.includes(leftIdentity.acronym);

  if (acronymMatches) {
    score += 20;
  }

  if (leftIdentity.squadNumber && rightIdentity.squadNumber) {
    if (leftIdentity.squadNumber === rightIdentity.squadNumber) {
      score += 8;
    } else {
      score -= 12;
    }
  }

  if (!matchedCoreTokenCount && !acronymMatches) {
    return Math.max(score, 0);
  }

  return score;
}

export function isSameTeam(left, right) {
  return teamSimilarityScore(left, right) >= 18;
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

  return bestScore >= 18 ? bestRow : null;
}

export function getTrackedStanding(standingsTable, trackedTeam) {
  return findTeamStanding(standingsTable || [], trackedTeam);
}

export function isTrackedTeamMatch(match, trackedTeam) {
  if (!trackedTeam) return true;
  return isSameTeam(match?.homeTeam, trackedTeam) || isSameTeam(match?.awayTeam, trackedTeam);
}

export function filterMatchesForTeam(matches, trackedTeam) {
  return [...(matches || [])].filter((match) => isTrackedTeamMatch(match, trackedTeam)).sort(matchSort);
}

export function getAvailableTeams(seasonData) {
  const teams = new Map();

  const pushTeam = (teamName, preferredStanding = null) => {
    if (!teamName) return;
    const standing = preferredStanding || findTeamStanding(seasonData?.standingsTable || [], teamName);
    const value = standing?.team || teamName;
    const key = standing ? `standing:${normalizeTeamName(standing.team)}` : `raw:${normalizeTeamName(teamName)}`;
    if (!key || teams.has(key)) return;
    teams.set(key, {
      value,
      label: standing?.rank ? `${value} (#${standing.rank})` : value,
      rank: standing?.rank ?? null,
    });
  };

  (seasonData?.standingsTable || []).forEach((row) => pushTeam(row.team, row));
  (seasonData?.matches || []).forEach((match) => {
    pushTeam(match.homeTeam);
    pushTeam(match.awayTeam);
  });

  return [...teams.values()].sort((left, right) => {
    if ((left.rank ?? 999) !== (right.rank ?? 999)) return (left.rank ?? 999) - (right.rank ?? 999);
    return left.value.localeCompare(right.value, "fr");
  });
}

export function syncSummaryFromStandings(seasonData) {
  const next = clone(seasonData || DEFAULT_DATA);
  const standing = getTrackedStanding(next.standingsTable, next.club?.trackedTeam);
  if (!standing) return next;

  next.summary = {
    ...next.summary,
    rank: standing.rank ?? next.summary?.rank ?? null,
    points: standing.points ?? next.summary?.points ?? null,
    played: standing.played ?? next.summary?.played ?? null,
    goalDifference: standing.goalDifference ?? next.summary?.goalDifference ?? null,
  };

  return next;
}

export function applyTrackedTeamSelection(seasonData, options = {}) {
  const next = clone(seasonData || DEFAULT_DATA);
  const trackedTeam = String(options.trackedTeam || next.club?.trackedTeam || "").trim();
  const inferredClubName = inferClubNameFromTeamName(trackedTeam);
  const nextClubName = String(options.clubName || inferredClubName || next.club?.name || "").trim() || next.club?.name;
  const explicitLogoPath = Object.prototype.hasOwnProperty.call(options, "logoPath");
  let logoPath = String(explicitLogoPath ? options.logoPath : next.club?.logoPath || "").trim();
  const selectedClubIsDefault = normalizeTeamName(nextClubName) === normalizeTeamName(DEFAULT_CLUB_NAME);

  if (!selectedClubIsDefault && logoPath === DEFAULT_CLUB_LOGO_PATH) {
    logoPath = "";
  } else if (!explicitLogoPath) {
    if (selectedClubIsDefault) {
      logoPath = DEFAULT_CLUB_LOGO_PATH;
    } else if (String(next.club?.logoPath || "").includes("logo-fc-regny")) {
      logoPath = "";
    }
  }

  next.club = {
    ...next.club,
    trackedTeam,
    name: nextClubName,
    fullName:
      String(options.fullName || next.club?.fullName || "").trim() ||
      `Football Club ${inferredClubName}`.trim(),
    logoPath,
  };

  next.season = {
    ...next.season,
    team: String(options.seasonTeam || trackedTeam || next.season?.team || "").trim() || next.season?.team,
    division:
      normalizeDivision(options.division) ||
      normalizeDivision(next.season?.division) ||
      inferDivisionFromCompetition(next.season?.competition) ||
      DEFAULT_DATA.season.division,
  };

  return normalizeSeasonData(next);
}

export function resultFor(match, trackedTeam) {
  const isHome = isSameTeam(match.homeTeam, trackedTeam);
  const isAway = isSameTeam(match.awayTeam, trackedTeam);

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
  if (Number.isNaN(date.getTime())) return "Date a confirmer";
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
  if (!iso) return "Jamais mise a jour";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Jamais mise a jour";
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

export function getNextMatch(matches, trackedTeam) {
  const now = Date.now();
  const scheduled = filterMatchesForTeam(matches, trackedTeam).filter((match) => !isFinished(match));
  return scheduled.find((match) => new Date(match.date).getTime() >= now) || scheduled[0];
}

export function getLastFinishedMatch(matches, trackedTeam) {
  return filterMatchesForTeam(matches, trackedTeam)
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
    tracked: isSameTeam(teamName, trackedTeam),
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

export function getStandingsFocusRows(standingsTable, trackedTeam, radius = 2) {
  const rows = [...(standingsTable || [])];
  if (!rows.length) return [];

  const standing = getTrackedStanding(rows, trackedTeam);
  if (!standing) {
    return rows.slice(0, Math.min(rows.length, radius * 2 + 1)).map((row) => ({
      ...row,
      tracked: false,
    }));
  }

  const index = rows.findIndex((row) => row.rank === standing.rank && isSameTeam(row.team, standing.team));
  const safeIndex = index >= 0 ? index : Math.max(0, (standing.rank || 1) - 1);
  const start = Math.max(0, safeIndex - radius);
  const end = Math.min(rows.length, safeIndex + radius + 1);

  return rows.slice(start, end).map((row) => ({
    ...row,
    tracked: isSameTeam(row.team, trackedTeam),
  }));
}

export function buildStandingSnapshot(seasonData) {
  const summary = seasonData.summary || {};
  const standing = getTrackedStanding(seasonData.standingsTable, seasonData.club.trackedTeam);
  const rows = [...(seasonData.standingsTable || [])].map((row) => ({
    ...row,
    tracked: isSameTeam(row.team, seasonData.club.trackedTeam),
  }));
  return {
    team: seasonData.club.trackedTeam,
    clubName: seasonData.club.name,
    rank: standing?.rank ?? summary.rank ?? null,
    points: standing?.points ?? summary.points ?? null,
    played: standing?.played ?? summary.played ?? null,
    goalDifference: standing?.goalDifference ?? summary.goalDifference ?? null,
    totalTeams: seasonData.standingsTable.length || null,
    division: normalizeDivision(seasonData.season.division) || inferDivisionFromCompetition(seasonData.season.competition),
    competition: seasonData.season.competition || "",
    focusRows: getStandingsFocusRows(seasonData.standingsTable, seasonData.club.trackedTeam),
    rows,
  };
}

export function buildWidgetPayloadV2(seasonData) {
  const trackedMatches = filterMatchesForTeam(seasonData.matches, seasonData.club.trackedTeam);
  const nextMatch = getNextMatch(trackedMatches, seasonData.club.trackedTeam);
  const lastMatch = getLastFinishedMatch(trackedMatches, seasonData.club.trackedTeam);
  const standing = buildStandingSnapshot(seasonData);

  if (!nextMatch && !lastMatch) {
    return {
      widgetVersion: 3,
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
        division: seasonData.season.division,
      },
      standing,
      lastMatch: null,
      nextMatch: null,
      deepLinks: {
        app: "./index.html",
        widget: "./widget.html",
      },
    };
  }

  return {
    widgetVersion: 3,
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
      division: seasonData.season.division,
      competition: seasonData.season.competition,
    },
    standing,
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
    throw new Error(message || "Erreur reseau");
  }

  return body;
}

export function parseFrenchDate(dateText) {
  const months = {
    jan: 0,
    janvier: 0,
    fev: 1,
    fevrier: 1,
    fevriere: 1,
    mar: 2,
    mars: 2,
    avr: 3,
    avril: 3,
    mai: 4,
    juin: 5,
    juil: 6,
    juillet: 6,
    aout: 7,
    sep: 8,
    sept: 8,
    septembre: 8,
    oct: 9,
    octobre: 9,
    nov: 10,
    novembre: 10,
    dec: 11,
    decembre: 11,
  };

  const clean = String(dateText || "").toLowerCase().replace(/\./g, "");
  const match = clean.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4}).*?(\d{1,2})h(\d{2})?/i);
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
        competition: competitionRaw.trim() || "Competition",
        round: "",
        type: competitionRaw.toLowerCase().includes("coupe") ? "cup" : "championship",
        homeTeam: homeRaw.trim(),
        awayTeam: awayRaw.trim(),
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        status: "finished",
        venue: "",
      }),
    );
  }

  for (let index = 0; index < lines.length - 4; index += 1) {
    const iso = parseFrenchDate(lines[index]);
    if (!iso) continue;
    const competition = lines[index + 1] || "Competition";
    const homeTeam = lines[index + 2] || "Domicile";
    const score = (lines[index + 3] || "").match(/^(\d+)\s+(\d+)$/);
    const awayTeam = lines[index + 4] || "Exterieur";
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
      }),
    );
  }

  const unique = new Map();
  matches.filter(Boolean).forEach((match) => unique.set(match.id, match));
  return [...unique.values()].sort(matchSort);
}

export function computeSeasonStats(matches, trackedTeam) {
  const trackedMatches = filterMatchesForTeam(matches, trackedTeam);
  const finished = trackedMatches.filter(isFinished);
  const results = finished.map((match) => resultFor(match, trackedTeam));
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of finished) {
    const isHome = isSameTeam(match.homeTeam, trackedTeam);
    const isAway = isSameTeam(match.awayTeam, trackedTeam);
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
    total: trackedMatches.length,
    wins: results.filter((result) => result.label === "V").length,
    draws: results.filter((result) => result.label === "N").length,
    losses: results.filter((result) => result.label === "D").length,
    goalsFor,
    goalsAgainst,
  };
}
