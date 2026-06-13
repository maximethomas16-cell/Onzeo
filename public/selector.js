import { bindThemeButtons, buildWidgetPayloadV2, normalizeDivision } from "./shared.js?v=roannais-4";
import { loadClubBundle, loadClubCatalog } from "./data-source.js?v=roannais-4";

const els = {
  selectorBrandCrest: document.getElementById("selectorBrandCrest"),
  selectorBrandTitle: document.getElementById("selectorBrandTitle"),
  selectorBrandLede: document.getElementById("selectorBrandLede"),
  division: document.getElementById("selectorDivision"),
  group: document.getElementById("selectorGroup"),
  team: document.getElementById("selectorTeam"),
  applyBtn: document.getElementById("selectorApplyBtn"),
  feedback: document.getElementById("selectorFeedback"),
  toast: document.getElementById("selectorToast"),
};

let catalogEntries = [];
let currentPayload = null;
let isSubmitting = false;

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function setFeedback(message = "", type = "") {
  els.feedback.textContent = message;
  els.feedback.classList.remove("error", "loading", "success");
  if (type) {
    els.feedback.classList.add(type);
  }
}

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function readBridgePayload() {
  const bridge = window.AndroidWidgetAdmin;
  if (!bridge || typeof bridge.getWidgetPayloadJson !== "function") {
    return null;
  }

  try {
    const raw = bridge.getWidgetPayloadJson();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || parsed || null;
  } catch {
    return null;
  }
}

function getEntriesForDivision() {
  const division = normalizeDivision(els.division.value);
  return catalogEntries
    .filter((entry) => normalizeDivision(entry.division) === division)
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

function getGroupsForDivision() {
  const groups = [...new Set(getEntriesForDivision().map((entry) => String(entry.group || "").trim()))];
  return groups.length ? groups : [""];
}

function getEntriesForSelection() {
  const group = String(els.group.value || "").trim();
  return getEntriesForDivision().filter((entry) => String(entry.group || "").trim() === group);
}

function formatGroupLabel(group) {
  return String(group || "").trim() || "Phase unique";
}

function refreshGroupOptions(preserveValue = true) {
  const groups = getGroupsForDivision();
  const currentValue = preserveValue ? els.group.value : "";

  els.group.replaceChildren();
  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = formatGroupLabel(group);
    els.group.append(option);
  });

  const matching = groups.find((group) => group === currentValue);
  els.group.value = matching ?? groups[0] ?? "";
}

function refreshTeamOptions(preserveValue = true) {
  const entries = getEntriesForSelection();
  const currentValue = preserveValue ? els.team.value : "";

  els.team.replaceChildren();
  entries.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.label || entry.teamName || entry.clubName || entry.id;
    els.team.append(option);
  });

  const matching = entries.find((entry) => entry.id === currentValue);
  els.team.value = matching?.id || entries[0]?.id || "";
}

function applyBranding(entry = null) {
  const club = entry
    ? { name: entry.clubName, trackedTeam: entry.teamName, logoPath: entry.logoPath }
    : { name: currentPayload?.club?.name || "Choisir le club", trackedTeam: currentPayload?.club?.trackedTeam || "" };

  const clubName = club.name || "Choisir le club";
  document.title = "Onzeo - Choisir le club";
  els.selectorBrandCrest.src = "./assets/logo-onzeo.png";
  els.selectorBrandCrest.alt = "Logo Onzeo";
  els.selectorBrandTitle.textContent = "Onzeo";
  els.selectorBrandLede.textContent = entry
    ? `${entry.teamName} - ${entry.division}${entry.group ? ` - ${entry.group}` : ""}`
    : `Club actuel: ${clubName}. Cette action met a jour l'application et le widget sur ce telephone, sans passer par l'admin.`;
}

function preselectCurrentEntry() {
  if (!catalogEntries.length || !currentPayload) {
    return;
  }

  const trackedTeam = normalizeToken(currentPayload?.club?.trackedTeam);
  const clubName = normalizeToken(currentPayload?.club?.name);
  const match =
    catalogEntries.find((entry) => normalizeToken(entry.teamName) === trackedTeam) ||
    catalogEntries.find((entry) => normalizeToken(entry.clubName) === clubName) ||
    null;

  if (!match) {
    return;
  }

  els.division.value = normalizeDivision(match.division) || els.division.value;
  refreshGroupOptions(false);
  els.group.value = String(match.group || "").trim();
  refreshTeamOptions(false);
  els.team.value = match.id;
  applyBranding(match);
}

function getSelectedEntry() {
  return catalogEntries.find((entry) => entry.id === els.team.value) || null;
}

async function applySelection() {
  if (isSubmitting) return;
  const selectedEntry = getSelectedEntry();
  if (!selectedEntry) {
    setFeedback("Selectionne d'abord une equipe.", "error");
    return;
  }

  isSubmitting = true;
  els.applyBtn.disabled = true;
  setFeedback("Chargement du club dans l'application...", "loading");

  try {
    const seasonData = await loadClubBundle(selectedEntry.bundlePath);
    const payload = { data: buildWidgetPayloadV2(seasonData) };
    const bridge = window.AndroidWidgetAdmin;

    if (bridge && typeof bridge.saveWidgetPayload === "function") {
      bridge.saveWidgetPayload(JSON.stringify(payload));
    }

    currentPayload = payload.data;
    applyBranding(selectedEntry);
    setFeedback(`Club charge sur ce telephone : ${selectedEntry.clubName}.`, "success");
    toast(`Club charge : ${selectedEntry.clubName}`);
  } catch (error) {
    setFeedback(error.message, "error");
    toast(`Echec du chargement : ${error.message}`);
  } finally {
    isSubmitting = false;
    els.applyBtn.disabled = false;
  }
}

async function init() {
  bindThemeButtons();
  currentPayload = readBridgePayload();
  catalogEntries = await loadClubCatalog();
  preselectCurrentEntry();
  if (!catalogEntries.length) {
    throw new Error("Aucun club disponible dans le catalogue.");
  }

  if (!currentPayload) {
    refreshGroupOptions(false);
    refreshTeamOptions(false);
    applyBranding(getSelectedEntry());
    return;
  }

  if (!els.team.value) {
    refreshGroupOptions(false);
    refreshTeamOptions(false);
  }
}

els.division.addEventListener("change", () => {
  refreshGroupOptions(false);
  refreshTeamOptions(false);
  applyBranding(getSelectedEntry());
  setFeedback("");
});

els.group.addEventListener("change", () => {
  refreshTeamOptions(false);
  applyBranding(getSelectedEntry());
  setFeedback("");
});

els.team.addEventListener("change", () => {
  applyBranding(getSelectedEntry());
  setFeedback("");
});

els.applyBtn.addEventListener("click", applySelection);

init().catch((error) => {
  bindThemeButtons();
  setFeedback(error.message, "error");
  applyBranding();
});
