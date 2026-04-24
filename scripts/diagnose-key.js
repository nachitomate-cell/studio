/**
 * Diagnostica el estado de la private key en .env.local
 * Ejecutar: node scripts/diagnose-key.js
 */
const crypto = require("node:crypto");
const fs     = require("node:fs");
const path   = require("node:path");

const envPath = path.join(__dirname, "..", ".env.local");
const raw     = fs.readFileSync(envPath, "utf8");

// Encontrar la línea que contiene la private key
const lines = raw.split("\n");
const keyLines = lines
  .map((l, i) => ({ i, l }))
  .filter(({ l }) => l.includes("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"));

console.log("\n── Líneas encontradas con GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ──");
keyLines.forEach(({ i, l }) =>
  console.log(`  Línea ${i + 1} (${l.length} chars): ${l.slice(0, 80)}…`)
);

// Extraer el valor crudo tal como está en el archivo
const rawLine = keyLines[0]?.l ?? "";
const eqIdx   = rawLine.indexOf("=");
const rawVal  = rawLine.slice(eqIdx + 1);

console.log("\n── Valor crudo (primeros 120 chars) ──");
console.log(JSON.stringify(rawVal.slice(0, 120)));

console.log("\n── Contiene... ──");
console.log("  '\\\\n' (literal backslash-n):", rawVal.includes("\\n"));
console.log("  salto de línea real (\\n):", rawVal.includes("\n"));
console.log("  BEGIN PRIVATE KEY:        ", rawVal.includes("BEGIN PRIVATE KEY"));
console.log("  Comilla inicial:          ", rawVal.startsWith('"') || rawVal.startsWith("'"));
console.log("  Longitud total:            ", rawVal.length);

// Intentar parsear y probar varias estrategias
console.log("\n── Intentando estrategias de parseo ──");

const strategies = [
  {
    name: "A: quitar comillas + reemplazar \\n literal",
    fn: (v) => v.replace(/^["']|["']$/g, "").trim().replace(/\\n/g, "\n"),
  },
  {
    name: "B: solo reemplazar \\n literal (sin quitar comillas)",
    fn: (v) => v.trim().replace(/\\n/g, "\n"),
  },
  {
    name: "C: valor tal cual (ya tiene saltos reales)",
    fn: (v) => v.replace(/^["']|["']$/g, "").trim(),
  },
  {
    name: "D: quitar comillas, reemplazar \\\\n (doble escape)",
    fn: (v) => v.replace(/^["']|["']$/g, "").trim().replace(/\\\\n/g, "\n"),
  },
];

for (const { name, fn } of strategies) {
  try {
    const key = fn(rawVal);
    crypto.createPrivateKey(key);
    console.log(`  ✅ ${name}`);
    console.log(`     → Inicio: ${JSON.stringify(key.slice(0, 40))}`);
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message.slice(0, 60)}`);
  }
}
