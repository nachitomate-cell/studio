/**
 * Actualiza la Loyalty Class de Draft → UNDER_REVIEW
 * y completa los campos requeridos que faltan (programName, issuerName).
 *
 * Ejecutar: node scripts/fix-wallet-class.js
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

// ── PATCH a la Wallet API ─────────────────────────────────────────────────────
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

  console.log("\n── Actualizando Loyalty Class ──────────────────────────");
  console.log("   Class ID:", CLASS_ID);
  console.log("   draft → UNDER_REVIEW\n");

  const token = await getAccessToken(email, rawKey);
  console.log("✅ Access token obtenido\n");

  // PATCH con los campos mínimos requeridos + reviewStatus
  const patch = {
    reviewStatus:  "UNDER_REVIEW",
    issuerName:    "Patio Curauma",
    programName:   "Club Patio Curauma",
    loyaltyPointsLabel: "Sellos",
    hexBackgroundColor: "#0a2342",
    programLogo: {
      sourceUri: { uri: "https://clubpatiocurauma.synaptechspa.cl/Logo3.png" },
      contentDescription: {
        defaultValue: { language: "es-CL", value: "Logo Club Patio Curauma" },
      },
    },
  };

  const res = await patchClass(token, patch);

  if (res.status === 200) {
    console.log("✅ Clase actualizada exitosamente");
    console.log("   reviewStatus:", res.body.reviewStatus);
    console.log("   programName: ", res.body.programName);
    console.log("\n   Prueba ahora el botón 'Añadir' en Google Wallet.");
  } else {
    console.error("❌ Error al actualizar:", res.status);
    console.error(JSON.stringify(res.body, null, 2));
  }
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
