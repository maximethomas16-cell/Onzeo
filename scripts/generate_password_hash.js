const crypto = require("node:crypto");

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/generate_password_hash.js <mot_de_passe>");
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const encoded = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

console.log(encoded);
