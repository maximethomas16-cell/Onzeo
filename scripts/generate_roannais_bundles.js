const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");
const BUNDLE_DIR = path.join(PUBLIC_DATA_DIR, "roannais-bundles");
const LOGO_DIR = path.join(PUBLIC_DIR, "assets", "club-logos");
const DEFAULT_SEASON_FILE = path.join(ROOT, "data", "season.json");

const SEED_COMPETITIONS = [
  {
    division: "D1",
    district: "District de la Loire",
    seedUrl: "https://www.sportcorico.com/clubs/roannais-foot-42/roannais-foot-42-9",
  },
  {
    division: "D2",
    district: "District de la Loire",
    seedUrl: "https://www.sportcorico.com/clubs/forez-donzy-f-c/forez-donzy-fc",
  },
  {
    division: "D2",
    district: "District de la Loire",
    seedUrl: "https://www.sportcorico.com/clubs/roannais-foot-42/roannais-foot-42-13",
  },
  {
    division: "D3",
    district: "District de la Loire",
    seedUrl: "https://www.sportcorico.com/clubs/nord-roannais-foot/nord-roannais",
  },
  {
    division: "D3",
    district: "District de la Loire",
    seedUrl: "https://www.sportcorico.com/clubs/olympique-est-roannais/olymp-est-roannais",
  },
  {
    division: "D4",
    district: "Delegation du Roannais",
    seedUrl: "https://www.sportcorico.com/clubs/football-club-val-d-aix/val-daix-fc-2",
  },
  {
    division: "D4",
    district: "Delegation du Roannais",
    seedUrl: "https://www.sportcorico.com/clubs/as-villers/villers-as-1",
  },
  {
    division: "D4",
    district: "Delegation du Roannais",
    seedUrl: "https://www.sportcorico.com/clubs/football-club-de-regny/regny-fc",
  },
  {
    division: "D5",
    district: "Delegation du Roannais",
    seedUrl: "https://www.sportcorico.com/clubs/f-c-roanne/roanne-fc-7",
  },
  {
    division: "D5",
    district: "Delegation du Roannais",
    seedUrl: "https://www.sportcorico.com/clubs/avenir-cote-foot/avenir-cote-foot-9",
  },
];

const FETCH_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0 Safari/537.36",
  "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
};

const logoCache = new Map();
const pageCache = new Map();

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function ensureDirectory(target) {
  fs.mkdirSync(target, { recursive: true });
}

function normalizeSeasonLabel(label) {
  return String(label || "")
    .trim()
    .replace(/\s*-\s*/g, "/")
    .replace(/\s+/g, "");
}

function prettifyCompetitionLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\s+POULE\s+([A-Z])/i, " - Poule $1")
    .replace(/\s+/g, " ")
    .replace(/^DISTRICT/i, "District")
    .replace(/^District 1 Mcdonald'?S$/i, "District 1 McDonald's");
}

function extractGroupLabel(label) {
  const match = String(label || "").match(/POULE\s+([A-Z])/i);
  return match ? `Poule ${match[1].toUpperCase()}` : "";
}

function competitionBaseLabel(label) {
  return prettifyCompetitionLabel(label).replace(/\s*-\s*Poule\s+[A-Z]$/i, "").trim();
}

