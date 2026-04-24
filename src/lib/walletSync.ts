/**
 * walletSync.ts
 * Sincronización fire-and-forget entre Firestore y Google Wallet.
 * Se llama desde el cliente justo después de que una escritura en Firestore
 * sea exitosa. No bloquea el flujo principal — un fallo aquí no afecta al sello.
 */

const WALLET_API_PATH = "/api/google-wallet";

/**
 * Envía un PATCH a nuestro endpoint /api/google-wallet con el nuevo total
 * de sellos del usuario. La tarjeta del usuario se actualiza en tiempo real
 * y Google envía una notificación push a su dispositivo.
 *
 * @param userId     - UID de Firebase (o email). Se sanitiza en el backend.
 * @param stampsCount - Nuevo total de sellos a reflejar en la tarjeta.
 */
export function syncUserStampsToWallet(userId: string, stampsCount: number): void {
  // Solo tiene sentido en el navegador (cliente)
  if (typeof window === "undefined") return;

  fetch(WALLET_API_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, stampsCount }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("[walletSync] PATCH no exitoso:", res.status, text);
      } else {
        console.log("[walletSync] ✅ Google Wallet actualizado →", stampsCount, "sellos para", userId);
      }
    })
    .catch((e) => {
      // No crítico: el sello ya está en Firestore aunque falle la sincronización
      console.warn("[walletSync] PATCH falló (no crítico):", e?.message ?? e);
    });
}
