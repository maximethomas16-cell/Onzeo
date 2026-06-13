import {
  bindThemeButtons,
  buildWidgetPayloadV2,
  clone,
  formatUpdatedAt,
  getAvailableTeams,
  getClubLogoUrl,
  normalizeDivision,
  normalizeSeasonData,
  parsePastedText,
} from "./shared.js?v=roannais-4";
import {
  getDataSourceStatus,
  loadAdminSeasonData,
  loadClubBundle,
  loadClubCatalog,
  loginAdmin,
  logoutAdmin,
  restoreAdminSession,
  saveAdminSeasonData,
} from "./data-source.js?v=roannais-4";

const els = {
  authPanel: document.getElementById("authPanel"),
  adminPanel: document.getElementById("adminPanel"),
  adminBrandCrest: document.getElementById("adminBrandCrest"),
  adminBrandTitle: document.getElementById("adminBrandTitle"),
  adminBrandLede: document.getElementById("adminBrandLede"),
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
  groupSelect: document.getElementById("groupSelect"),
  trackedTeamSelect: document.getElementById("trackedTeamSelect"),
  applyTrackedTeamBtn: document.getElementById("applyTrackedTeamBtn"),
  clubSelectionFeedback: document.getElementById("clubSelectionFeedback"),
  clubNameInput: document.getElementById("clubNameInput"),
  trackedTeamInput: document.getElementById("trackedTeamInput"),
  seasonLabelInput: document.getElementById("seasonLabelInput"),
  seasonTeamInput: document.getElementById("seasonTeamInput"),
  competitionInput: document.getElementById("competitionInput"),
  districtInput: document.getElementById("districtInput"),
  venueInput: document.getElementById("venueInput"),
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
let selectionIsSubmitting = false;
let catalogEntries = [];

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

function applyBranding() {
  const clubName = state.club.name || state.club.trackedTeam || "Club";
  const seasonTeam = state.season.team || state.club.trackedTeam || "Equipe";
  const crestUrl = "./assets/logo-onzeo.png";

  document.title = "Onzeo - Administration";
  els.adminBrandCrest.src = crestUrl;
  els.adminBrandCrest.alt = "Logo Onzeo";
  els.adminBrandTitle.textContent = "Onzeo Admin";
  els.adminBrandLede.textContent = `Club actif: ${clubName} - ${seasonTeam}, import des matchs et publication widget-ready.`;
}

function setSelectionFeedback(message = "", type = "") {
  els.clubSelectionFeedback.textContent = message;
  els.clubSelectionFeedback.classList.remove("error", "loading", "success");
  if (type) {
    els.clubSelectionFeedback.classList.add(type);
  }
}

function getCatalogEntriesForDivision(division = els.divisionSelect.value) {
  const normalizedDivision = normalizeDivision(division);
  return catalogEntries
    .filter((entry) => normalizeDivision(entry.division) === normalizedDivision)
    .sort((left, right) => {
      if ((left.group || "") !== (right.group || "")) {
        return String(left.group || "").localeCompare(String(right.group || ""), "fr");
      }
      if ((left.rank ?? 999) !== (right.rank ?? 999)) {
        return (left.rank ?? 999) - (right.rank ?? 999);
      }
      return String(left.teamName || "").localeCompare(String(right.teamName || ""), "fr");
    });
}

function getCatalogGroupsForDivision(division = els.divisionSelect.value) {
  const groups = [...new Set(getCatalogEntriesForDivision(division).map((entry) => String(entry.group || "").trim()))];
  return groups.length ? groups : [""];
}

function formatGroupLabel(group) {
  return String(group || "").trim() || "Phase unique";
}

function refreshGroupOptions(preserveValue = true) {
  const groups = getCatalogGroupsForDivision();
  const currentValue = preserveValue ? els.groupSelect.value || String(state.season.group || "").trim() : String(state.season.group || "").trim();

  els.groupSelect.replaceChildren();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = formatGroupLabel(group);
    els.groupSelect.append(option);
  });

  const matchingGroup = groups.find((group) => group === currentValue);
  els.groupSelect.value = matchingGroup ?? groups[0] ?? "";
}