function toIsoDateTime(game) {
  if (Number.isFinite(game?.begin_date_timestamp)) {
    return new Date(game.begin_date_timestamp * 1000).toISOString();
  }

  const plannedDate = String(game?.planned_date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const plannedTime = String(game?.planned_time || "").match(/^(\d{2}):(\d{2})$/);
  if (!plannedDate) return null;

  const day = Number(plannedDate[1]);
  const month = Number(plannedDate[2]) - 1;
  const year = Number(plannedDate[3]);
  const hour = plannedTime ? Number(plannedTime[1]) : 15;
  const minute = plannedTime ? Number(plannedTime[2]) : 0;

  return new Date(year, month, day, hour, minute, 0).toISOString();
}

function buildMatchId(match) {
  const datePart = (match.date || "date").slice(0, 10);
  return `${datePart}-${slugify(match.homeTeam || "domicile")}-${slugify(match.awayTeam || "exterieur")}`;
}

function normalizeMatchStatus(game) {
  const status = String(game?.status || "").toLowerCase();
  if (status.includes("term")) return "finished";
  if (status.includes("annul")) return "cancelled";
  if (status.includes("report")) return "postponed";
  if (status.includes("forfait")) return "finished";
  return "scheduled";
}

function inferMatchType(championshipName) {
  return String(championshipName || "").toLowerCase().includes("coupe") ? "cup" : "championship";
}

function buildStandingRow(line) {
  return {
    rank: Number(line.rank || 0) || null,
    team: String(line.team || "").trim(),
    points: Number(line.points || 0) || 0,
    played: Number(line.games_played || 0) || 0,
    wins: Number(line.won || 0) || 0,
    draws: Number(line.nulls || 0) || 0,
    losses: Number(line.lost || 0) || 0,
    goalsFor: Number(line.scored || 0) || 0,
    goalsAgainst: Number(line.conceded || 0) || 0,
    goalDifference: Number(line.difference || 0) || 0,
  };
}

function buildRosterEntry(line) {
  return {
    teamId: Number(line.team_id || 0) || null,
    team: String(line.team || "").trim(),
    penalization: Number(line.penalization || 0) || 0,
    seedRank: Number(line.rank || 0) || 999,
    clubSlug: String(line.club_slug || "").trim(),
    teamSlug: String(line.team_slug || "").trim(),
  };
}

function buildMatch(game) {
  if (!game || game.exempt) return null;

  const date = toIsoDateTime(game);
  if (!date) return null;

  const homeTeam = String(game.home_team_short_name || game.home_team_name || "").trim();
  const awayTeam = String(game.outside_team_short_name || game.outside_team_name || "").trim();
  if (!homeTeam || !awayTeam) return null;

  const match = {
    date,
    competition: prettifyCompetitionLabel(game.championship_name || ""),
    round: "",
    type: inferMatchType(game.championship_name),
    homeTeam,
    awayTeam,
    homeScore: Number.isFinite(game.home_score) ? game.home_score : null,
    awayScore: Number.isFinite(game.outside_score) ? game.outside_score : null,
    status: normalizeMatchStatus(game),
    venue: String(game.home_club_name || "").trim(),
  };

  return {
    id: buildMatchId(match),
    ...match,
  };
}

function isCompetitionLeagueMatch(game, competitionBase) {
  return (
    !game?.exempt &&
    inferMatchType(game.championship_name) === "championship" &&
    competitionBaseLabel(game.championship_name) === competitionBase
  );
}

function isFinishedGame(game) {
  return Number.isFinite(game?.home_score) && Number.isFinite(game?.outside_score);
}

function buildCompetitionStandings(seedPage, competitionPages, competitionBase) {
  const roster = new Map();
  (seedPage.rankings?.[0]?.lines || []).forEach((line) => {
    const entry = buildRosterEntry(line);
    if (entry.teamId) {
      roster.set(entry.teamId, {
        ...entry,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      });
    }
  });

  const gamesById = new Map();
  competitionPages.forEach((page) => {
    (page.games || []).forEach((game) => {
      if (!isCompetitionLeagueMatch(game, competitionBase) || !isFinishedGame(game)) return;
      gamesById.set(game.id, game);

      if (!roster.has(game.home_team_id)) {
        roster.set(game.home_team_id, {
          teamId: game.home_team_id,
          team: String(game.home_team_short_name || game.home_team_name || "").trim(),
          penalization: 0,
          seedRank: 999,
          clubSlug: String(game.home_club_slug || "").trim(),
          teamSlug: "",
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
        });
      }

      if (!roster.has(game.outside_team_id)) {
        roster.set(game.outside_team_id, {
          teamId: game.outside_team_id,
          team: String(game.outside_team_short_name || game.outside_team_name || "").trim(),
          penalization: 0,
          seedRank: 999,
          clubSlug: String(game.outside_club_slug || "").trim(),
          teamSlug: "",
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
        });
      }
    });
  });

  for (const game of gamesById.values()) {
    const home = roster.get(game.home_team_id);
    const away = roster.get(game.outside_team_id);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += game.home_score;
    home.goalsAgainst += game.outside_score;
    away.goalsFor += game.outside_score;
    away.goalsAgainst += game.home_score;

    if (game.home_score > game.outside_score) {
      home.wins += 1;
      away.losses += 1;
    } else if (game.home_score < game.outside_score) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
    }
  }

  const standings = [...roster.values()].map((team) => {
    const points = team.wins * 3 + team.draws - team.penalization;
    return {
      teamId: team.teamId,
      team: team.team,
      points,
      played: team.played,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      goalsFor: team.goalsFor,
      goalsAgainst: team.goalsAgainst,
      goalDifference: team.goalsFor - team.goalsAgainst,
      penalization: team.penalization,
      seedRank: team.seedRank,
    };
  });

  standings.sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (left.seedRank !== right.seedRank) return left.seedRank - right.seedRank;
    if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
    if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
    if (left.played !== right.played) return left.played - right.played;
    return left.team.localeCompare(right.team, "fr");
  });

  return standings.map((team, index) => ({
    rank: index + 1,
    team: team.team,
    points: team.points,
    played: team.played,
    wins: team.wins,
    draws: team.draws,
    losses: team.losses,
    goalsFor: team.goalsFor,
    goalsAgainst: team.goalsAgainst,
    goalDifference: team.goalDifference,
    teamId: team.teamId,
  }));
}

