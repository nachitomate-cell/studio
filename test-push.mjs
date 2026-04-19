/**
 * test-push.mjs
 *
 * Script de prueba para verificar que /api/send-notification funciona en producción.
 *
 * USO:
 *   node test-push.mjs <FCM_TOKEN>
 *
 * Cómo obtener el FCM token:
 *   1. Ve a Firebase Console → Firestore → colección "usuarios"
 *   2. Abre cualquier documento de usuario
 *   3. Copia el campo "fcmToken" (empieza con algo largo como f8J...)
 *
 * O desde la app (con el teléfono en la mano):
 *   1. Abre Club Patio en el teléfono
 *   2. Ve al perfil → activa notificaciones
 *   3. En las DevTools del teléfono o en Firestore verás el token guardado
 */

const BASE_URL = "https://club-patio-curauma.vercel.app";
const token = process.argv[2];

if (!token) {
  console.error("❌ Falta el FCM token.");
  console.error("   Uso: node test-push.mjs <FCM_TOKEN>");
  console.error("   Obtén el token desde: Firebase Console → Firestore → usuarios/{uid}.fcmToken");
  process.exit(1);
}

console.log("🚀 Enviando notificación de prueba a:", BASE_URL);
console.log("📱 Token (primeros 20 chars):", token.substring(0, 20) + "...");
console.log("");

async function testPush() {
  try {
    const response = await fetch(`${BASE_URL}/api/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        title: "🔔 Prueba Club Patio",
        body: "Si ves esto con el teléfono bloqueado, ¡funcionó! 🎉",
        url: "/",
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ ÉXITO — La API respondió correctamente.");
      console.log("   → Bloquea el teléfono y espera 5-10 segundos.");
      console.log("   → Deberías ver la notificación en la pantalla de bloqueo.");
    } else {
      console.error("❌ ERROR — La API falló:");
      console.error("   Status:", response.status);
      console.error("   Respuesta:", JSON.stringify(data, null, 2));
      console.error("");
      if (data.error?.includes("Firebase Admin")) {
        console.error("💡 CAUSA: Las variables FIREBASE_ADMIN_* no están en Vercel.");
        console.error("   → Ve a Vercel → Settings → Env Vars y agrégalas.");
        console.error("   → Luego haz Redeploy.");
      } else if (data.error?.includes("registration-token")) {
        console.error("💡 CAUSA: El token FCM es inválido o expiró.");
        console.error("   → Entra a la app en el teléfono, ve al perfil y reactiva notificaciones.");
      }
    }
  } catch (err) {
    console.error("❌ Error de red:", err.message);
  }
}

testPush();
