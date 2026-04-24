/**
 * Verifica el estado de la Loyalty Class en Google Wallet.
 * Solo usa módulos nativos de Node.js — sin google-auth-library.
 * Ejecutar: node scripts/check-wallet-class.js
 */

const crypto = require("node:crypto");
const https  = require("node:https");
const fs     = require("node:fs");
const path   = require("node:path");

// ── 1. Cargar .env.local ──────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      // Quitar comillas externas del valor (pero conservar el contenido interno)
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    });
  console.log("✅ .env.local cargado");
}

// ── 2. Parsear la private key ─────────────────────────────────────────────────
function parseKey(raw) {
  let key = raw.replace(/^["']|["']$/g, "").trim(); // quitar comillas externas
  key = key.replace(/\\n/g, "\n");                  // \n literal → salto real
  return key;
}

// ── 3. Firmar JWT con node:crypto (soporta PKCS#8 de Google) ─────────────────
function signRS256(payload, pemKey) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(payload)}`;
  const sig = crypto.createSign("SHA256").update(input).sign(pemKey, "base64url");
  return `${input}.${sig}`;
}

// ── 4. Obtener access token OAuth2 via JWT grant ──────────────────────────────
function getAccessToken(email, pemKey) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRS256(
    {
      iss: email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    pemKey
  );

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${assertion}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`OAuth error: ${json.error} — ${json.error_description}`));
          else resolve(json.access_token);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── 5. Consultar la Loyalty Class ─────────────────────────────────────────────
function getLoyaltyClass(accessToken, classId) {
  return new Promise((resolve, reject) => {
    https.get(
      {
        hostname: "walletobjects.googleapis.com",
        path: `/walletobjects/v1/loyaltyClass/${encodeURIComponent(classId)}`,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        );
      }
    ).on("error", reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID ?? "3388000000023126417";
  const classId  = `${issuerId}.club_patio_curauma`;
  const email    = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey   = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    console.error("❌ Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY en .env.local");
    process.exit(1);
  }

  console.log("\n──────────────────────────────────────");
  console.log("Consultando clase:", classId);
  console.log("Service account: ", email);
  console.log("──────────────────────────────────────\n");

  // Validar que la clave se puede parsear
  let pemKey;
  try {
    pemKey = parseKey(rawKey);
    crypto.createPrivateKey(pemKey); // lanza si el PEM es inválido
    console.log("✅ Private key parseada correctamente\n");
  } catch (e) {
    console.error("❌ La private key no se pudo parsear:", e.message);
    console.error("   Verifica que GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY en .env.local");
    console.error('   incluya los encabezados -----BEGIN PRIVATE KEY----- y -----END PRIVATE KEY-----');
    process.exit(1);
  }

  // Obtener access token
  let accessToken;
  try {
    console.log("🔑 Obteniendo access token...");
    accessToken = await getAccessToken(email, pemKey);
    console.log("✅ Access token obtenido\n");
  } catch (e) {
    console.error("❌ Error obteniendo access token:", e.message);
    console.error("   Posibles causas:");
    console.error("   - El service account no existe o fue desactivado");
    console.error("   - El clock del sistema está muy desfasado");
    process.exit(1);
  }

  // Consultar la clase
  const { status, body } = await getLoyaltyClass(accessToken, classId);

  if (status === 200) {
    console.log("✅ Clase encontrada\n");
    console.log("  id:           ", body.id);
    console.log("  programName:  ", body.programName);
    console.log("  reviewStatus: ", body.reviewStatus);
    console.log("  hexBgColor:   ", body.hexBackgroundColor);

    if (body.reviewStatus === "APPROVED" || body.reviewStatus === "UNDER_REVIEW") {
      console.log(`\n✅ reviewStatus "${body.reviewStatus}" — la clase acepta pases.`);
    } else {
      console.log(`\n⚠️  reviewStatus "${body.reviewStatus}" — Google rechaza pases en este estado.`);
    }
  } else if (status === 404) {
    console.error("❌ Clase NO encontrada (404)");
    console.error("   La clase", classId, "no existe bajo el Issuer ID", issuerId);
    console.error("   Verifica en https://pay.google.com/business/console");
  } else if (status === 403) {
    console.error("❌ Permiso denegado (403)");
    console.error("   El service account", email, "no tiene acceso al Issuer ID", issuerId);
    console.error("   Ve a Google Pay Business Console → Usuarios → agrega el email del service account");
  } else {
    console.error("❌ Error inesperado:", status);
    console.error(JSON.stringify(body, null, 2));
  }
}

main().catch((e) => {
  console.error("❌ Error fatal:", e.message);
  process.exit(1);
});
