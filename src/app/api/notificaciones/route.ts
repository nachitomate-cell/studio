
import { NextResponse } from 'next/server';

/**
 * API Route para simular el envío de notificaciones automáticas.
 * En producción, aquí se integraría con servicios como Twilio, SendGrid o Firebase Cloud Messaging.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, event, userName } = body;

    // Simulación de envío de mensaje
    console.log(`[NOTIFICACIÓN AUTOMÁTICA] Evento: ${event}`);
    console.log(`[DESTINATARIO] Usuario: ${userName || 'Usuario'} (${email})`);
    console.log(`[MENSAJE] "¡Hola! Has canjeado con éxito tu recompensa en Patio Curauma. ¡Disfrútala!"`);

    // Simulamos un pequeño retraso de red
    await new Promise(resolve => setTimeout(resolve, 500));

    return NextResponse.json({ 
      success: true, 
      message: 'Notificación procesada correctamente' 
    }, { status: 200 });

  } catch (error) {
    console.error('Error en API de Notificaciones:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error al procesar la notificación' 
    }, { status: 500 });
  }
}
