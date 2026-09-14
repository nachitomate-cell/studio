/**
 * fiestasPatrias.ts — ventana de la decoración dieciochera.
 *
 * POR QUÉ SE APAGA SOLA: con La Polla del Mundial hubo que acordarse de
 * retirarla a mano cuando terminó el torneo, y quedó puesta de más. Acá la
 * fecha manda: el 23 de septiembre el inicio vuelve a su aspecto normal sin
 * que nadie tenga que hacer nada ni desplegar otra vez.
 *
 * La fecha se resuelve siempre en horario de Chile, no en el del dispositivo
 * ni en el del servidor. Así el servidor y el navegador coinciden y React no
 * reclama por diferencias al hidratar.
 */

/** Día en que aparece la decoración (mes, día). */
const INICIO = { mes: 9, dia: 10 };
/** Último día en que se muestra, inclusive. */
const FIN = { mes: 9, dia: 22 };

function fechaEnChile(cuando: Date): { mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(cuando);
  const leer = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return { mes: leer("month"), dia: leer("day") };
}

/** True mientras corre la temporada dieciochera. */
export function esTemporadaPatria(cuando: Date = new Date()): boolean {
  const { mes, dia } = fechaEnChile(cuando);
  const actual = mes * 100 + dia;
  return actual >= INICIO.mes * 100 + INICIO.dia && actual <= FIN.mes * 100 + FIN.dia;
}

/** Los tres colores de la bandera, para no repetirlos por todos lados. */
export const COLORES_PATRIOS = {
  rojo: "#D52B1E",
  azul: "#0B3E8F",
  blanco: "#FFFFFF",
} as const;

/**
 * Saludo según el día: antes del 18 invita, durante celebra y después
 * despide. Evita que el 21 siga diciendo "se viene el 18".
 */
export function saludoPatrio(cuando: Date = new Date()): { titulo: string; bajada: string } {
  const { dia } = fechaEnChile(cuando);
  if (dia < 18) {
    return {
      titulo: "Se vienen las Fiestas Patrias",
      bajada: "Celebra el 18 en el Patio",
    };
  }
  if (dia <= 19) {
    return {
      titulo: "¡Felices Fiestas Patrias!",
      bajada: "18 y 19 de septiembre",
    };
  }
  return {
    titulo: "Sigue la celebración",
    bajada: "El Patio te espera este fin de semana",
  };
}
