
/**
 * Archivo neutralizado. 
 * Las API Routes no son compatibles con 'output: export' para Capacitor.
 * La lógica de notificaciones ahora se maneja directamente en el cliente o mediante Firebase Cloud Messaging.
 */
export async function GET() {
  return new Response(JSON.stringify({ message: "API desactivada para build estático" }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