function getCatalogEntriesForSelection() {
  const activeGroup = String(els.groupSelect.value || "").trim();
  return getCatalogEntriesForDivision().filter((entry) => String(entry.group || "").trim() === activeGroup);
}

function getSelectedCatalogEntry() {
  return catalogEntries.find((entry) => entry.id === els.trackedTeamSelect.value) || null;
}

function refreshSelectionButtonState() {
  const selectedCatalogEntry = getSelectedCatalogEntry();
  const selectionChanged = selectedCatalogEntry
    ? selectedCatalogEntry.id !== String(state.club.catalogId || "")
    : normalizeDivision(els.divisionSelect.value) !== normalizeDivision(state.season.division) ||
      String(els.trackedTeamSelect.value || "") !== String(state.club.trackedTeam || "");

  els.applyTrackedTeamBtn.disabled = selectionIsSubmitting || !selectionChanged;
  els.applyTrackedTeamBtn.textContent = selectionIsSubmitting ? "Chargement..." : "Valider et charger le club";

  if (!selectionIsSubmitting && !selectionChanged && !els.clubSelectionFeedback.textContent) {
    setSelectionFeedback("Le club affiche est deja synchronise.", "success");
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
  const catalogTeams = getCatalogEntriesForSelection();
  const currentValue = preserveValue ? els.trackedTeamSelect.value || state.club.catalogId || state.club.trackedTeam : state.club.catalogId;

  if (catalogTeams.length) {
    els.trackedTeamSelect.replaceChildren();
    catalogTeams.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label || entry.teamName || entry.clubName || entry.id;
      els.trackedTeamSelect.append(option);
    });

    const matchingEntry = catalogTeams.find((entry) => entry.id === currentValue);
    els.trackedTeamSelect.value = matchingEntry?.id || catalogTeams[0].id;
    return;
  }

  const teams = getAvailableTeams(state);
  const fallbackValue = preserveValue ? els.trackedTeamSelect.value || state.club.trackedTeam : state.club.trackedTeam;

  if (!teams.length) {
    const fallback = state.club.trackedTeam || "Equipe a definir";
    els.trackedTeamSelect.innerHTML = `<option value="${fallback}">${fallback}</option>`;
    els.trackedTeamSelect.value = fallback;
    return;
  }

  els.trackedTeamSelect.innerHTML = teams
    .map((team) => `<option value="${team.value}">${team.label}</option>`)
    .join("");

  const matching = teams.find((team) => team.value === fallbackValue);
  els.trackedTeamSelect.value = matching?.value || teams[0].value;
}

function updateJsonEditor() {
  els.jsonEditor.value = JSON.stringify(clone(state), null, 2);
}

