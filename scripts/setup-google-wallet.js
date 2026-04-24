/**
 * setup-google-wallet.js
 *
 * Crea la clase de fidelidad en Google Wallet.
 * Ejecutar UNA SOLA VEZ antes de generar passes:
 *
 *   node scripts/setup-google-wallet.js
 *
 * Requiere las variables de entorno en .env.local:
 *   GOOGLE_WALLET_ISSUER_ID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 */

// Cargar .env.local si existe
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
  console.log("✅ Variables cargadas desde .env.local");
}

const { GoogleAuth } = require("google-auth-library");

async function createLoyaltyClass() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!issuerId || !email || !privateKey) {
    console.error(
      "❌ Faltan variables de entorno. Verifica:\n" +
        "   GOOGLE_WALLET_ISSUER_ID\n" +
        "   GOOGLE_SERVICE_ACCOUNT_EMAIL\n" +
        "   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
    process.exit(1);
  }

  const auth = new GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });

  const client = await auth.getClient();
  const classId = `${issuerId}.club_patio_curauma`;

  const loyaltyClass = {
    id: classId,
    issuerName: "Patio Curauma",
    programName: "Club Patio Curauma",
    programLogo: {
      sourceUri: {
        uri: "https://club-patio-curauma.vercel.app/Logo3.png",
      },
      contentDescription: {
        defaultValue: { language: "es-CL", value: "Logo Club Patio Curauma" },
      },
    },
    rewardsTier: "gold",
    rewardsTierLabel: "Nivel",
    loyaltyPointsLabel: "Sellos",
    hexBackgroundColor: "#C9920A",
    reviewStatus: "UNDER_REVIEW",
    localizedIssuerName: {
      defaultValue: { language: "es-CL", value: "Patio Curauma" },
    },
    localizedProgramName: {
      defaultValue: { language: "es-CL", value: "Club Patio Curauma" },
    },
  };

  try {
    // Intentar crear
    const res = await client.request({
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",
      method: "POST",
      data: loyaltyClass,
    });
    console.log("✅ Clase creada exitosamente:", res.data.id);
  } catch (error) {
    if (error?.response?.status === 409) {
      console.log("ℹ️  La clase ya existe:", classId);
      console.log("   Puedes continuar — no es necesario volver a crearla.");
    } else {
      console.error("❌ Error al crear la clase:", error?.response?.data || error.message);
      process.exit(1);
    }
  }
}

createLoyaltyClass();
