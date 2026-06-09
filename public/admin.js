import {
  applyTrackedTeamSelection,
  bindThemeButtons,
  clone,
  formatUpdatedAt,
  getAvailableTeams,
  normalizeDivision,
  normalizeSeasonData,
  parsePastedText,
} from "./shared.js?v=roannais-3";
import {
  getDataSourceStatus,
  loadAdminSeasonData,
  loginAdmin,
  logoutAdmin,
  restoreAdminSession,
  saveAdminSeasonData,
} from "./data-source.js?v=roannais-3";

const els = {
  authPanel: document.getElementById("authPanel"),
  adminPanel: document.getElementById("adminPanel"),
  authHint: document.getElementById("authHint"),
  emailInput: document.getElementById("emailInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginBtn: document.getElementById("loginBtn"),
  authError: document.getElementById("authError"),
  reloadBtn: document.getElementById("reloadBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  adminSeasonLabel: document.getElementById("adminSeasonLabel"),
  adminUpdatedLabel: document.getElementById("adminUpdatedLabel"),
  adminUserLabel: document.getElementById("adminUserLabel"),
  divisionSelect: document.getElementById("divisionSelect"),
  trackedTeamSelect: document.getElementById("trackedTeamSelect"),
  applyTrackedTeamBtn: document.getElementById("applyTrackedTeamBtn"),
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
let currentUserEmail = "";

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function syncAuthState(authenticated) {
  els.authPanel.classList.toggle("hidden", authenticated);
  els.adminPanel.classList.toggle("hidden", !authenticated);
  if (els.adminUserLabel) {
    els.adminUserLabel.textContent = currentUserEmail ? `Connecte: ${currentUserEmail}` : "Session fermee";
  }
}

function applyDataSourceHint() {
  const status = getDataSourceStatus();
  els.authHint.textContent = status.adminLabel;

  if (!status.adminReady) {
    els.emailInput.disabled = true;
    els.passwordInput.disabled = true;
    els.loginBtn.disabled = true;
    els.authError.textContent = status.adminLabel;
  }
}

function refreshTeamOptions(preserveValue = true) {
  const teams = getAvailableTeams(state);
  const currentValue = preserveValue ? els.trackedTeamSelect.value || state.club.trackedTeam : state.club.trackedTeam;

  if (!teams.length) {
    const fallback = state.club.trackedTeam || "Equipe a definir";
    els.trackedTeamSelect.innerHTML = `<option value="${fallback}">${fallback}</option>`;
    els.trackedTeamSelect.value = fallback;
    return;
  }

  els.trackedTeamSelect.innerHTML = teams
    .map((team) => `<option value="${team.value}">${team.label}</option>`)
    .join("");

  const matching = teams.find((team) => team.value === currentValue);
  els.trackedTeamSelect.value = matching?.value || teams[0].value;
}

function updateJsonEditor() {
  els.jsonEditor.value = JSON.stringify(clone(state), null, 2);
}

function syncFormFromState() {
  els.divisionSelect.value = normalizeDivision(state.season.division) || "D4";
  refreshTeamOptions();
  if (state.club.trackedTeam) {
    const hasOption = [...els.trackedTeamSelect.options].some((option) => option.value === state.club.trackedTeam);
    if (!hasOption) {
      const option = document.createElement("option");
      option.value = state.club.trackedTeam;
      option.textContent = state.club.trackedTeam;
      els.trackedTeamSelect.append(option);
    }
    els.trackedTeamSelect.value = state.club.trackedTeam;
  }

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
  els.adminSeasonLabel.textContent = `${state.club.trackedTeam || state.season.team} · ${state.season.label}`;
  els.adminUpdatedLabel.textContent = `Derniere MAJ: ${formatUpdatedAt(state.lastUpdated)}`;
  updateJsonEditor();
}

function syncStateFromForm() {
  state.club.name = els.clubNameInput.value.trim();
  state.club.trackedTeam = els.trackedTeamInput.value.trim();
  state.club.defaultVenue = els.venueInput.value.trim();
  state.club.sourceLabel = els.sourceInput.value.trim();
  state.season.label = els.seasonLabelInput.value.trim();
  state.season.team = els.seasonTeamInput.value.trim();
  state.season.division = normalizeDivision(els.divisionSelect.value) || state.season.division;
  state.season.competition = els.competitionInput.value.trim();
  state.season.district = els.districtInput.value.trim();
  state.summary.rank = els.rankInput.value === "" ? null : Number(els.rankInput.value);
  state.summary.points = els.pointsInput.value === "" ? null : Number(els.pointsInput.value);
  state.summary.played = els.playedInput.value === "" ? null : Number(els.playedInput.value);
  state.summary.goalDifference = els.goalDifferenceInput.value === "" ? null : Number(els.goalDifferenceInput.value);
  state.lastUpdated = new Date().toISOString();
  state = normalizeSeasonData(state);
}

function applyDivisionLabel() {
  const division = normalizeDivision(state.season.division);
  if (!division || !state.season.competition) return;
  state.season.competition = state.season.competition.replace(/District\s*[1-5]/i, `District ${division.slice(1)}`);
}

function applyTrackedTeamSelectionFromUI() {
  syncStateFromForm();
  state = applyTrackedTeamSelection(state, {
    trackedTeam: els.trackedTeamSelect.value,
    division: els.divisionSelect.value,
  });
  applyDivisionLabel();
  state.lastUpdated = new Date().toISOString();
  syncFormFromState();
  toast("Equipe du widget mise a jour.");
}

async function loadSeason() {
  state = normalizeSeasonData(await loadAdminSeasonData());
  syncFormFromState();
}

async function login() {
  els.authError.textContent = "";

  try {
    const session = await loginAdmin(els.emailInput.value.trim(), els.passwordInput.value);
    currentUserEmail = session?.user?.email || els.emailInput.value.trim();
    els.passwordInput.value = "";
    syncAuthState(true);
    await loadSeason();
    toast("Administration connectee.");
  } catch (error) {
    els.authError.textContent = error.message;
  }
}

async function logout() {
  await logoutAdmin();
  currentUserEmail = "";
  syncAuthState(false);
  toast("Session fermee.");
}

function mergeImportedMatches() {
  const imported = parsePastedText(els.pasteInput.value);
  if (!imported.length) {
    toast("Aucun match reconnu dans le texte colle.");
    return;
  }

  syncStateFromForm();
  const byId = new Map(state.matches.map((match) => [match.id, match]));
  imported.forEach((match) => byId.set(match.id, match));
  state.matches = [...byId.values()].sort((left, right) => new Date(left.date) - new Date(right.date));
  state.club.sourceLabel = "Import texte FFF / SportCorico";
  state.lastUpdated = new Date().toISOString();
  state = normalizeSeasonData(state);
  syncFormFromState();
  toast(`${imported.length} match(s) importe(s).`);
}

function applyJsonEditor() {
  try {
    state = normalizeSeasonData(JSON.parse(els.jsonEditor.value));
    state.lastUpdated = new Date().toISOString();
    syncFormFromState();
    toast("JSON applique.");
  } catch (error) {
    toast(`JSON invalide: ${error.message}`);
  }
}

async function save() {
  try {
    state = normalizeSeasonData(JSON.parse(els.jsonEditor.value || "{}"));
    state.lastUpdated = new Date().toISOString();
    state = normalizeSeasonData(await saveAdminSeasonData(state));
    syncFormFromState();
    els.saveFeedback.textContent = `Enregistre le ${formatUpdatedAt(state.lastUpdated)}.`;
    toast("Donnees enregistrees.");
  } catch (error) {
    els.saveFeedback.textContent = error.message;
    toast(`Echec de l'enregistrement: ${error.message}`);
  }
}

async function restoreSession() {
  applyDataSourceHint();

  try {
    const session = await restoreAdminSession();
    if (!session?.user?.email) {
      currentUserEmail = "";
      syncAuthState(false);
      return;
    }

    currentUserEmail = session.user.email;
    syncAuthState(true);
    await loadSeason();
  } catch (error) {
    currentUserEmail = "";
    syncAuthState(false);
    els.authError.textContent = error.message;
  }
}

bindThemeButtons();
els.loginBtn.addEventListener("click", login);
els.passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
els.reloadBtn.addEventListener("click", async () => {
  await loadSeason();
  toast("Donnees rechargees.");
});
els.logoutBtn.addEventListener("click", logout);
els.applyTrackedTeamBtn.addEventListener("click", applyTrackedTeamSelectionFromUI);
els.parseBtn.addEventListener("click", mergeImportedMatches);
els.clearPasteBtn.addEventListener("click", () => {
  els.pasteInput.value = "";
  toast("Zone de collage videe.");
});
els.applyJsonBtn.addEventListener("click", applyJsonEditor);
els.copyJsonBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(els.jsonEditor.value);
  toast("JSON copie.");
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
  els.divisionSelect,
].forEach((input) => {
  input.addEventListener("input", () => {
    syncStateFromForm();
    updateJsonEditor();
  });
});

restoreSession();
