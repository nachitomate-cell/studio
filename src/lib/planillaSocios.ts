/**
 * Planilla de socios del Club (Excel de dos hojas). SOLO SERVIDOR: trae xlsx.
 *
 * Es la misma lógica que scripts/exportar-consentimiento.mjs — mismas columnas,
 * orden, anchos y hojas — para que la planilla que Pancho descarga desde
 * /moderador/reportes sea idéntica a la que se le mandaba a mano cada semana.
 * Si cambia una, cambia la otra.
 *
 * Hoja 1 "Autorizan correo": solo quienes tienen aceptaMarketing === true, sin
 * baneados, con correo válido y sin repetir. Es la única que se puede cargar en
 * la plataforma de correo masivo: incluir a alguien que no consintió es
 * justamente lo que la planilla debe poder descartar ante un reclamo.
 *
 * Hoja 2 "Base completa (NO enviar)": todos los socios, autoricen o no. Va
 * aparte, nunca mezclada con la primera, para que nadie arrastre por error a
 * quien no autorizó.
 */

import * as XLSX from "xlsx";

/** Lo mínimo de un QueryDocumentSnapshot que se usa: así sirve el del Admin SDK. */
export interface DocPlanilla {
  id: string;
  data(): Record<string, any>;
}

export interface ResumenPlanilla {
  totalRevisados: number;
  autorizanCorreo: number;
  baseCompleta: number;
  descartes: {
    sinConsentimiento: number;
    baneados: number;
    correoInvalido: number;
    duplicados: number;
  };
}

const soloFecha = (v: any): string => {
  if (!v) return "";
  const d = typeof v.toDate === "function" ? v.toDate() : new Date(v);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", dateStyle: "short" }).format(d);
};
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const si = (v: unknown) => (v === true ? "Sí" : "No");

const ANCHOS_AUTORIZAN = [
  { wch: 28 }, { wch: 34 }, { wch: 15 }, { wch: 18 }, { wch: 16 },
  { wch: 16 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 17 },
  { wch: 24 }, { wch: 17 }, { wch: 30 },
];
const ANCHOS_BASE_COMPLETA = [
  { wch: 28 }, { wch: 34 }, { wch: 15 }, { wch: 18 }, { wch: 16 },
  { wch: 18 }, { wch: 26 }, { wch: 14 }, { wch: 22 }, { wch: 17 },
  { wch: 17 }, { wch: 12 }, { wch: 30 },
];

export const HOJA_AUTORIZAN = "Autorizan correo";
export const HOJA_BASE_COMPLETA = "Base completa (NO enviar)";

/**
 * Arma el libro a partir de `usuarios` y `leads_marketing` (docs completos).
 * No toca Firestore: quien llama hace las lecturas.
 */
