const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "public/index.html",
  "public/admin.html",
  "public/app.js",
  "public/admin.js",
  "public/widget.js",
  "public/shared.js",
  "public/data-source.js",
  "public/config.js",
  "public/styles.css",
  "public/assets/logo-fc-regny.png",
  "public/assets/logo-onzeo.png",
  "public/assets/icon-onzeo.png",
  "public/assets/icon-onzeo-192.png",
  "public/sw.js",
  "public/manifest.webmanifest",
  "public/data/roannais-catalog.json",
  "data/season.json",
  "scripts/build_static_site.js",
  "scripts/generate_roannais_bundles.js",
  "scripts/generate_password_hash.js",
  "docs/SUPABASE_SETUP.md",
];

const checks = [];

function check(name, condition, hint = "") {
  checks.push({ name, ok: Boolean(condition), hint });
}

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  check(`${relativePath} existe`, fs.existsSync(fullPath), `Creer ${relativePath}`);
}

const publicIndex = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const publicAdmin = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const publicApp = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const adminJs = fs.readFileSync(path.join(root, "public/admin.js"), "utf8");
const dataSourceJs = fs.readFileSync(path.join(root, "public/data-source.js"), "utf8");
const manifest = fs.readFileSync(path.join(root, "public/manifest.webmanifest"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
const seasonRaw = fs.readFileSync(path.join(root, "data/season.json"), "utf8");
const catalogRaw = fs.readFileSync(path.join(root, "public/data/roannais-catalog.json"), "utf8");

check("le widget public charge la source cliente", publicApp.includes("loadPublicSeasonData"));
check("la page admin utilise Supabase ou la source statique", adminJs.includes("loginAdmin") && dataSourceJs.includes("supabase"));
check("la page admin existe separement", publicAdmin.includes("Onzeo Admin"));
check("aucun mot de passe en clair n'est expose dans le public", !/Maxx42630!|ClubTest123!|ADMIN_PASSWORD\s*=/.test(publicIndex + publicAdmin + adminJs + dataSourceJs));
check("le manifest utilise des chemins relatifs", manifest.includes('"./widget.html"') && manifest.includes('"./assets/icon-onzeo.png"')); 
check("le service worker precache le shell gratuit", swJs.includes("dist-static") === false && swJs.includes("data-source.js"));

let season;
try {
  season = JSON.parse(seasonRaw);
} catch (error) {
  check("data/season.json est un JSON valide", false, error.message);
}

if (season) {
  check("data/season.json contient club", typeof season.club === "object");
  check("data/season.json contient season", typeof season.season === "object");
  check("data/season.json contient matches", Array.isArray(season.matches));
  check("data/season.json contient standingsTable", Array.isArray(season.standingsTable));
  check("data/season.json reference un bundle catalogue", Boolean(season.club?.catalogId));
}

let catalog;
try {
  catalog = JSON.parse(catalogRaw);
} catch (error) {
  check("public/data/roannais-catalog.json est un JSON valide", false, error.message);
}

if (catalog) {
  check("le catalogue Roannais contient des entrees", Array.isArray(catalog.entries) && catalog.entries.length > 0);
  check(
    "le catalogue Roannais couvre D1 a D5",
    ["D1", "D2", "D3", "D4", "D5"].every((division) => catalog.entries.some((entry) => entry.division === division)),
  );
}

const failed = checks.filter((entry) => !entry.ok);

console.log("Validation Onzeo");
console.log("==========================");
for (const entry of checks) {
  console.log(`[${entry.ok ? "OK" : "ERREUR"}] ${entry.name}`);
  if (!entry.ok && entry.hint) console.log(`         ${entry.hint}`);
}

if (failed.length) {
  console.log(`\n${failed.length} verification(s) en erreur.`);
  process.exit(1);
}

console.log("\nToutes les verifications sont OK.");
