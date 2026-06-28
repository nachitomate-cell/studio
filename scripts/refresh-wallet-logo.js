/**
 * PATCH quirúrgico al programLogo de la Loyalty Class de Google Wallet.
 *
 * Refresca solo el URI del logo (al dominio custom de producción) sin tocar
 * reviewStatus, issuerName, programName, hexBackgroundColor ni nada más.
 *
 * Ejecutar: node scripts/refresh-wallet-logo.js
 */

const crypto = require("node:crypto");
const https  = require("node:https");
const fs     = require("node:fs");
const path   = require("node:path");

// ── Cargar .env.local ─────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  });
}

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? "3388000000023126417";
const CLASS_ID  = `${ISSUER_ID}.club_patio_curauma`;
const NEW_LOGO_URI = "https://clubpatiocurauma.synaptechspa.cl/Logo3.png";

// ── Firmar JWT con node:crypto ────────────────────────────────────────────────
function signRS256(payload, pemKey) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}`;
  return `${input}.${crypto.createSign("SHA256").update(input).sign(pemKey, "base64url")}`;
}

// ── Obtener access token OAuth2 ───────────────────────────────────────────────
function getAccessToken(email, pemKey) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRS256(
    { iss: email, scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    pemKey
  );
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`;
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "oauth2.googleapis.com", path: "/token", method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded",
                   "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`${json.error}: ${json.error_description}`));
          else resolve(json.access_token);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── GET el estado actual de la clase ──────────────────────────────────────────
function getClass(accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "walletobjects.googleapis.com",
        path: `/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
          catch { resolve({ status: res.statusCode, body: out }); }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ── PATCH parcial a la Wallet API ─────────────────────────────────────────────
function patchClass(accessToken, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "walletobjects.googleapis.com",
        path: `/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID)}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(out) }); }
          catch { resolve({ status: res.statusCode, body: out }); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.replace(/^["']|["']$/g, "").trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");

  if (!email || !rawKey) {
    console.error("❌ Faltan credenciales en .env.local");
    process.exit(1);
  }

  console.log("\n── Refresh programLogo (PATCH quirúrgico) ──────────────");
  console.log("   Class ID:", CLASS_ID);
  console.log("   Nuevo URI:", NEW_LOGO_URI, "\n");

  const token = await getAccessToken(email, rawKey);
  console.log("✅ Access token obtenido\n");

  // Snapshot del estado actual para que veas qué se conserva
  const before = await getClass(token);
  if (before.status !== 200) {
    console.error("❌ No se pudo leer la clase actual:", before.status);
    console.error(JSON.stringify(before.body, null, 2));
    process.exit(1);
  }
  const currentLogoUri = before.body?.programLogo?.sourceUri?.uri ?? "(sin logo)";
  console.log("📋 Estado actual:");
  console.log("   reviewStatus:", before.body.reviewStatus);
  console.log("   programName: ", before.body.programName);
  console.log("   logo actual: ", currentLogoUri, "\n");

  if (currentLogoUri === NEW_LOGO_URI) {
    console.log("✅ El logo ya apunta al nuevo dominio. Nada que hacer.");
    return;
  }

  // PATCH parcial: solo programLogo. Conserva reviewStatus, programName, etc.
  const patch = {
    programLogo: {
      sourceUri: { uri: NEW_LOGO_URI },
      contentDescription: {
        defaultValue: { language: "es-CL", value: "Logo Club Patio Curauma" },
      },
    },
  };

  const res = await patchClass(token, patch);

  if (res.status === 200) {
    console.log("✅ Logo actualizado exitosamente");
    console.log("   reviewStatus (sin cambios):", res.body.reviewStatus);
    console.log("   programLogo nuevo:         ", res.body.programLogo?.sourceUri?.uri);
    console.log("\n   Los pases ya entregados refrescarán el logo automáticamente.");
  } else {
    console.error("❌ Error al actualizar:", res.status);
    console.error(JSON.stringify(res.body, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
