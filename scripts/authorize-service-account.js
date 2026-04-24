/**
 * Autoriza el service account para Google Wallet API.
 *
 * Uso:
 *   node scripts/authorize-service-account.js "C:\ruta\al\client_secret.json"
 *
 * Requisitos previos:
 *   1. En Google Cloud Console → APIs & Services → Credenciales
 *   2. Crear OAuth 2.0 Client ID → tipo "Aplicación de escritorio"
 *   3. Descargar el JSON y pasar la ruta como argumento
 */

const https   = require("node:https");
const http    = require("node:http");
const fs      = require("node:fs");
const path    = require("node:path");
const crypto  = require("node:crypto");
const { exec } = require("node:child_process");

const ISSUER_ID       = "3388000000023126417";
const SERVICE_ACCOUNT = "wallet-service@barberiaferraza-edc26.iam.gserviceaccount.com";
const SCOPE           = "https://www.googleapis.com/auth/wallet_object.issuer";
const REDIRECT_PORT   = 9876;
const REDIRECT_URI    = `http://localhost:${REDIRECT_PORT}/callback`;

// ── Leer client secret ────────────────────────────────────────────────────────
const jsonArg = process.argv[2];
if (!jsonArg) {
  console.error("\n❌ Uso: node scripts/authorize-service-account.js <client_secret.json>");
  process.exit(1);
}

let credentials;
try {
  const raw = JSON.parse(fs.readFileSync(path.resolve(jsonArg), "utf8"));
  credentials = raw.installed ?? raw.web;
  if (!credentials?.client_id || !credentials?.client_secret) throw new Error("Formato inválido");
} catch (e) {
  console.error("❌ No se pudo leer el client secret JSON:", e.message);
  process.exit(1);
}

const { client_id, client_secret } = credentials;

// ── Utilidades ────────────────────────────────────────────────────────────────
function httpsRequest(method, hostname, urlPath, body, headers = {}) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: urlPath,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
          ...headers,
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
    if (data) req.write(data);
    req.end();
  });
}

function openBrowser(url) {
  // Windows
  exec(`start "" "${url}"`);
}

// ── Flujo OAuth ───────────────────────────────────────────────────────────────
function waitForAuthCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.end("<h2>Autorización denegada. Puedes cerrar esta ventana.</h2>");
        server.close();
        reject(new Error(`Autorización denegada: ${error}`));
        return;
      }

      if (code) {
        res.end(`
          <h2 style="font-family:sans-serif;color:#1a73e8">
            ✅ Autorización exitosa. Puedes cerrar esta ventana.
          </h2>
        `);
        server.close();
        resolve(code);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\n🌐 Servidor local escuchando en puerto ${REDIRECT_PORT}`);
    });

    server.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        reject(new Error(`El puerto ${REDIRECT_PORT} está ocupado. Cierra otras apps y reintenta.`));
      } else {
        reject(e);
      }
    });

    // Timeout de 5 minutos
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: no se recibió autorización en 5 minutos."));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString();

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
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => {
          const json = JSON.parse(out);
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

// ── Wallet Permissions API ────────────────────────────────────────────────────
async function getPermissions(token) {
  return httpsRequest("GET", "walletobjects.googleapis.com",
    `/walletobjects/v1/permissions/${ISSUER_ID}`, null,
    { Authorization: `Bearer ${token}` });
}

async function putPermissions(token, permissions) {
  return httpsRequest("PUT", "walletobjects.googleapis.com",
    `/walletobjects/v1/permissions/${ISSUER_ID}`, permissions,
    { Authorization: `Bearer ${token}` });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Autorizar Service Account — Google Wallet API  ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log("\n  Issuer ID:       ", ISSUER_ID);
  console.log("  Service account: ", SERVICE_ACCOUNT);

  // Construir URL de autorización
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  console.log("\n🌐 Abriendo el navegador para autorización...");
  console.log("   Inicia sesión con la cuenta Google que CREÓ el Issuer ID.\n");

  openBrowser(authUrl.toString());

  // Si el navegador no abre, mostrar la URL
  console.log("   Si el navegador no abre, copia esta URL:\n");
  console.log("  ", authUrl.toString(), "\n");

  // Esperar el callback
  const code = await waitForAuthCode();
  console.log("\n✅ Código de autorización recibido");

  // Intercambiar por token
  console.log("🔄 Obteniendo access token...");
  const accessToken = await exchangeCodeForToken(code);
  console.log("✅ Token obtenido\n");

  // Leer permisos actuales
  console.log("📋 Leyendo permisos actuales del Issuer...");
  const getRes = await getPermissions(accessToken);

  if (getRes.status === 403) {
    console.error("❌ La cuenta autorizada NO es administradora del Issuer ID", ISSUER_ID);
    console.error("   Usa la cuenta Google correcta (la que creó el Issuer).");
    process.exit(1);
  }
  if (getRes.status !== 200) {
    console.error("❌ Error:", getRes.status, JSON.stringify(getRes.body));
    process.exit(1);
  }

  const currentList = getRes.body.permissions ?? [];
  console.log(`   Permisos existentes: ${currentList.length}`);
  currentList.forEach((p) => console.log(`   • ${p.emailAddress} → ${p.role}`));

  // Verificar si ya existe
  const already = currentList.find((p) => p.emailAddress === SERVICE_ACCOUNT);
  if (already) {
    console.log(`\n✅ El service account ya tiene rol "${already.role}".`);
    console.log("   Espera 5 minutos y corre: node scripts/check-wallet-class.js");
    return;
  }

  // Agregar WRITER
  const newPermissions = {
    issuerId: ISSUER_ID,
    permissions: [...currentList, { emailAddress: SERVICE_ACCOUNT, role: "WRITER" }],
  };

  console.log("\n🔑 Otorgando rol WRITER...");
  const putRes = await putPermissions(accessToken, newPermissions);

  if (putRes.status === 200) {
    console.log("\n✅ ¡Permiso WRITER otorgado al service account!");
    console.log("   Espera 2-3 minutos y ejecuta:");
    console.log("   node scripts/check-wallet-class.js");
    console.log("\n   Luego prueba el botón 'Añadir' en Google Wallet.");
  } else {
    console.error("\n❌ Error al guardar permisos:", putRes.status);
    console.error(JSON.stringify(putRes.body, null, 2));
  }
}

main().catch((e) => {
  console.error("\n❌ Error:", e.message);
  process.exit(1);
});
