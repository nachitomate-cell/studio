/**
 * @fileOverview Tipos e interfaces compartidos para el flujo de generación de mensajes.
 * Este archivo NO tiene 'use server' para poder exportar tipos/objetos libremente.
 */

import { z } from 'genkit';

export const PromoInputSchema = z.object({
  userName: z.string().describe('Nombre del socio'),
  stampsCount: z.number().describe('Sellos acumulados actualmente (0-10)'),
  ticketsSorteo: z.number().optional().describe('Tickets de sorteo disponibles'),
  lastVisitDays: z.number().optional().describe('Días transcurridos desde la última visita'),
  totalCanjes: z.number().optional().describe('Total de premios canjeados históricamente'),
});

export const PromoOutputSchema = z.object({
  title: z.string().describe('Título corto y llamativo, máximo 40 caracteres'),
  message: z.string().describe('Mensaje persuasivo y amigable, máximo 150 caracteres'),
  callToAction: z.string().describe('Texto breve para un botón (ej: "Ir a Club Patio")'),
  context: z
    .enum(['urgency', 'reengagement', 'welcome', 'celebration', 'reminder'])
    .describe('Categoría del mensaje generado'),
});

export type PromoInput = z.infer<typeof PromoInputSchema>;
export type PromoOutput = z.infer<typeof PromoOutputSchema>;
