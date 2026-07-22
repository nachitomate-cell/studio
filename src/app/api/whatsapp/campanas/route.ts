/**
 * /api/whatsapp/campanas — campañas de marketing WhatsApp (moderador).
 *
 *   GET   → lista campañas con progreso
 *   POST  → crea campaña; con { dryRun: true } solo devuelve el tamaño de la
 *           audiencia (preview antes de comprometer nada)
 *   PATCH → { id, accion: 'pausar' | 'reanudar' | 'cancelar' }
 *
 * La audiencia se congela AL CREAR (snapshot en subcolección envios/): así el
 * progreso es auditable y un socio nuevo no entra a una campaña vieja.
 * Elegibilidad: teléfono chileno válido + sin opt-out + rol socio + segmento.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { verificarModerador } from "@/lib/waModAuth";
import {
  CANDADOS, SEGMENTOS, SEGMENTO_EXCEL, MAX_LISTA_EXCEL, enSegmento, normalizarTelefono,
  type SegmentoId,
} from "@/lib/waMarketing";

const ROLES_NO_SOCIO = new Set(["emprendedor", "moderador", "director", "director_patio", "admin"]);

/** Audiencia elegible para un segmento. Devuelve [{uid, nombre, telefono, sellos}]. */
async function calcularAudiencia(segmento: SegmentoId) {
  const [usuariosSnap, optoutsSnap] = await Promise.all([
    adminDb.collection("usuarios").get(),
    adminDb.collection("wa_optouts").get(),
  ]);
  const optouts = new Set(optoutsSnap.docs.map(d => d.id));

  const audiencia: { uid: string; nombre: string; telefono: string; sellos: number }[] = [];
  const vistos = new Set<string>();   // dedup por teléfono (cuentas duplicadas)
  usuariosSnap.forEach(doc => {
    const d = doc.data();
    const roles: string[] = Array.isArray(d.roles) ? d.roles : [d.rol].filter(Boolean);
    if (roles.some(r => ROLES_NO_SOCIO.has(String(r)))) return;
    const tel = normalizarTelefono(d.telefono);
    if (!tel || optouts.has(tel) || vistos.has(tel)) return;
    const sellos = Number(d.sellos) || 0;
    if (!enSegmento(segmento, sellos)) return;
    vistos.add(tel);
    audiencia.push({ uid: doc.id, nombre: String(d.nombre || "").trim() || "socio", telefono: tel, sellos });
  });
  return audiencia;
}

/**
 * Audiencia desde una lista Excel/CSV subida por el moderador.
 * MISMOS candados que los segmentos: teléfono chileno normalizado, sin
 * opt-outs, dedup. Si el teléfono corresponde a un socio, se usan sus sellos
 * reales (y su nombre como fallback) para que {sellos}/{faltan} rendericen bien.
 */
async function audienciaDesdeLista(clientes: { nombre?: unknown; telefono?: unknown }[]) {
  const [usuariosSnap, optoutsSnap] = await Promise.all([
    adminDb.collection("usuarios").get(),
    adminDb.collection("wa_optouts").get(),
  ]);
  const optouts = new Set(optoutsSnap.docs.map(d => d.id));
  const socioPorTel = new Map<string, { nombre: string; sellos: number }>();
  usuariosSnap.forEach(doc => {
    const d = doc.data();
    const tel = normalizarTelefono(d.telefono);
    if (tel && !socioPorTel.has(tel)) {
      socioPorTel.set(tel, { nombre: String(d.nombre || "").trim(), sellos: Number(d.sellos) || 0 });
    }
  });

  const audiencia: { uid: string; nombre: string; telefono: string; sellos: number }[] = [];
  const vistos = new Set<string>();
  let descartados = 0;
  for (const c of clientes.slice(0, MAX_LISTA_EXCEL)) {
    const tel = normalizarTelefono(String(c?.telefono ?? ""));
    if (!tel || optouts.has(tel) || vistos.has(tel)) { descartados++; continue; }
    const socio = socioPorTel.get(tel);
    const nombre = String(c?.nombre ?? "").trim() || socio?.nombre || "socio";
    vistos.add(tel);
    // uid = teléfono: la lista externa no tiene uid de Firebase y el docId de
    // envios/ solo necesita ser único dentro de la campaña.
    audiencia.push({ uid: tel, nombre, telefono: tel, sellos: socio?.sellos || 0 });
  }
  descartados += Math.max(0, clientes.length - MAX_LISTA_EXCEL);
  return { audiencia, descartados };
}

