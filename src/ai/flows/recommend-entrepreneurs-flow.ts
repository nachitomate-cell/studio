
/**
 * @fileOverview Lógica de recomendaciones convertida a cliente para compatibilidad estática.
 * En modo exportación estática (Capacitor), no podemos usar 'use server'.
 */

import { ENTREPRENEURS } from '@/lib/data';

export type RecommendEntrepreneursInput = {
  browsingHistory: string[];
  inferredPreferences: string[];
};

export type RecommendedEntrepreneur = {
  entrepreneurName: string;
  category: string;
  recommendationReason: string;
};

export type RecommendEntrepreneursOutput = {
  recommendations: RecommendedEntrepreneur[];
};

/**
 * Función de recomendación simulada para el cliente.
 * En producción con Capacitor, las recomendaciones complejas de IA deberían 
 * consultarse a un servicio externo o Firebase Function.
 */
export async function recommendEntrepreneurs(
  input: RecommendEntrepreneursInput
): Promise<RecommendEntrepreneursOutput> {
  // Simulamos un pequeño retraso para mantener la experiencia de "pensado por IA"
  await new Promise(resolve => setTimeout(resolve, 800));

  // Seleccionamos 3 emprendedores al azar de nuestra base de datos local
  const shuffled = [...ENTREPRENEURS].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  return {
    recommendations: selected.map(e => ({
      entrepreneurName: e.name,
      category: e.category,
      recommendationReason: `Recomendado basado en tu interés por ${input.inferredPreferences[0] || 'lo local'}.`
    }))
  };
}
