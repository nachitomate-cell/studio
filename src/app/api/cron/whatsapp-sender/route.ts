/**
 * GET /api/cron/whatsapp-sender — despachador de campañas WhatsApp.
 *
 * Corre cada 5 minutos (vercel.json) pero SOLO actúa dentro de la ventana
 * horaria; envía lotes chicos con pausa entre mensajes. Candados anti-ban
 * (doctrina SynapTech 2026-07-20):
 *   · ventana 11:00–20:00 hora Chile (doble candado: cron schedule + check acá)
 *   · tope duro CANDADOS.CAP_DIARIO mensajes/día (contador en wa_marketing/estado)
 *   · LOTE_POR_CICLO envíos por ejecución, con pausa 12–22 s entre ellos
 *   · jitter "escribiendo…" 3–8 s por mensaje (lado Evolution)
 *   · plantilla rotada por socio (variante asignada al crear la campaña)
 *   · pie de opt-out SIEMPRE presente; opt-outs de último minuto se respetan
 *
 * Protegido con CRON_SECRET (mismo patrón que los demás crons del proyecto).
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enviarTexto } from "@/lib/waEvolution";
import { CANDADOS, PIE_OPT_OUT, renderPlantilla } from "@/lib/waMarketing";

export const maxDuration = 60;   // el lote con pausas cabe holgado en 60 s

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function horaChile(): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago", hour: "numeric", hour12: false,
  }).format(new Date()));
}
function fechaChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Candado 1: ventana horaria Chile ──
  const hora = horaChile();
  if (hora < CANDADOS.VENTANA_INICIO || hora >= CANDADOS.VENTANA_FIN) {
    return NextResponse.json({ skip: "fuera de ventana horaria" });
  }

  // ── Candado 2: sesión conectada ──
  const estadoRef = adminDb.doc("wa_marketing/estado");
  const estado = (await estadoRef.get()).data() || {};
  if (estado.estadoConexion !== "connected") {
    return NextResponse.json({ skip: "sesión no conectada" });
  }

  // ── Candado 3: tope diario ──
  const hoy = fechaChile();
  let enviadosHoy = estado.contadorDia?.fecha === hoy ? (Number(estado.contadorDia.enviados) || 0) : 0;
  if (enviadosHoy >= CANDADOS.CAP_DIARIO) {
    return NextResponse.json({ skip: `tope diario alcanzado (${CANDADOS.CAP_DIARIO})` });
  }

  // ── Campaña activa más antigua ──
  const campSnap = await adminDb.collection("wa_campanas")
    .where("estado", "==", "activa").orderBy("creadaEn", "asc").limit(1).get();
  if (campSnap.empty) return NextResponse.json({ skip: "sin campañas activas" });

  const campRef = campSnap.docs[0].ref;
  const camp = campSnap.docs[0].data();
  const plantillas: string[] = camp.plantillas || [];

  const lote = Math.min(CANDADOS.LOTE_POR_CICLO, CANDADOS.CAP_DIARIO - enviadosHoy);
  const enviosSnap = await campRef.collection("envios")
    .where("estado", "==", "pendiente").limit(lote).get();

  // Sin pendientes → campaña completada.
  if (enviosSnap.empty) {
    await campRef.set({ estado: "completada", completadaEn: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true, campana: campRef.id, completada: true });
  }

  let enviados = 0, fallidos = 0, optouts = 0;
  const docs = enviosSnap.docs;
  for (let i = 0; i < docs.length; i++) {
    const envio = docs[i];
    const s = envio.data();
    try {
      // Opt-out de último minuto (respondió STOP después del snapshot).
      const optout = await adminDb.doc(`wa_optouts/${s.telefono}`).get();
      if (optout.exists) {
        await envio.ref.set({ estado: "optout" }, { merge: true });
        optouts++;
        continue;
      }

      const plantilla = plantillas[Number(s.variante) % plantillas.length] || plantillas[0];
      const mensaje = renderPlantilla(plantilla, { nombre: s.nombre, sellos: s.sellos }) + PIE_OPT_OUT;

      await enviarTexto(s.telefono, mensaje);
      await envio.ref.set({ estado: "enviado", enviadoEn: FieldValue.serverTimestamp() }, { merge: true });
      enviados++;
      enviadosHoy++;

      // Pausa humana entre mensajes del lote (menos tras el último).
      if (i < docs.length - 1) {
        await sleep(CANDADOS.PAUSA_MIN_MS + Math.random() * (CANDADOS.PAUSA_MAX_MS - CANDADOS.PAUSA_MIN_MS));
      }
    } catch (e) {
      console.error(`[wa-sender] ${campRef.id}/${envio.id}:`, e);
      await envio.ref.set({
        estado: "fallido",
        error: String((e as Error)?.message || e).slice(0, 200),
      }, { merge: true }).catch(() => {});
      fallidos++;
    }
  }

  await Promise.all([
    campRef.set({
      enviados: FieldValue.increment(enviados),
      fallidos: FieldValue.increment(fallidos),
    }, { merge: true }),
    estadoRef.set({ contadorDia: { fecha: hoy, enviados: enviadosHoy } }, { merge: true }),
  ]);

  return NextResponse.json({ ok: true, campana: campRef.id, enviados, fallidos, optouts, enviadosHoy });
}
