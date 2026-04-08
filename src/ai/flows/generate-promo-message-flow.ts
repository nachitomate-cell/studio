/**
 * @fileOverview Flujo para generar mensajes de marketing personalizados con IA.
 *
 * IMPORTANTE: Sin 'use server' — este módulo es importado tanto desde
 * rutas API de Next.js (server-side) como desde el cron job de Cloud Functions.
 * Los tipos están en ./promo-types.ts para evitar la restricción de 'use server'.
 */

import { ai } from '@/ai/genkit';
import type { PromoInput, PromoOutput } from './promo-types';
import { PromoOutputSchema } from './promo-types';

// ── Lógica de contexto (construye el prompt según los datos del usuario) ───────

function buildPrompt(input: PromoInput): string {
  const { userName, stampsCount, lastVisitDays, ticketsSorteo, totalCanjes } = input;

  const sellosRestantes = 10 - (stampsCount % 10) || 10;
  const tieneTickets = (ticketsSorteo ?? 0) > 0;
  const esPrimerPremio = totalCanjes === 0;

  let contextoEspecial = '';
  if (lastVisitDays !== undefined && lastVisitDays >= 30) {
    contextoEspecial = `⚠️ CRÍTICO: Lleva ${lastVisitDays} días sin visitar. Mensaje de re-engagement urgente y cálido.`;
  } else if (lastVisitDays !== undefined && lastVisitDays >= 14) {
    contextoEspecial = `🕐 Lleva ${lastVisitDays} días sin visitar. Mensaje de "te echamos de menos".`;
  } else if (stampsCount === 0) {
    contextoEspecial = '🎁 Nunca ha acumulado sellos. El primer sello es de regalo al registrarse.';
  } else if (sellosRestantes === 1) {
    contextoEspecial = '🔥 MÁXIMA URGENCIA: le falta solo 1 sello para ganar su premio.';
  } else if (sellosRestantes <= 3) {
    contextoEspecial = `⚡ Alta urgencia: le faltan ${sellosRestantes} sellos para su próximo premio.`;
  } else if (tieneTickets) {
    contextoEspecial = `🎟️ Tiene ${ticketsSorteo} tickets de sorteo activos. Recuérdale que puede ganar algo grande.`;
  } else if (esPrimerPremio && stampsCount >= 10) {
    contextoEspecial = '🏆 Completó su primera tarjeta y nunca la ha canjeado. Motívale a canjear.';
  }

  return `Eres el community manager de Club Patio Curauma, un centro comercial en Valparaíso, Chile.
Escribe un mensaje de marketing personalizado y breve para motivar al cliente a volver.

DATOS:
- Nombre: ${userName}
- Sellos acumulados: ${stampsCount} / 10
- Le faltan para el próximo premio: ${sellosRestantes}
- Tickets de sorteo: ${ticketsSorteo ?? 0}
${contextoEspecial ? `\nCONTEXTO ESPECIAL:\n${contextoEspecial}` : ''}

REGLAS ESTRICTAS:
- title: máximo 40 caracteres, llamativo.
- message: máximo 150 caracteres, persuasivo y local.
- callToAction: máximo 20 caracteres (ej: "Ir a Club Patio").
- context: uno de: urgency, reengagement, welcome, celebration, reminder.
- Usa máximo 2 emojis. Tono cercano y local chileno.`;
}

// ── Función principal exportada ───────────────────────────────────────────────

export async function generatePromoMessage(input: PromoInput): Promise<PromoOutput> {
  const { output } = await ai.generate({
    prompt: buildPrompt(input),
    output: { schema: PromoOutputSchema },
  });

  if (!output) {
    // Fallback si la IA devuelve null (cuota agotada, timeout, etc.)
    return {
      title: '¡Te esperamos en Club Patio!',
      message: `Hola ${input.userName}! Tus sellos te esperan. ¡Ven hoy y acumula tu próximo premio! 🎁`,
      callToAction: 'Ver mis sellos',
      context: 'reminder',
    };
  }

  return output;
}
