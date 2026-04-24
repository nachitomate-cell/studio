import { GoogleAuth } from "google-auth-library";

const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;

export async function PATCH(request: Request) {
  try {
    if (
      !issuerId ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      return Response.json(
        { error: "Google Wallet not configured" },
        { status: 500 }
      );
    }

    const { userId, stampsCount } = await request.json();

    if (!userId) {
      return Response.json({ error: "userId required" }, { status: 400 });
    }

    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        ),
      },
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    const client = await auth.getClient();

    const safeUserId = userId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectId = `${issuerId}.${safeUserId}`;

    await client.request({
      url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
      method: "PATCH",
      data: {
        loyaltyPoints: {
          balance: { int: stampsCount || 0 },
          label: "Sellos",
        },
      },
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    // 404 = el usuario aún no agregó la tarjeta a su Wallet, no es un error real
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      return Response.json({ success: true, note: "object_not_found" });
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Google Wallet update error:", error);
    return Response.json({ error: msg }, { status: 500 });
  }
}
