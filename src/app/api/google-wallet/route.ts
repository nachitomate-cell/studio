import crypto from "node:crypto";

const ISSUER_ID =
  process.env.GOOGLE_WALLET_ISSUER_ID ?? "3388000000023126417";
const CLASS_ID = `${ISSUER_ID}.club_patio_curauma`;

// ── Firma RS256 con crypto nativo (compatible con claves PKCS#8 de Google) ────
function signRS256(payload: object, pemKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = crypto.createSign("SHA256").update(input).sign(pemKey, "base64url");
  return `${input}.${sig}`;
}

// ── Parseo robusto de private key ─────────────────────────────────────────────
function parsePrivateKey(raw: string): string {
  let key = raw.replace(/^["']|["']$/g, "").trim();
  key = key.replace(/\\n/g, "\n");
  if (!key.includes("-----BEGIN")) {
    const body = key.replace(/\s/g, "");
    key = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  }
  return key;
}

export async function POST(request: Request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    ?.replace(/^["']|["']$/g, "")
    .trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    return Response.json({ error: "Faltan credenciales de entorno" }, { status: 500 });
  }

  let body: { userId?: string; userName?: string; stampsCount?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { userId, userName = "Miembro", stampsCount = 0 } = body;
  if (!userId) {
    return Response.json({ error: "userId requerido" }, { status: 400 });
  }

  // Solo caracteres válidos para IDs de Google Wallet
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9._-]/g, "_");

  // ID único por petición para evitar colisiones con objetos fallidos anteriores
  const objectId = `${ISSUER_ID}.user_${safeUserId}_${Date.now()}`;

  // ── LoyaltyObject con todos los campos requeridos para el guardado físico ───
  const loyaltyObject = {
    id: objectId,
    classId: CLASS_ID,
    state: "ACTIVE",

    // Identidad del titular — requeridos para el guardado, no solo la preview
    accountId: String(userId),
    accountName: String(userName),

    // Sellos
    loyaltyPoints: {
      balance: { int: Number(stampsCount) || 0 },
      label: "Sellos",
    },

    // Textos de la tarjeta
    textModulesData: [
      {
        header: "Club Patio Curauma",
        body: "Av. Lomas de la Luz 4650, Curauma, Valparaíso",
      },
      {
        header: "Beneficio",
        body: "Acumula 10 sellos y canjea premios exclusivos",
      },
    ],

    // URL HTTPS absoluta y pública — Google la descarga en el momento del guardado
    heroImage: {
      sourceUri: {
        uri: "https://club-patio-curauma.vercel.app/Logo3.png",
      },
      contentDescription: {
        defaultValue: {
          language: "es-CL",
          value: "Logo Club Patio Curauma",
        },
      },
    },

    // QR con el UID del usuario
    barcode: {
      type: "QR_CODE",
      value: String(userId),
      alternateText: String(userName),
    },
  };

  // ── JWT payload ───────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: email,
    aud: "google",
    origins: [],          // vacío para aceptar cualquier origen (incluido localhost)
    typ: "savetowallet",
    iat: now,
    exp: now + 3600,      // expira en 1 hora — evita tokens stale
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  };

  try {
    const privateKey = parsePrivateKey(rawKey);
    const token = signRS256(jwtPayload, privateKey);
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    console.log("[GoogleWallet] ✅ objectId:", objectId);
    console.log("[GoogleWallet]    classId: ", CLASS_ID);
    console.log("[GoogleWallet]    email:   ", email);

    return Response.json({ saveUrl, objectId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[GoogleWallet] ❌ Error firmando JWT:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
