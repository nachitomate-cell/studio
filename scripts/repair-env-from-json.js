/**
 * Lee el JSON del service account de Google y escribe/repara .env.local
 *
 * Uso:
 *   node scripts/repair-env-from-json.js "C:\ruta\al\service-account.json"
 */

const fs   = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const jsonArg = process.argv[2];
if (!jsonArg) {
  console.error("Uso: node scripts/repair-env-from-json.js <ruta-al-json>");
  console.error('Ejemplo: node scripts/repair-env-from-json.js "C:\\Users\\56983\\Downloads\\barberiaferraza-edc26-846e693cc435.json"');
  process.exit(1);
}

// ── 1. Leer el JSON del service account ──────────────────────────────────────
let sa;
try {
  sa = JSON.parse(fs.readFileSync(path.resolve(jsonArg), "utf8"));
} catch (e) {
  console.error("❌ No se pudo leer el JSON:", e.message);
  process.exit(1);
}

const { client_email, private_key } = sa;
if (!client_email || !private_key) {
  console.error("❌ El JSON no tiene client_email o private_key");
  process.exit(1);
}

// ── 2. Validar que la clave funciona ────────────────────────────────────────
try {
  crypto.createPrivateKey(private_key);
  console.log("✅ Private key válida");
} catch (e) {
  console.error("❌ La private key del JSON no es válida:", e.message);
  process.exit(1);
}

// ── 3. Convertir la clave a formato de una sola línea para .env.local ───────
//    El JSON ya tiene \n reales dentro del string; hay que convertirlos
//    a la secuencia literal \n para que .env.local funcione correctamente.
const singleLineKey = private_key.replace(/\n/g, "\\n");

// ── 4. Leer .env.local actual ────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
let envContent = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8")
  : "";

// ── 5. Reemplazar o agregar GOOGLE_SERVICE_ACCOUNT_EMAIL ─────────────────────
function upsertEnvVar(content, key, value) {
  // Eliminar cualquier línea existente con esa variable (incluyendo multi-línea rota)
  const lines = content.split("\n");
  const filtered = lines.filter((l) => !l.startsWith(`${key}=`));
  // Agregar la nueva línea al final
  filtered.push(`${key}="${value}"`);
  return filtered.join("\n");
}

envContent = upsertEnvVar(envContent, "GOOGLE_SERVICE_ACCOUNT_EMAIL", client_email);
envContent = upsertEnvVar(envContent, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", singleLineKey);

// ── 6. Guardar ────────────────────────────────────────────────────────────────
// Asegurar que no haya líneas en blanco duplicadas al final
envContent = envContent.replace(/\n{3,}/g, "\n\n").trim() + "\n";
fs.writeFileSync(envPath, envContent, "utf8");

console.log("✅ .env.local actualizado correctamente");
console.log("   GOOGLE_SERVICE_ACCOUNT_EMAIL =", client_email);
console.log("   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = [clave de", private_key.length, "chars]");

// ── 7. Verificación final ────────────────────────────────────────────────────
const written = fs.readFileSync(envPath, "utf8");
const keyLine = written.split("\n").find((l) => l.startsWith("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="));
const extractedVal = keyLine?.slice("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=".length + 1, -1) ?? "";
const parsedKey = extractedVal.replace(/\\n/g, "\n");

try {
  crypto.createPrivateKey(parsedKey);
  console.log("\n✅ Verificación: la clave se lee correctamente desde .env.local");
  console.log("   Ejecuta ahora: node scripts/check-wallet-class.js");
} catch (e) {
  console.error("\n❌ Verificación fallida:", e.message);
}
