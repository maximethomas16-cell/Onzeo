import { clone, normalizeSeasonData } from "./shared.js";
import { APP_CONFIG } from "./config.js";

const DEFAULT_CONFIG = {
  provider: "local",
  seasonFile: "./data/season.json",
  allowLocalAdmin: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseSeasonTable: "season_data",
  supabaseSeasonId: "public",
};

const LOCAL_DATA_STORAGE_KEY = "fcRegnySeasonLocalV1";
const SESSION_STORAGE_KEY = "fcRegnySupabaseSessionV1";

const config = {
  ...DEFAULT_CONFIG,
  ...(APP_CONFIG || {}),
};

function isSupabaseProvider() {
  return config.provider === "supabase";
}

function hasSupabaseConfig() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function getSeasonFileUrl() {
  return new URL(config.seasonFile, window.location.href).toString();
}

function getSupabaseBaseUrl(pathname) {
  return `${String(config.supabaseUrl || "").replace(/\/+$/, "")}${pathname}`;
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage failures in private browsing.
  }
}

function readLocalSeasonOverride() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_STORAGE_KEY);
    return raw ? normalizeSeasonData(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocalSeasonOverride(data) {
  try {
    localStorage.setItem(LOCAL_DATA_STORAGE_KEY, JSON.stringify(normalizeSeasonData(data)));
  } catch {
    // Ignore storage failures in private browsing.
  }
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      typeof body === "object" && body?.msg
        ? body.msg
        : typeof body === "object" && body?.error_description
          ? body.error_description
          : typeof body === "object" && body?.message
            ? body.message
            : response.statusText;
    throw new Error(message || "Erreur reseau");
  }
  return body;
}

async function fetchSeasonFile() {
  const response = await fetch(getSeasonFileUrl(), { cache: "no-store" });
  return normalizeSeasonData(await readJsonResponse(response));
}

async function fetchSupabase(pathname, options = {}) {
  const response = await fetch(getSupabaseBaseUrl(pathname), {
    headers: {
      apikey: config.supabaseAnonKey,
      ...(options.headers || {}),
    },
    ...options,
  });
  return readJsonResponse(response);
}

function buildSeasonQuery() {
  const params = new URLSearchParams();
  params.set("id", `eq.${config.supabaseSeasonId}`);
  params.set("select", "id,payload,updated_at");
  params.set("limit", "1");
  return params.toString();
}

async function loadSupabaseSeason() {
  const rows = await fetchSupabase(`/rest/v1/${config.supabaseSeasonTable}?${buildSeasonQuery()}`, {
    method: "GET",
  });

  if (!Array.isArray(rows) || !rows.length || !rows[0]?.payload) {
    throw new Error("Aucune saison publiee dans Supabase.");
  }

  return normalizeSeasonData(rows[0].payload);
}