function findTrackedStanding(standingsTable, trackedTeam, teamNumber, teamId = null) {
  const normalizedTeam = slugify(trackedTeam);
  return (
    standingsTable.find((row) => row.teamId && teamId && row.teamId === teamId) ||
    standingsTable.find((row) => slugify(row.team) === normalizedTeam) ||
    standingsTable.find((row) => row.team.endsWith(` ${teamNumber || ""}`.trim())) ||
    standingsTable.find((row) => slugify(row.team).includes(normalizedTeam))
  );
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} sur ${url}`);
  }

  return response.text();
}

function extractNuxtPage(html) {
  const marker = "window.__NUXT__=";
  const start = html.indexOf(marker);
  const end = html.indexOf("</script>", start);
  if (start === -1 || end === -1) {
    throw new Error("Payload Nuxt introuvable dans la page SportCorico.");
  }

  const snippet = html.slice(start, end).trim();
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(snippet, context);

  const page = context.window.__NUXT__?.data?.[0];
  if (!page?.team) {
    throw new Error("Structure SportCorico inattendue.");
  }

  return page;
}

async function fetchTeamPage(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const html = await fetchText(url);
  const page = extractNuxtPage(html);
  pageCache.set(url, page);
  return page;
}

async function downloadLogo(url, fileStem) {
  const cacheKey = `${url}::${fileStem}`;
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey);
  if (!url) return "";

  const parsed = new URL(url);
  const extension = path.extname(parsed.pathname) || ".png";
  const fileName = `${slugify(fileStem)}${extension.toLowerCase()}`;
  const outputFile = path.join(LOGO_DIR, fileName);
  const publicPath = `./assets/club-logos/${fileName}`;

  if (!fs.existsSync(outputFile)) {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`Impossible de telecharger le logo ${url}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputFile, buffer);
  }

  logoCache.set(cacheKey, publicPath);
  return publicPath;
}

function buildBundleId(seed, page, trackedStanding) {
  const group = extractGroupLabel(page.team.competitions?.[0]?.fullName || "");
  return [seed.division, group || "phase-unique", page.team.club_slug, page.team.slug, trackedStanding?.rank || "club"]
    .map(slugify)
    .filter(Boolean)
    .join("__");
}

function buildSeasonBundle(seed, page, standingsTable, trackedStanding, logoPath) {
  const trackedTeam = trackedStanding?.team || page.team.name || page.team.club_name || "Equipe";
  const matches = (page.games || []).map(buildMatch).filter(Boolean).sort((left, right) => new Date(left.date) - new Date(right.date));
  const competitionLabel = prettifyCompetitionLabel(page.team.competitions?.[0]?.fullName || page.games?.[0]?.championship_name || "");
  const groupLabel = extractGroupLabel(competitionLabel);
  const bundleId = buildBundleId(seed, page, trackedStanding);

  return {
    club: {
      name: page.team.club_name || trackedTeam,
      fullName: page.team.club_name || trackedTeam,
      trackedTeam,
      defaultVenue: page.team.club_name || "",
      sourceLabel: "SportCorico + recalcul local du classement (controle FFF ponctuel)",
      logoPath,
      catalogId: bundleId,
      clubSlug: page.team.club_slug || "",
      teamSlug: page.team.slug || "",
      sourceUrl: `https://www.sportcorico.com/clubs/${page.team.club_slug}/${page.team.slug}`,
    },
    season: {
      label: normalizeSeasonLabel(page.selectedSeason?.label || "2025/2026"),
      team: page.team.name_generated || page.team.name || trackedTeam,
      division: seed.division,
      competition: competitionLabel,
      district: seed.district,
      group: groupLabel,
    },
    summary: {
      rank: trackedStanding?.rank ?? null,
      points: trackedStanding?.points ?? null,
      played: trackedStanding?.played ?? null,
      goalDifference: trackedStanding?.goalDifference ?? null,
    },
    standingsTable: standingsTable.map(({ teamId, ...row }) => row),
    matches,
    lastUpdated: new Date().toISOString(),
  };
}

