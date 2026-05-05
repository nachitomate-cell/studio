export type DiaSemana = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
export interface HorarioDia { open: string; close: string; cerrado: boolean; }
export type HorariosEstructurados = Partial<Record<DiaSemana, HorarioDia>>;

const DIAS_ORDER: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
export const DIAS_LABEL: Record<DiaSemana, string> = {
  lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves",
  vie: "Viernes", sab: "Sábado", dom: "Domingo",
};
export const DIAS_SHORT: Record<DiaSemana, string> = {
  lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue",
  vie: "Vie", sab: "Sáb", dom: "Dom",
};
export const DIAS_SEMANA: DiaSemana[] = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];

function getChileTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
}

export function isOpenNow(horarios: HorariosEstructurados | null | undefined): boolean | null {
  if (!horarios || Object.keys(horarios).length === 0) return null;
  const chile = getChileTime();
  const dia = DIAS_ORDER[chile.getDay()];
  const h = horarios[dia];
  if (!h) return null;
  if (h.cerrado) return false;
  if (!h.open || !h.close) return null;
  const [oh, om] = h.open.split(":").map(Number);
  const [ch, cm] = h.close.split(":").map(Number);
  const nowMin = chile.getHours() * 60 + chile.getMinutes();
  return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
}

export function getOpenStatus(horarios: HorariosEstructurados | null | undefined): {
  isOpen: boolean | null; label: string; color: "green" | "red" | "yellow" | "gray";
} {
  const open = isOpenNow(horarios);
  if (open === null) return { isOpen: null, label: "Horario no disponible", color: "gray" };
  if (open) {
    const chile = getChileTime();
    const dia = DIAS_ORDER[chile.getDay()];
    const h = horarios![dia];
    const closeMin = h?.close ? (() => { const [c,m]=h.close.split(":").map(Number); return c*60+m; })() : null;
    const nowMin = chile.getHours()*60+chile.getMinutes();
    if (closeMin && closeMin - nowMin <= 60) {
      return { isOpen: true, label: `Cierra a las ${h!.close}`, color: "yellow" };
    }
    return { isOpen: true, label: h?.close ? `Abierto · Cierra ${h.close}` : "Abierto", color: "green" };
  }
  const chile = getChileTime();
  const today = chile.getDay();
  for (let i = 1; i <= 7; i++) {
    const idx = (today + i) % 7;
    const dia = DIAS_ORDER[idx];
    const h = horarios![dia];
    if (h && !h.cerrado && h.open) {
      const label = i === 1 ? `Abre mañana ${h.open}` : `Abre ${DIAS_SHORT[dia]} ${h.open}`;
      return { isOpen: false, label, color: "red" };
    }
  }
  return { isOpen: false, label: "Cerrado", color: "red" };
}