async function getSupabaseUser(accessToken) {
  return fetchSupabase("/auth/v1/user", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function refreshSupabaseSession(refreshToken) {
  const session = await fetchSupabase("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const stored = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
    user: session.user ?? null,
  };
  writeStoredSession(stored);
  return stored;
}

async function getValidSession() {
  const stored = readStoredSession();
  if (!stored?.access_token) return null;

  try {
    const user = await getSupabaseUser(stored.access_token);
    const nextSession = {
      ...stored,
      user,
    };
    writeStoredSession(nextSession);
    return nextSession;
  } catch (error) {
    if (!stored.refresh_token) {
      writeStoredSession(null);
      return null;
    }

    try {
      return await refreshSupabaseSession(stored.refresh_token);
    } catch {
      writeStoredSession(null);
      return null;
    }
  }
}

async function fetchSupabaseWithSession(pathname, options = {}) {
  const session = await getValidSession();
  if (!session?.access_token) throw new Error("Session admin indisponible.");

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    ...(options.headers || {}),
  };

  try {
    return await fetchSupabase(pathname, {
      ...options,
      headers,
    });
  } catch (error) {
    if (!session.refresh_token) throw error;
    const nextSession = await refreshSupabaseSession(session.refresh_token);
    return fetchSupabase(pathname, {
      ...options,
      headers: {
        ...headers,
        Authorization: `Bearer ${nextSession.access_token}`,
      },
    });
  }
}

async function saveSupabaseSeason(data) {
  const normalized = normalizeSeasonData(data);
  const rows = await fetchSupabaseWithSession(`/rest/v1/${config.supabaseSeasonTable}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: config.supabaseSeasonId,
      payload: normalized,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!Array.isArray(rows) || !rows.length || !rows[0]?.payload) {
    throw new Error("Reponse Supabase inattendue apres enregistrement.");
  }

  return normalizeSeasonData(rows[0].payload);
}

export function getRuntimeConfig() {
  return clone(config);
}

export function getDataSourceStatus() {
  if (isSupabaseProvider()) {
    if (!hasSupabaseConfig()) {
      return {
        provider: "supabase",
        publicReady: false,
        adminReady: false,
        publicLabel: "Supabase non configure",
        adminLabel: "Ajoute l'URL et la cle anon Supabase dans public/config.js.",
      };
    }

    return {
      provider: "supabase",
      publicReady: true,
      adminReady: true,
      publicLabel: "Supabase",
      adminLabel: "Connexion admin par email + mot de passe Supabase.",
    };
  }

  return {
    provider: "local",
    publicReady: true,
    adminReady: Boolean(config.allowLocalAdmin),
    publicLabel: "Fichier statique local",
    adminLabel: config.allowLocalAdmin
      ? "Mode local actif. Les changements sont enregistres dans ce navigateur uniquement."
      : "Mode demo. Configure Supabase pour activer l'administration en ligne.",
  };
}

export async function loadPublicSeasonData() {
  if (isSupabaseProvider() && hasSupabaseConfig()) {
    try {
      return await loadSupabaseSeason();
    } catch (error) {
      const fallback = readLocalSeasonOverride();
      if (fallback) return fallback;
      throw error;
    }
  }

  return readLocalSeasonOverride() || fetchSeasonFile();
}

export async function restoreAdminSession() {
  if (isSupabaseProvider()) {
    if (!hasSupabaseConfig()) return null;
    return getValidSession();
  }

  if (!config.allowLocalAdmin) return null;
  return {
    user: {
      email: "local@fc-regny",
    },
  };
}

export async function loginAdmin(email, password) {
  if (isSupabaseProvider()) {
    if (!hasSupabaseConfig()) {
      throw new Error("Supabase n'est pas configure dans public/config.js.");
    }

    const session = await fetchSupabase("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const stored = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? null,
      user: session.user ?? null,
    };
    writeStoredSession(stored);
    return stored;
  }

  if (!config.allowLocalAdmin) {
    throw new Error("L'administration locale est desactivee. Configure Supabase pour continuer.");
  }

  return {
    user: {
      email: email || "local@fc-regny",
    },
  };
}

export async function logoutAdmin() {
  const session = readStoredSession();
  writeStoredSession(null);

  if (isSupabaseProvider() && session?.access_token) {
    try {
      await fetchSupabase("/auth/v1/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {
      // Ignore remote logout errors, local session is already cleared.
    }
  }
}

export async function loadAdminSeasonData() {
  if (isSupabaseProvider()) {
    if (!hasSupabaseConfig()) {
      throw new Error("Supabase n'est pas configure dans public/config.js.");
    }
    return loadSupabaseSeason();
  }

  if (!config.allowLocalAdmin) {
    throw new Error("Administration indisponible tant que Supabase n'est pas configure.");
  }

  return readLocalSeasonOverride() || fetchSeasonFile();
}

export async function saveAdminSeasonData(data) {
  if (isSupabaseProvider()) {
    if (!hasSupabaseConfig()) {
      throw new Error("Supabase n'est pas configure dans public/config.js.");
    }
    return saveSupabaseSeason(data);
  }

  if (!config.allowLocalAdmin) {
    throw new Error("Administration indisponible tant que Supabase n'est pas configure.");
  }

  const normalized = normalizeSeasonData(data);
  writeLocalSeasonOverride(normalized);
  return normalized;
}
