import { bindThemeButtons, clone, fetchJson, formatUpdatedAt, normalizeSeasonData, parsePastedText } from "./shared.js";

const els = {
  authPanel: document.getElementById("authPanel"),
  adminPanel: document.getElementById("adminPanel"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  authError: document.getElementById("authError"),
  reloadBtn: document.getElementById("reloadBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  adminSeasonLabel: document.getElementById("adminSeasonLabel"),
  adminUpdatedLabel: document.getElementById("adminUpdatedLabel"),
  clubNameInput: document.getElementById("clubNameInput"),
  trackedTeamInput: document.getElementById("trackedTeamInput"),
  seasonLabelInput: document.getElementById("seasonLabelInput"),
  seasonTeamInput: document.getElementById("seasonTeamInput"),
  competitionInput: document.getElementById("competitionInput"),
  districtInput: document.getElementById("districtInput"),
  venueInput: document.getElementById("venueInput"),
  sourceInput: document.getElementById("sourceInput"),
  rankInput: document.getElementById("rankInput"),
  pointsInput: document.getElementById("pointsInput"),
  playedInput: document.getElementById("playedInput"),
  goalDifferenceInput: document.getElementById("goalDifferenceInput"),
  pasteInput: document.getElementById("pasteInput"),
  parseBtn: document.getElementById("parseBtn"),
  clearPasteBtn: document.getElementById("clearPasteBtn"),
  jsonEditor: document.getElementById("jsonEditor"),
  applyJsonBtn: document.getElementById("applyJsonBtn"),
  copyJsonBtn: document.getElementById("copyJsonBtn"),
  saveBtn: document.getElementById("saveBtn"),
  saveFeedback: document.getElementById("saveFeedback"),
  toast: document.getElementById("toast"),
};

let state = normalizeSeasonData({});

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setAuthenticated(authenticated) {
  els.authPanel.classList.toggle("hidden", authenticated);
  els.adminPanel.classList.toggle("hidden", !authenticated);
}

function syncFormFromState() {
  els.clubNameInput.value = state.club.name || "";
  els.trackedTeamInput.value = state.club.trackedTeam || "";
  els.seasonLabelInput.value = state.season.label || "";
  els.seasonTeamInput.value = state.season.team || "";
  els.competitionInput.value = state.season.competition || "";
  els.districtInput.value = state.season.district || "";
  els.venueInput.value = state.club.defaultVenue || "";
  els.sourceInput.value = state.club.sourceLabel || "";
  els.rankInput.value = state.summary.rank ?? "";
  els.pointsInput.value = state.summary.points ?? "";
  els.playedInput.value = state.summary.played ?? "";
  els.goalDifferenceInput.value = state.summary.goalDifference ?? "";
  els.adminSeasonLabel.textContent = `${state.season.team} · ${state.season.label}`;
  els.adminUpdatedLabel.textContent = `Dernière MAJ: ${formatUpdatedAt(state.lastUpdated)}`;
  els.jsonEditor.value = JSON.stringify(state, null, 2);
}

function syncStateFromForm() {
  state.club.name = els.clubNameInput.value.trim();
  state.club.trackedTeam = els.trackedTeamInput.value.trim();
  state.club.defaultVenue = els.venueInput.value.trim();
  state.club.sourceLabel = els.sourceInput.value.trim();
  state.season.label = els.seasonLabelInput.value.trim();
  state.season.team = els.seasonTeamInput.value.trim();
  state.season.competition = els.competitionInput.value.trim();
  state.season.district = els.districtInput.value.trim();
  state.summary.rank = els.rankInput.value === "" ? null : Number(els.rankInput.value);
  state.summary.points = els.pointsInput.value === "" ? null : Number(els.pointsInput.value);
  state.summary.played = els.playedInput.value === "" ? null : Number(els.playedInput.value);
  state.summary.goalDifference = els.goalDifferenceInput.value === "" ? null : Number(els.goalDifferenceInput.value);
  state.lastUpdated = new Date().toISOString();
  state = normalizeSeasonData(state);
}

async function loadAdminData() {
  const payload = await fetchJson("/api/admin/season", { method: "GET" });
  state = normalizeSeasonData(payload.data);
  syncFormFromState();
}

async function login() {
  els.authError.textContent = "";
  try {
    await fetchJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: els.passwordInput.value }),
    });
    els.passwordInput.value = "";
    setAuthenticated(true);
    await loadAdminData();
    toast("Administration déverrouillée.");
  } catch (error) {
    els.authError.textContent = error.message;
  }
}

