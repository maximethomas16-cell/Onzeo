const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DEFAULT_DATA_DIR = path.join(ROOT, "data");
const SEED_DATA_FILE = path.join(DEFAULT_DATA_DIR, "season.json");
const DATA_DIR = path.resolve(process.env.DATA_DIR || DEFAULT_DATA_DIR);
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(DATA_DIR, "season.json"));
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const SESSION_COOKIE = "fc_regny_admin";
const PORT = Number(process.env.PORT || 4173);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const MAX_REQUEST_BYTES = 1024 * 1024;
const CONFIGURED_SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_SECRET = CONFIGURED_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || "";
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (IS_PRODUCTION ? "true" : "false")) === "true";

if (IS_PRODUCTION) {
  if (!CONFIGURED_SESSION_SECRET) {
    throw new Error("SESSION_SECRET est obligatoire en production.");
  }
  if (!ADMIN_PASSWORD_HASH) {
    throw new Error("ADMIN_PASSWORD_HASH est obligatoire en production.");
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
ensureDataFile();

const loginAttempts = new Map();

function defaultData() {
  return JSON.parse(fs.readFileSync(fs.existsSync(SEED_DATA_FILE) ? SEED_DATA_FILE : DATA_FILE, "utf8"));
}

function ensureDataFile() {
  if (fs.existsSync(DATA_FILE)) return;
  if (!fs.existsSync(SEED_DATA_FILE)) {
    throw new Error(`Fichier de donnees introuvable: ${SEED_DATA_FILE}`);
  }
  fs.copyFileSync(SEED_DATA_FILE, DATA_FILE);
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

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildMatchId(match) {
  const datePart = (match.date || "date").slice(0, 10);
  return `${datePart}-${slugify(match.homeTeam || "domicile")}-${slugify(match.awayTeam || "exterieur")}`;
}

function matchSort(a, b) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
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

function normalizeSeasonData(input) {
  const safe = defaultData();
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
    lastUpdated: normalizeDate(data.lastUpdated) || new Date().toISOString(),
  };
}

function isFinished(match) {
  return (
    match.status === "finished" ||
    (match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined)
  );
}

function normalizeTeamName(value) {
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

function teamSimilarityScore(left, right) {
  const leftNorm = normalizeTeamName(left);
  const rightNorm = normalizeTeamName(right);
  if (!leftNorm || !rightNorm) return -1;
  if (leftNorm === rightNorm) return 120;
  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    return 85 - Math.abs(leftNorm.length - rightNorm.length);
  }

  const leftParts = teamTokens(left);
  const rightParts = teamTokens(right);
  let score = 0;

  leftParts.forEach((leftToken) => {
    if (rightParts.includes(leftToken)) {
      score += leftToken.length >= 4 ? 12 : 5;
      return;
    }

    const closeToken = rightParts.find(
      (rightToken) =>
        (leftToken.length >= 4 || rightToken.length >= 4) &&
        (leftToken.startsWith(rightToken) || rightToken.startsWith(leftToken)),
    );

    if (closeToken) score += 8;
  });

  const leftDigits = leftParts.filter((token) => /^\d+$/.test(token)).join("-");
  const rightDigits = rightParts.filter((token) => /^\d+$/.test(token)).join("-");
  if (leftDigits && rightDigits && leftDigits === rightDigits) {
    score += 6;
  }

  return score;
}

function findTeamStanding(standingsTable, teamName) {
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

function getNextMatch(matches) {
  const now = Date.now();
  return [...matches].sort(matchSort).find((match) => !isFinished(match) && new Date(match.date).getTime() >= now);
}

function getLastFinishedMatch(matches) {
  return [...matches]
    .filter(isFinished)
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())[0];
}

function formatWidgetDate(iso) {
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

function formatWidgetTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatWidgetDateLong(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";
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

function buildWidgetMatchCard(match, seasonData, title) {
  if (!match) return null;

  const homeTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.homeTeam, match.homeScore);
  const awayTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.awayTeam, match.awayScore);
  const venue = match.venue || seasonData.club.defaultVenue || "Lieu à confirmer";
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
    scoreLine: finished ? `${match.homeScore ?? "—"} - ${match.awayScore ?? "—"}` : "Match à venir",
    homeTeam,
    awayTeam,
    trackedSide: homeTeam.tracked ? "home" : awayTeam.tracked ? "away" : "neutral",
    isFinished: finished,
    sourceLastUpdated: seasonData.lastUpdated,
  };
}

function buildWidgetPayload(seasonData) {
  const nextMatch = getNextMatch(seasonData.matches);
  const fallbackMatch = getLastFinishedMatch(seasonData.matches);
  const match = nextMatch || fallbackMatch;

  if (!match) {
    return {
      widgetVersion: 1,
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
      card: null,
    };
  }

  const nextMode = Boolean(nextMatch);
  const homeTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.homeTeam, match.homeScore);
  const awayTeam = buildWidgetTeam(seasonData.standingsTable, seasonData.club.trackedTeam, match.awayTeam, match.awayScore);
  const venue = match.venue || seasonData.club.defaultVenue || "Lieu à confirmer";

  return {
    widgetVersion: 1,
    generatedAt: new Date().toISOString(),
    refreshAfterSeconds: 1800,
    mode: nextMode ? "next_match" : "last_match",
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
      district: seasonData.season.district,
    },
    card: {
      title: nextMode ? "Prochain match" : "Dernier match",
      competition: match.competition || seasonData.season.competition,
      round: match.round || "",
      venue,
      venueShort: venue,
      kickoffIso: match.date,
      kickoffDateLabel: formatWidgetDate(match.date),
      kickoffDateLongLabel: formatWidgetDateLong(match.date),
      kickoffTimeLabel: formatWidgetTime(match.date),
      status: match.status,
      scoreLine: nextMode ? "Match à venir" : `${match.homeScore ?? "—"} - ${match.awayScore ?? "—"}`,
      homeTeam,
      awayTeam,
      trackedSide: homeTeam.tracked ? "home" : awayTeam.tracked ? "away" : "neutral",
      isFinished: isFinished(match),
      sourceLastUpdated: seasonData.lastUpdated,
      deepLinks: {
        app: "/index.html",
        widget: "/widget.html",
      },
    },
  };
}

