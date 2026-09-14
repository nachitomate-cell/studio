/**
 * fiestasPatrias.ts — ventana y datos de la feria dieciochera.
 *
 * Los datos salen del aviso que publicó Patio Curauma: la feria corre del 14
 * al 17 de septiembre, de 10:00 a 21:00, en Tottus Curauma. Ojo que termina
 * ANTES del 18, así que el inicio no puede quedar invitando "al 18" cuando la
 * feria ya cerró.
 *
 * POR QUÉ SE APAGA SOLA: con La Polla del Mundial hubo que acordarse de
 * retirarla a mano y quedó puesta de más. Acá la fecha manda: el 23 de
 * septiembre el inicio vuelve a su aspecto normal sin desplegar nada.
 *
 * La fecha se resuelve siempre en horario de Chile, no en el del dispositivo
 * ni en el del servidor, para que servidor y navegador coincidan al hidratar.
 */

/** Día en que aparece la decoración. */
const INICIO = { mes: 9, dia: 10 };
/** Último día en que se muestra, inclusive. */
const FIN = { mes: 9, dia: 22 };

/** La feria tal como la anunció Patio Curauma. */
export const FERIA = {
  desde: 14,
  hasta: 17,
  horario: "10:00 a 21:00",
  lugar: "Tottus Curauma",
} as const;

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

/** True solo durante los días de feria, que es cuando conviene mostrar horario y lugar. */
export function feriaEnCurso(cuando: Date = new Date()): boolean {
  const { mes, dia } = fechaEnChile(cuando);
  return mes === 9 && dia >= FERIA.desde && dia <= FERIA.hasta;
}

export type SaludoPatrio = {
  /** Titular grande. */
  titulo: string;
  /** Remate del titular, en rojo. */
  acento: string;
  /** Línea de apoyo. */
  bajada: string;
  /** Si mostrar el bloque con fechas, horario y lugar. */
  mostrarFeria: boolean;
};

/**
 * El mensaje sigue el calendario real de la feria: antes invita, durante
 * empuja a venir hoy, y una vez cerrada deja de prometer algo que ya no está.
 */
export function saludoPatrio(cuando: Date = new Date()): SaludoPatrio {
  const { dia } = fechaEnChile(cuando);

  if (dia < FERIA.desde) {
    return {
      titulo: "Celebra Fiestas Patrias",
      acento: "con el corazón chileno",
      bajada: `Del ${FERIA.desde} al ${FERIA.hasta} de septiembre`,
      mostrarFeria: true,
    };
  }

  if (dia <= FERIA.hasta) {
    const ultimo = dia === FERIA.hasta;
    return {
      titulo: "Celebra Fiestas Patrias",
      acento: "con el corazón chileno",
      bajada: ultimo ? "Último día de la feria" : "Te esperamos hoy",
      mostrarFeria: true,
    };
  }

  if (dia <= 19) {
    return {
      titulo: "¡Felices Fiestas Patrias!",
      acento: "18 y 19 de septiembre",
      bajada: "Que lo pases bien con los tuyos",
      mostrarFeria: false,
    };
  }

  return {
    titulo: "Sigue la celebración",
    acento: "en el Patio",
    bajada: "Te esperamos este fin de semana",
    mostrarFeria: false,
  };
}

/** Los tres colores de la bandera, para no repetirlos por todos lados. */
export const COLORES_PATRIOS = {
  rojo: "#D52B1E",
  azul: "#0B3E8F",
  blanco: "#FFFFFF",
} as const;