function syncFormFromState() {
  els.divisionSelect.value = normalizeDivision(state.season.division) || "D4";
  refreshGroupOptions();
  refreshTeamOptions();
  if (catalogEntries.length && state.club.catalogId) {
    const hasCatalogOption = [...els.trackedTeamSelect.options].some((option) => option.value === state.club.catalogId);
    if (hasCatalogOption) {
      els.trackedTeamSelect.value = state.club.catalogId;
    }
  } else if (state.club.trackedTeam) {
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
  els.rankInput.value = state.summary.rank ?? "";
  els.pointsInput.value = state.summary.points ?? "";
  els.playedInput.value = state.summary.played ?? "";
  els.goalDifferenceInput.value = state.summary.goalDifference ?? "";
  els.adminSeasonLabel.textContent = `${state.club.trackedTeam || state.season.team} - ${state.season.label}`;
  els.adminUpdatedLabel.textContent = `Derniere MAJ: ${formatUpdatedAt(state.lastUpdated)}`;
  applyBranding();
  updateJsonEditor();
  refreshSelectionButtonState();
}

function syncStateFromForm() {
  state.club.name = els.clubNameInput.value.trim();
  state.club.trackedTeam = els.trackedTeamInput.value.trim();
  state.club.defaultVenue = els.venueInput.value.trim();
  state.season.label = els.seasonLabelInput.value.trim();
  state.season.team = els.seasonTeamInput.value.trim();
  state.season.division = normalizeDivision(els.divisionSelect.value) || state.season.division;
  state.season.group = String(els.groupSelect.value || "").trim();
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

function pushAndroidSync() {
  const bridge = window.AndroidWidgetAdmin;
  if (!bridge) return;

  try {
    if (typeof bridge.saveSeasonData === "function") {
      bridge.saveSeasonData(JSON.stringify(state));
    }
    if (typeof bridge.saveWidgetPayload === "function") {
      bridge.saveWidgetPayload(JSON.stringify({ data: buildWidgetPayloadV2(state) }));
    }
  } catch {
    // Ignore bridge failures in standard browsers.
  }
}

async function applyTrackedTeamSelectionFromUI() {
  if (selectionIsSubmitting) return;

  selectionIsSubmitting = true;
  setSelectionFeedback("Chargement du nouveau club...", "loading");
  refreshSelectionButtonState();

  try {
    const selectedCatalogEntry = getSelectedCatalogEntry();

    if (selectedCatalogEntry) {
      state = normalizeSeasonData(await loadClubBundle(selectedCatalogEntry.bundlePath));
      state = normalizeSeasonData(await saveAdminSeasonData(state));
    } else {
      syncStateFromForm();
      state.club.trackedTeam = els.trackedTeamSelect.value;
      state.season.division = normalizeDivision(els.divisionSelect.value) || state.season.division;
      applyDivisionLabel();
      state.lastUpdated = new Date().toISOString();
      state = normalizeSeasonData(await saveAdminSeasonData(state));
    }

    syncFormFromState();
    pushAndroidSync();
    setSelectionFeedback(`Club charge: ${state.club.name}.`, "success");
    toast(`Club charge: ${state.club.name}`);
  } catch (error) {
    setSelectionFeedback(error.message, "error");
    toast(`Echec du chargement: ${error.message}`);
  } finally {
    selectionIsSubmitting = false;
    refreshSelectionButtonState();
  }
}

async function loadSeason() {
  try {
    catalogEntries = await loadClubCatalog();
  } catch {
    catalogEntries = [];
    setSelectionFeedback("Catalogue verifie indisponible, bascule temporaire en mode manuel.", "error");
  }

  state = normalizeSeasonData(await loadAdminSeasonData());
  syncFormFromState();
  pushAndroidSync();
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
  pushAndroidSync();
  toast(`${imported.length} match(s) importe(s).`);
}

function applyJsonEditor() {
  try {
    state = normalizeSeasonData(JSON.parse(els.jsonEditor.value));
    state.lastUpdated = new Date().toISOString();
    syncFormFromState();
    pushAndroidSync();
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
    pushAndroidSync();
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
els.divisionSelect.addEventListener("change", () => {
  refreshGroupOptions(false);
  refreshTeamOptions(false);
  syncStateFromForm();
  updateJsonEditor();
  setSelectionFeedback("Valide pour charger ce club sur le widget et l'appli.", "");
  refreshSelectionButtonState();
});
els.groupSelect.addEventListener("change", () => {
  refreshTeamOptions(false);
  syncStateFromForm();
  updateJsonEditor();
  setSelectionFeedback("Valide pour charger ce club sur le widget et l'appli.", "");
  refreshSelectionButtonState();
});
els.trackedTeamSelect.addEventListener("change", () => {
  setSelectionFeedback("Valide pour charger ce club sur le widget et l'appli.", "");
  refreshSelectionButtonState();
});
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