export function armarPlanillaSocios(
  usuarios: readonly DocPlanilla[],
  leads: readonly DocPlanilla[],
): { libro: XLSX.WorkBook; resumen: ResumenPlanilla } {
  // leads_marketing guarda de dónde vino cada registro; sirve como respaldo del origen.
  const porUid = new Map(leads.map((d) => [d.id, d.data()]));

  const filas: Record<string, string | number>[] = [];
  /** Base completa: todos los socios, autoricen o no. Va en una hoja aparte. */
  const todos: Record<string, string | number>[] = [];
  const descartes = { sinConsentimiento: 0, baneados: 0, correoInvalido: 0, duplicados: 0 };
  const vistos = new Set<string>();

  for (const d of usuarios) {
    const x = d.data();

    if (x.rol === "emprendedor") continue;

    const correoBase = String(x.correo ?? x.email ?? "").trim().toLowerCase();
    const leadBase = porUid.get(d.id) ?? {};
    todos.push({
      "Nombre": String(x.nombre ?? "").trim(),
      "Correo": correoBase,
      "Teléfono": String(x.telefono ?? "").trim(),
      "Comuna": String(x.comuna ?? "").trim(),
      "Fecha nacimiento": soloFecha(x.fechaNacimiento),
      "¿Autoriza correo?": si(x.aceptaMarketing),
      "¿Autoriza promos de locales?": si(x.aceptaPromoLocales),
      "¿Push activo?": si(!!x.fcmToken),
      "Fecha de consentimiento": soloFecha(x.fechaConsentimiento ?? leadBase.fechaRegistro ?? x.createdAt),
      "Fecha de registro": soloFecha(x.createdAt),
      "Sellos acumulados": Number(x.comprasRealizadas ?? 0),
      "Estado": x.baneado === true ? "Bloqueado" : "Activo",
      "ID socio": d.id,
    });

    if (x.aceptaMarketing !== true) { descartes.sinConsentimiento++; continue; }
    if (x.baneado === true) { descartes.baneados++; continue; }

    const correo = correoBase;
    if (!CORREO_OK.test(correo)) { descartes.correoInvalido++; continue; }
    if (vistos.has(correo)) { descartes.duplicados++; continue; }
    vistos.add(correo);

    const lead = porUid.get(d.id) ?? {};
    const consentimiento = soloFecha(x.fechaConsentimiento ?? lead.fechaRegistro ?? x.createdAt);

    filas.push({
      "Nombre": String(x.nombre ?? "").trim(),
      "Correo": correo,
      "Teléfono": String(x.telefono ?? "").trim(),
      "Comuna": String(x.comuna ?? "").trim(),
      "Fecha nacimiento": soloFecha(x.fechaNacimiento),
      "Acepta marketing": si(x.aceptaMarketing),
      "Acepta promos de locales": si(x.aceptaPromoLocales),
      // fcmToken presente = el socio autorizó las notificaciones en su teléfono
      // y el dispositivo sigue registrado. Es el único canal que llega sin abrir la app.
      "Push activo en el teléfono": si(!!x.fcmToken),
      "Fecha de consentimiento": consentimiento,
      "Fecha de registro": soloFecha(x.createdAt),
      "Origen del registro": String(lead.fuente ?? x.campanaRegistro ?? "App Club Patio").trim(),
      "Sellos acumulados": Number(x.comprasRealizadas ?? 0),
      "ID socio": d.id,
    });
  }

  // Del más reciente al más antiguo: los últimos en inscribirse son los que la
  // plataforma de correo va a querer revisar primero.
  filas.sort((a, b) => String(b["Fecha de consentimiento"]).localeCompare(String(a["Fecha de consentimiento"])));

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja["!cols"] = ANCHOS_AUTORIZAN;
  // Con cero filas json_to_sheet no deja "!ref" y decode_range revienta.
  if (hoja["!ref"]) {
    hoja["!autofilter"] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(hoja["!ref"])) };
  }

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, HOJA_AUTORIZAN);

  todos.sort((a, b) => String(b["Fecha de registro"]).localeCompare(String(a["Fecha de registro"])));
  const hojaTodos = XLSX.utils.json_to_sheet(todos);
  hojaTodos["!cols"] = ANCHOS_BASE_COMPLETA;
  if (hojaTodos["!ref"]) {
    hojaTodos["!autofilter"] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(hojaTodos["!ref"])) };
  }
  XLSX.utils.book_append_sheet(libro, hojaTodos, HOJA_BASE_COMPLETA);

  return {
    libro,
    resumen: {
      totalRevisados: usuarios.length,
      autorizanCorreo: filas.length,
      baseCompleta: todos.length,
      descartes,
    },
  };
}

/** Igual que armarPlanillaSocios, pero devuelve el .xlsx listo para mandar. */
export function planillaSociosBuffer(
  usuarios: readonly DocPlanilla[],
  leads: readonly DocPlanilla[],
): { buffer: Buffer; resumen: ResumenPlanilla } {
  const { libro, resumen } = armarPlanillaSocios(usuarios, leads);
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, resumen };
}