function readSeasonData() {
  return normalizeSeasonData(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
}

function buildWidgetPayloadV2(seasonData) {
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
        app: "/index.html",
        widget: "/widget.html",
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
      district: seasonData.season.district,
    },
    lastMatch: buildWidgetMatchCard(lastMatch, seasonData, "Dernier match"),
    nextMatch: buildWidgetMatchCard(nextMatch, seasonData, "Prochain match"),
    deepLinks: {
      app: "/index.html",
      widget: "/widget.html",
    },
  };
}

function writeSeasonData(data) {
  const normalized = normalizeSeasonData(data);
  const backupFile = path.join(BACKUP_DIR, `season-${Date.now()}.json`);
  fs.writeFileSync(backupFile, fs.readFileSync(DATA_FILE));
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2));
  return normalized;
}

function json(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...securityHeaders(),
    ...extraHeaders,
  };
  res.writeHead(statusCode, headers);
  res.end(body);
}

function securityHeaders() {
  return {
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function staticHeaders(contentType, noStore = false) {
  return {
    "Content-Type": contentType,
    "Cache-Control": noStore ? "no-store" : "public, max-age=600",
    ...securityHeaders(),
  };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".webmanifest": "application/manifest+json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream"
  );
}

function serveFile(req, res, relativePath, noStore = false) {
  const resolvedPath = path.join(PUBLIC_DIR, relativePath);
  if (!resolvedPath.startsWith(PUBLIC_DIR) || !fs.existsSync(resolvedPath)) {
    json(res, 404, { error: "Fichier introuvable." });
    return;
  }

  res.writeHead(200, staticHeaders(contentTypeFor(resolvedPath), noStore));
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(resolvedPath);
  stream.pipe(res);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((accumulator, chunk) => {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey) return accumulator;
    accumulator[rawKey] = decodeURIComponent(rawValue.join("="));
    return accumulator;
  }, {});
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken() {
  const payload = {
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readSession(req) {
  if (!SESSION_SECRET) return null;
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token || !token.includes(".")) return null;

  const [encoded, signature] = token.split(".");
  if (!signature) return null;
  const expected = sign(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sessionCookie(token) {
  const segments = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/admin",
    "SameSite=Strict",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (COOKIE_SECURE) segments.push("Secure");
  return segments.join("; ");
}

function clearSessionCookie() {
  const segments = [`${SESSION_COOKIE}=`, "HttpOnly", "Path=/api/admin", "SameSite=Strict", "Max-Age=0"];
  if (COOKIE_SECURE) segments.push("Secure");
  return segments.join("; ");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function allowLoginAttempt(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  return entry.count < 10;
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function verifyPassword(password) {
  const candidate = Buffer.from(String(password || ""), "utf8");

  if (ADMIN_PASSWORD_HASH) {
    const [algorithm, saltHex, hashHex] = ADMIN_PASSWORD_HASH.split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");
    const actualHash = crypto.scryptSync(candidate, salt, expectedHash.length);
    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  if (!IS_PRODUCTION && ADMIN_PASSWORD) {
    const expected = Buffer.from(ADMIN_PASSWORD, "utf8");
    return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
  }

  return false;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error("Corps de requête trop volumineux."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON invalide."));
      }
    });

    req.on("error", reject);
  });
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (APP_ORIGIN) return origin === APP_ORIGIN;
  const protocol = req.headers["x-forwarded-proto"] || (COOKIE_SECURE ? "https" : "http");
  return origin === `${protocol}://${req.headers.host}`;
}

function requireAuth(req, res) {
  const session = readSession(req);
  if (!session) {
    json(res, 401, { error: "Session administrateur requise." });
    return false;
  }
  return true;
}

async function handleApi(req, res, pathname) {
  if (pathname === "/healthz" && req.method === "GET") {
    json(res, 200, { ok: true, timestamp: new Date().toISOString() });
    return true;
  }

  if (pathname === "/api/public/season" && req.method === "GET") {
    json(res, 200, { data: readSeasonData() });
    return true;
  }

  if (pathname === "/api/public/widget" && req.method === "GET") {
    json(res, 200, { data: buildWidgetPayloadV2(readSeasonData()) });
    return true;
  }

  if (pathname === "/api/admin/session" && req.method === "GET") {
    if (!readSession(req)) {
      json(res, 401, { error: "Session absente." });
      return true;
    }
    json(res, 200, { authenticated: true });
    return true;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    if (!sameOrigin(req)) {
      json(res, 403, { error: "Origine non autorisée." });
      return true;
    }
    if (!ADMIN_PASSWORD_HASH && !(ADMIN_PASSWORD && !IS_PRODUCTION)) {
      json(res, 503, { error: "Administration non configurée côté serveur." });
      return true;
    }

    const ip = getClientIp(req);
    if (!allowLoginAttempt(ip)) {
      json(res, 429, { error: "Trop de tentatives. Réessaie plus tard." });
      return true;
    }

    try {
      const body = await parseJsonBody(req);
      if (!verifyPassword(body.password)) {
        recordLoginFailure(ip);
        json(res, 401, { error: "Mot de passe incorrect." });
        return true;
      }

      clearLoginAttempts(ip);
      const token = createSessionToken();
      json(res, 200, { authenticated: true }, { "Set-Cookie": sessionCookie(token) });
      return true;
    } catch (error) {
      json(res, 400, { error: error.message });
      return true;
    }
  }

  if (pathname === "/api/admin/logout" && req.method === "POST") {
    json(res, 200, { authenticated: false }, { "Set-Cookie": clearSessionCookie() });
    return true;
  }

  if (pathname === "/api/admin/season" && req.method === "GET") {
    if (!requireAuth(req, res)) return true;
    json(res, 200, { data: readSeasonData() });
    return true;
  }

  if (pathname === "/api/admin/season" && req.method === "PUT") {
    if (!sameOrigin(req)) {
      json(res, 403, { error: "Origine non autorisée." });
      return true;
    }
    if (!requireAuth(req, res)) return true;

    try {
      const body = await parseJsonBody(req);
      if (!body.data || typeof body.data !== "object") {
        json(res, 400, { error: "Le corps doit contenir un objet data." });
        return true;
      }
      const normalized = writeSeasonData(body.data);
      json(res, 200, { data: normalized });
      return true;
    } catch (error) {
      json(res, 400, { error: error.message });
      return true;
    }
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, pathname);
      if (!handled) json(res, 404, { error: "Route API introuvable." });
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "Méthode non autorisée." });
      return;
    }

    if (pathname === "/" || pathname === "/index.html") {
      serveFile(req, res, "index.html");
      return;
    }

    if (pathname === "/admin" || pathname === "/admin.html") {
      serveFile(req, res, "admin.html", true);
      return;
    }

    const safePath = pathname.replace(/^\/+/, "");
    serveFile(req, res, safePath);
  } catch (error) {
    json(res, 500, { error: "Erreur interne du serveur." });
  }
});

server.listen(PORT, () => {
  console.log(`FC Régny server listening on http://localhost:${PORT}`);
  if (!IS_PRODUCTION && !ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD) {
    console.warn("Admin non configurée. Définis ADMIN_PASSWORD pour le développement local.");
  }
});