async function logout() {
  try {
    await fetchJson("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    setAuthenticated(false);
    toast("Session fermée.");
  }
}

function mergeImportedMatches() {
  const imported = parsePastedText(els.pasteInput.value);
  if (!imported.length) {
    toast("Aucun match reconnu dans le texte collé.");
    return;
  }

  syncStateFromForm();
  const byId = new Map(state.matches.map((match) => [match.id, match]));
  imported.forEach((match) => byId.set(match.id, match));
  state.matches = [...byId.values()].sort((left, right) => new Date(left.date) - new Date(right.date));
  state.club.sourceLabel = "Import texte FFF / SportCorico";
  state.lastUpdated = new Date().toISOString();
  syncFormFromState();
  toast(`${imported.length} match(s) importé(s).`);
}

function applyJsonEditor() {
  try {
    state = normalizeSeasonData(JSON.parse(els.jsonEditor.value));
    state.lastUpdated = new Date().toISOString();
    syncFormFromState();
    toast("JSON chargé dans l'éditeur.");
  } catch (error) {
    toast(`JSON invalide: ${error.message}`);
  }
}

async function save() {
  try {
    syncStateFromForm();
    state = normalizeSeasonData(JSON.parse(els.jsonEditor.value || "{}"));
    state.lastUpdated = new Date().toISOString();
    const payload = await fetchJson("/api/admin/season", {
      method: "PUT",
      body: JSON.stringify({ data: state }),
    });
    state = normalizeSeasonData(payload.data);
    syncFormFromState();
    els.saveFeedback.textContent = `Enregistré le ${formatUpdatedAt(state.lastUpdated)}.`;
    toast("Données enregistrées sur le serveur.");
  } catch (error) {
    els.saveFeedback.textContent = error.message;
    toast(`Échec de l'enregistrement: ${error.message}`);
  }
}

async function restoreSession() {
  try {
    await fetchJson("/api/admin/session", { method: "GET" });
    setAuthenticated(true);
    await loadAdminData();
  } catch {
    setAuthenticated(false);
  }
}

bindThemeButtons();
els.loginBtn.addEventListener("click", login);
els.passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
els.reloadBtn.addEventListener("click", async () => {
  await loadAdminData();
  toast("Données rechargées depuis le serveur.");
});
els.logoutBtn.addEventListener("click", logout);
els.parseBtn.addEventListener("click", mergeImportedMatches);
els.clearPasteBtn.addEventListener("click", () => {
  els.pasteInput.value = "";
  toast("Zone de collage vidée.");
});
els.applyJsonBtn.addEventListener("click", applyJsonEditor);
els.copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.jsonEditor.value);
  toast("JSON copié.");
});
els.saveBtn.addEventListener("click", save);

[
  els.clubNameInput,
  els.trackedTeamInput,
  els.seasonLabelInput,
  els.seasonTeamInput,
  els.competitionInput,
  els.districtInput,
  els.venueInput,
  els.sourceInput,
  els.rankInput,
  els.pointsInput,
  els.playedInput,
  els.goalDifferenceInput,
].forEach((input) => {
  input.addEventListener("input", () => {
    syncStateFromForm();
    els.jsonEditor.value = JSON.stringify(clone(state), null, 2);
  });
});

restoreSession();
