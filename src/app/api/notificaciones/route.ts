
/**
 * ARCHIVO DESACTIVADO PERMANENTEMENTE
 * Las API Routes no son compatibles con 'output: export' para Capacitor/App Nativa.
 * Toda la lógica de notificaciones se ha movido a src/lib/notificaciones.ts
 * Este archivo se mantiene vacío para evitar errores de compilación, pero debe eliminarse.
 */
export const dynamic = 'force-static';

export async function GET() {
  return new Response(JSON.stringify({ error: "API Routes are disabled in static export mode. Use Firebase Client SDK." }), { 
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