export async function GET(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const snap = await adminDb.collection("wa_campanas").orderBy("creadaEn", "desc").limit(25).get();
  const campanas = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      nombre: x.nombre,
      segmento: x.segmento,
      estado: x.estado,
      total: x.total || 0,
      enviados: x.enviados || 0,
      fallidos: x.fallidos || 0,
      optouts: x.optouts || 0,
      creadaEn: x.creadaEn?.toDate?.()?.toISOString() || null,
    };
  });

  const estadoDoc = (await adminDb.doc("wa_marketing/estado").get()).data() || {};
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const contador = estadoDoc.contadorDia?.fecha === hoy ? (estadoDoc.contadorDia.enviados || 0) : 0;

  return NextResponse.json({
    campanas,
    conexion: estadoDoc.estadoConexion || "disconnected",
    enviadosHoy: contador,
    capDiario: CANDADOS.CAP_DIARIO,
  });
}

export async function POST(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const segmento = String(body.segmento || "todos") as SegmentoId;
  const esExcel = segmento === SEGMENTO_EXCEL.id;
  if (!esExcel && !SEGMENTOS.some(s => s.id === segmento)) {
    return NextResponse.json({ error: "Segmento inválido" }, { status: 400 });
  }

  let audiencia: { uid: string; nombre: string; telefono: string; sellos: number }[];
  let descartados = 0;
  if (esExcel) {
    const clientes = Array.isArray(body.clientes) ? body.clientes : [];
    if (!clientes.length) return NextResponse.json({ error: "La lista Excel llegó vacía." }, { status: 400 });
    ({ audiencia, descartados } = await audienciaDesdeLista(clientes));
  } else {
    audiencia = await calcularAudiencia(segmento);
  }

  // Preview: solo el tamaño, sin crear nada.
  if (body.dryRun === true) {
    return NextResponse.json({ audiencia: audiencia.length, descartados });
  }

  const nombre = String(body.nombre || "").trim().slice(0, 80);
  const plantillas: string[] = (Array.isArray(body.plantillas) ? body.plantillas : [])
    .map((p: unknown) => String(p || "").trim())
    .filter(Boolean)
    .slice(0, CANDADOS.MAX_PLANTILLAS);

  if (!nombre) return NextResponse.json({ error: "Ponle nombre a la campaña." }, { status: 400 });
  if (!plantillas.length) return NextResponse.json({ error: "Escribe al menos una plantilla." }, { status: 400 });
  if (!audiencia.length) return NextResponse.json({ error: "La audiencia de ese segmento está vacía." }, { status: 400 });

  const ref = adminDb.collection("wa_campanas").doc();
  await ref.set({
    nombre,
    segmento,
    plantillas,
    estado: "activa",
    total: audiencia.length,
    enviados: 0,
    fallidos: 0,
    creadaEn: FieldValue.serverTimestamp(),
    creadaPor: auth.email,
  });

  // Snapshot de la audiencia (batches de 400 por el límite de 500 writes).
  for (let i = 0; i < audiencia.length; i += 400) {
    const batch = adminDb.batch();
    for (const socio of audiencia.slice(i, i + 400)) {
      batch.set(ref.collection("envios").doc(socio.uid), {
        ...socio,
        estado: "pendiente",
        variante: Math.floor(Math.random() * plantillas.length),
      });
    }
    await batch.commit();
  }

  return NextResponse.json({ ok: true, id: ref.id, audiencia: audiencia.length });
}

export async function PATCH(request: Request) {
  const auth = await verificarModerador(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const accion = String(body.accion || "");
  if (!id || !["pausar", "reanudar", "cancelar"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  const estado = accion === "pausar" ? "pausada" : accion === "reanudar" ? "activa" : "completada";
  await adminDb.doc(`wa_campanas/${id}`).set({ estado, actualizadaPor: auth.email }, { merge: true });
  return NextResponse.json({ ok: true, estado });
}
