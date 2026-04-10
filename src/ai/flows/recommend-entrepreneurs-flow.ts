
/**
 * @fileOverview Lógica de recomendaciones basada en el historial real del usuario.
 * Prioriza tiendas que el usuario NO ha visitado aún, y entre las visitadas
 * recomienda las que tienen más sellos acumulados (sus favoritas).
 */

import { ENTREPRENEURS } from '@/lib/data';

export type RecommendEntrepreneursInput = {
  browsingHistory: string[];
  inferredPreferences: string[];
  sellosLocales?: Record<string, number>; // { [vendorId]: sellosAcumulados }
};

export type RecommendedEntrepreneur = {
  entrepreneurName: string;
  category: string;
  recommendationReason: string;
};

export type RecommendEntrepreneursOutput = {
  recommendations: RecommendedEntrepreneur[];
};

export async function recommendEntrepreneurs(
  input: RecommendEntrepreneursInput
): Promise<RecommendEntrepreneursOutput> {
  await new Promise(resolve => setTimeout(resolve, 600));

  const sellosLocales = input.sellosLocales || {};
  const visitedIds = new Set(Object.keys(sellosLocales));

  // Separar en visitadas y no visitadas
  const noVisitadas = ENTREPRENEURS.filter(e => !visitedIds.has(e.id));
  const visitadas = ENTREPRENEURS.filter(e => visitedIds.has(e.id))
    .sort((a, b) => (sellosLocales[b.id] || 0) - (sellosLocales[a.id] || 0));

  const recommendations: RecommendedEntrepreneur[] = [];

  // Prioridad 1: tiendas no visitadas (hasta 2)
  const noVisitadasShuffled = [...noVisitadas].sort(() => 0.5 - Math.random());
  for (const e of noVisitadasShuffled.slice(0, 2)) {
    recommendations.push({
      entrepreneurName: e.name,
      category: e.category,
      recommendationReason: "¡Aún no la has visitado! Es un gran momento para sumar tu primer sello aquí.",
    });
  }

  // Prioridad 2: tienda favorita (la más visitada), si quedan espacios
  if (recommendations.length < 3 && visitadas.length > 0) {
    const favorita = visitadas[0];
    const sellos = sellosLocales[favorita.id] || 0;
    recommendations.push({
      entrepreneurName: favorita.name,
      category: favorita.category,
      recommendationReason: `Tu favorita con ${sellos} sello${sellos !== 1 ? "s" : ""}. ¡Vuelve a visitarla!`,
    });
  }

  // Rellenar con aleatorias si hay menos de 3
  if (recommendations.length < 3) {
    const restantes = ENTREPRENEURS.filter(
      e => !recommendations.some(r => r.entrepreneurName === e.name)
    ).sort(() => 0.5 - Math.random());
    for (const e of restantes.slice(0, 3 - recommendations.length)) {
      recommendations.push({
        entrepreneurName: e.name,
        category: e.category,
        recommendationReason: `Recomendado basado en tu interés por ${input.inferredPreferences[0] || "lo local"}.`,
      });
    }
  }

  return { recommendations: recommendations.slice(0, 3) };
}
