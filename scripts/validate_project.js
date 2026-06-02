const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "server.js",
  "public/index.html",
  "public/admin.html",
  "public/app.js",
  "public/admin.js",
  "public/shared.js",
  "public/styles.css",
  "public/assets/logo-fc-regny.png",
  "data/season.json",
  "scripts/generate_password_hash.js",
];

const checks = [];

function check(name, condition, hint = "") {
  checks.push({ name, ok: Boolean(condition), hint });
}

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  check(`${relativePath} existe`, fs.existsSync(fullPath), `Créer ${relativePath}`);
}

const publicIndex = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const publicAdmin = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
const publicApp = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const sharedJs = fs.readFileSync(path.join(root, "public/shared.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const seasonRaw = fs.readFileSync(path.join(root, "data/season.json"), "utf8");

check("le widget public appelle l'API publique", publicIndex.includes('/app.js') && publicApp.includes("/api/public/season"));
check("la page admin existe séparément", publicAdmin.includes("Administration sécurisée"));
check("aucun mot de passe en clair n'est exposé dans le public", !/Maxx42630!|ADMIN_PASSWORD\s*=/.test(publicIndex + publicAdmin + sharedJs));
check("server.js utilise un secret de session", serverJs.includes("SESSION_SECRET"));
check("server.js utilise un hash de mot de passe admin", serverJs.includes("ADMIN_PASSWORD_HASH"));
check("server.js protège une API admin", serverJs.includes("/api/admin/season"));

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
}

const failed = checks.filter((entry) => !entry.ok);

console.log("Validation FC Régny Widget");
console.log("==========================");
for (const entry of checks) {
  console.log(`[${entry.ok ? "OK" : "ERREUR"}] ${entry.name}`);
  if (!entry.ok && entry.hint) console.log(`         ${entry.hint}`);
}

if (failed.length) {
  console.log(`\n${failed.length} vérification(s) en erreur.`);
  process.exit(1);
}

console.log("\nToutes les vérifications sont OK.");
