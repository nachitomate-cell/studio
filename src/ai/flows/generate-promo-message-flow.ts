'use server';
/**
 * @fileOverview Flow para generar mensajes persuasivos de fidelización.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PromoInputSchema = z.object({
  userName: z.string(),
  stampsCount: z.number(),
  lastVisitDays: z.number().optional(),
});

const PromoOutputSchema = z.object({
  title: z.string().describe('Un título corto y llamativo'),
  message: z.string().describe('Un mensaje persuasivo de máximo 150 caracteres'),
  callToAction: z.string().describe('Texto corto para un botón'),
});

export type PromoInput = z.infer<typeof PromoInputSchema>;
export type PromoOutput = z.infer<typeof PromoOutputSchema>;

export async function generatePromoMessage(input: PromoInput): Promise<PromoOutput> {
  const { output } = await ai.generate({
    prompt: `Eres el community manager del Club Patio Curauma. 
    Tu objetivo es redactar un mensaje corto y amigable para que el cliente vuelva a comprar.
    
    Datos del cliente:
    - Nombre: ${input.userName}
    - Sellos actuales: ${input.stampsCount} / 10
    
    Instrucciones:
    - Si tiene pocos sellos (1-3), anímalo a empezar su colección.
    - Si tiene muchos (7-9), genera urgencia porque está a punto de ganar un premio.
    - Si tiene 0, recuérdale que el primer sello es de regalo.
    - Usa emojis y un tono muy local de Valparaíso/Curauma.`,
    output: { schema: PromoOutputSchema },
  });

  return output!;
}