function buildCatalogEntry(seed, bundle, bundlePath) {
  return {
    id: bundle.club.catalogId,
    division: bundle.season.division,
    competition: bundle.season.competition,
    district: bundle.season.district,
    group: bundle.season.group || "",
    teamName: bundle.club.trackedTeam,
    seasonTeam: bundle.season.team,
    clubName: bundle.club.name,
    rank: bundle.summary.rank,
    points: bundle.summary.points,
    logoPath: bundle.club.logoPath,
    bundlePath,
    sourceUrl: bundle.club.sourceUrl,
    sourceLabel: bundle.club.sourceLabel,
    label: [bundle.summary.rank ? `#${bundle.summary.rank}` : null, bundle.club.trackedTeam, bundle.season.group || seed.division]
      .filter(Boolean)
      .join(" - "),
  };
}

async function buildCompetitionBundles(seed) {
  const seedPage = await fetchTeamPage(seed.seedUrl);
  const competitionName = seedPage.team.competitions?.[0]?.fullName || "";
  const rankingLines = seedPage.rankings?.[0]?.lines || [];

  if (!rankingLines.length) {
    throw new Error(`Aucun classement detecte pour ${seed.seedUrl}`);
  }

  const results = [];
  const competitionPages = [];
  for (const line of rankingLines) {
    const teamUrl = `https://www.sportcorico.com/clubs/${line.club_slug}/${line.team_slug}`;
    const page = await fetchTeamPage(teamUrl);
    competitionPages.push({ line, page });
  }

  const competitionBase = competitionBaseLabel(seedPage.team.competitions?.[0]?.fullName || "");
  const computedStandings = buildCompetitionStandings(
    seedPage,
    competitionPages.map((entry) => entry.page),
    competitionBase,
  );

  for (const { line, page } of competitionPages) {
    const trackedStanding = findTrackedStanding(computedStandings, line.team, page.team.team_number, page.team.id);
    const logoPath = await downloadLogo(page.team.club_logo_url || line.logo || "", page.team.club_slug || page.team.slug);
    const bundle = buildSeasonBundle(seed, page, computedStandings, trackedStanding, logoPath);
    const bundleFileName = `${bundle.club.catalogId}.json`;
    const bundlePath = `./data/roannais-bundles/${bundleFileName}`;

    fs.writeFileSync(path.join(BUNDLE_DIR, bundleFileName), JSON.stringify(bundle, null, 2));
    results.push(buildCatalogEntry(seed, bundle, bundlePath));
  }

  console.log(`${seed.division} ${competitionName}: ${results.length} equipes generees`);
  return results;
}

function sortCatalogEntries(entries) {
  const divisionOrder = new Map([
    ["D1", 1],
    ["D2", 2],
    ["D3", 3],
    ["D4", 4],
    ["D5", 5],
  ]);

  return [...entries].sort((left, right) => {
    const divisionDelta = (divisionOrder.get(left.division) || 99) - (divisionOrder.get(right.division) || 99);
    if (divisionDelta !== 0) return divisionDelta;
    if ((left.group || "") !== (right.group || "")) {
      return String(left.group || "").localeCompare(String(right.group || ""), "fr");
    }
    if ((left.rank || 999) !== (right.rank || 999)) {
      return (left.rank || 999) - (right.rank || 999);
    }
    return left.teamName.localeCompare(right.teamName, "fr");
  });
}

async function main() {
  ensureDirectory(PUBLIC_DATA_DIR);
  ensureDirectory(BUNDLE_DIR);
  ensureDirectory(LOGO_DIR);

  const allEntries = [];
  for (const seed of SEED_COMPETITIONS) {
    const entries = await buildCompetitionBundles(seed);
    allEntries.push(...entries);
  }

  const sortedEntries = sortCatalogEntries(allEntries);
  const catalog = {
    generatedAt: new Date().toISOString(),
    season: "2025/2026",
    source: "SportCorico, avec classement recalcule depuis les matchs et controle FFF ponctuel",
    entries: sortedEntries,
  };

  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "roannais-catalog.json"), JSON.stringify(catalog, null, 2));

  const regnyEntry = sortedEntries.find((entry) => entry.id.includes("football-club-de-regny"));
  if (!regnyEntry) {
    throw new Error("Bundle Regny introuvable apres generation.");
  }

  const regnyBundle = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, regnyEntry.bundlePath.replace(/^\.\//, "")), "utf8"));
  regnyBundle.club.defaultVenue = "Rue du College, 42630 Regny";
  fs.writeFileSync(DEFAULT_SEASON_FILE, JSON.stringify(regnyBundle, null, 2));

  console.log(`Catalogue genere: ${sortedEntries.length} equipes`);
  console.log(`Bundle par defaut mis a jour: ${DEFAULT_SEASON_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
