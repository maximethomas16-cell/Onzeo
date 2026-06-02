const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const outputDir = path.join(root, "dist-static");

function cleanDirectory(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

function copyRecursive(source, destination) {
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

async function writeWidgetPayload() {
  const sharedModuleUrl = pathToFileURL(path.join(publicDir, "shared.js")).href;
  const { normalizeSeasonData, buildWidgetPayloadV2 } = await import(sharedModuleUrl);
  const seasonRaw = JSON.parse(fs.readFileSync(path.join(dataDir, "season.json"), "utf8"));
  const seasonData = normalizeSeasonData(seasonRaw);
  const widgetPayload = {
    data: buildWidgetPayloadV2(seasonData),
  };
  fs.writeFileSync(path.join(outputDir, "widget-data.json"), JSON.stringify(widgetPayload, null, 2));
}

async function main() {
  cleanDirectory(outputDir);
  copyRecursive(publicDir, outputDir);
  copyRecursive(path.join(dataDir, "season.json"), path.join(outputDir, "data", "season.json"));
  await writeWidgetPayload();
  fs.writeFileSync(path.join(outputDir, ".nojekyll"), "");

  console.log(`Site statique genere dans ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
