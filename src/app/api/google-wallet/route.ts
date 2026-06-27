import crypto from "node:crypto";
import { JWT } from "google-auth-library";

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? "3388000000023126417";
const CLASS_ID = `${ISSUER_ID}.club_patio_curauma`;

const WALLET_API_BASE = "https://walletobjects.googleapis.com/walletobjects/v1";
const WALLET_SCOPES = ["https://www.googleapis.com/auth/wallet_object.issuer"];

// ── Firma RS256 con crypto nativo ─────────────────────────────────────────────
function signRS256(payload: object, pemKey: string): string {
  const header = { alg: "RS256", typ: "JWT" };
  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = crypto
    .createSign("SHA256")
    .update(input)
    .sign(pemKey, "base64url");
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

// ── Cliente de service account para llamadas REST a la Wallet API ─────────────
function getServiceAccountClient(email: string, privateKey: string): JWT {
  return new JWT({
    email,
    key: privateKey,
    scopes: WALLET_SCOPES,
  });
}

// ── Obtiene access token OAuth2 desde el service account ─────────────────────
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const client = getServiceAccountClient(email, privateKey);
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("No se pudo obtener access token");
  return tokenResponse.token;
}

// ── Construcción del loyaltyObject ────────────────────────────────────────────
function buildLoyaltyObject(
  userId: string,
  userName: string,
  stampsCount: number
) {
  // @ y . → _ primero; luego eliminar cualquier carácter restante no válido.
  // Ejemplo: "ignaciiio.mate@gmail.com" → "ignaciiio_mate_gmail_com"
  const safeUserId = String(userId)
    .replace(/[@.]/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const objectId = `${ISSUER_ID}.user_${safeUserId}`;

  return {
    id: objectId,
    classId: CLASS_ID,
    state: "ACTIVE",

    accountId: String(userId),
    accountName: String(userName),

    // Etiqueta "PROGRESO" según diseño del frontend
    loyaltyPoints: {
      balance: { int: Number(stampsCount) || 0 },
      label: "PROGRESO",
    },

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

    // Hero image: terraza del patio (fondo consistente con el color #C9920A de la clase)
    heroImage: {
      sourceUri: {
        uri: "https://clubpatiocurauma.synaptechspa.cl/terraza-patio.png",
      },
      contentDescription: {
        defaultValue: {
          language: "es-CL",
          value: "Terraza Patio Curauma",
        },
      },
    },

    barcode: {
      type: "QR_CODE",
      value: String(userId),
      alternateText: String(userName),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/google-wallet — genera JWT "Save to Wallet" para el usuario
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    ?.replace(/^["']|["']$/g, "")
    .trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    return Response.json(
      { error: "Faltan credenciales de entorno" },
      { status: 500 }
    );
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

  const loyaltyObject = buildLoyaltyObject(userId, userName, stampsCount);
  const objectId = loyaltyObject.id;

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: email,
    aud: "google",
    origins: [],
    typ: "savetowallet",
    iat: now,
    exp: now + 3600,
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  };

  try {
    const privateKey = parsePrivateKey(rawKey);
    const token = signRS256(jwtPayload, privateKey);
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    console.log("[GoogleWallet POST] ✅ objectId:", objectId);
    console.log("[GoogleWallet POST]    classId: ", CLASS_ID);
    console.log("[GoogleWallet POST]    email:   ", email);

    return Response.json({ saveUrl, objectId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[GoogleWallet POST] ❌ Error firmando JWT:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/google-wallet — actualiza stampsCount en la tarjeta existente
// Body: { userId: string, stampsCount: number }
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    ?.replace(/^["']|["']$/g, "")
    .trim();
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    return Response.json(
      { error: "Faltan credenciales de entorno" },
      { status: 500 }
    );
  }

  let body: { userId?: string; stampsCount?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const { userId, stampsCount } = body;
  if (!userId) {
    return Response.json({ error: "userId requerido" }, { status: 400 });
  }
  if (typeof stampsCount !== "number") {
    return Response.json(
      { error: "stampsCount (number) requerido" },
      { status: 400 }
    );
  }

  const safeUserId = String(userId)
    .replace(/[@.]/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const objectId = `${ISSUER_ID}.user_${safeUserId}`;

  try {
    const privateKey = parsePrivateKey(rawKey);
    const accessToken = await getAccessToken(email, privateKey);

    // Actualizamos puntos + heroImage para que el diseño no se rompa al parchear.
    // Google Wallet PATCH es parcial: solo se sobreescriben los campos enviados.
    const patchBody = {
      loyaltyPoints: {
        balance: { int: Number(stampsCount) },
        label: "PROGRESO",
      },
      heroImage: {
        sourceUri: {
          uri: "https://clubpatiocurauma.synaptechspa.cl/terraza-patio.png",
        },
        contentDescription: {
          defaultValue: { language: "es-CL", value: "Terraza Patio Curauma" },
        },
      },
    };

    const res = await fetch(
      `${WALLET_API_BASE}/loyaltyObject/${encodeURIComponent(objectId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[GoogleWallet PATCH] ❌ API error:", res.status, errText);
      return Response.json(
        { error: `Google Wallet API error ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const updated = await res.json();
    console.log(
      "[GoogleWallet PATCH] ✅ Actualizado objectId:",
      objectId,
      "→ sellos:",
      stampsCount
    );

    return Response.json({
      success: true,
      objectId,
      stampsCount,
      updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[GoogleWallet PATCH] ❌ Error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
