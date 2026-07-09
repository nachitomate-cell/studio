/**
 * POST /api/mundial/resolver
 *
 * Solo staff (moderador/admin/director). Registra el marcador final de un
 * partido y reparte los sellos según los pronósticos:
 *   - 2 sellos: marcador exacto (golesA y golesB coinciden).
 *   - 1 sello:  acertó al ganador (o al empate) pero no el marcador exacto.
 *   - 0 sellos: no acertó.
 *
 * Marca cada pronóstico como `resuelto: true` con `sellosGanados` para evitar
 * dobles pagos si el endpoint se re-ejecuta por accidente. Usa batches de
 * hasta 400 operaciones por commit (< 500 del límite de Firestore).
 *
 * Headers: Authorization: Bearer <idToken>
 * Body:    { partidoId: string, golesA: number, golesB: number }
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { Message } from "firebase-admin/messaging";
import { ADMIN_EMAIL, ALLOWED_MOD_EMAILS } from "@/lib/constants";

const ROLES_PERMITIDOS = ["admin", "director", "director_patio", "moderador"];
const BATCH_MAX = 400;

function normalizarGoles(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > 30) return null;
  return n;
}

// Economía del torneo:
//   - Acierto exacto (marcador idéntico): 8 sellos
//   - Acierto parcial (mismo ganador o empate, marcador distinto): 3 sellos
//   - Fallo: 0
function calcularSellos(
  predA: number,
  predB: number,
  realA: number,
  realB: number,
): number {
  if (predA === realA && predB === realB) return 8;
  const ganadorReal = realA === realB ? 0 : realA > realB ? 1 : -1;
  const ganadorPred = predA === predB ? 0 : predA > predB ? 1 : -1;
  if (ganadorReal === ganadorPred) return 3;
  return 0;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Autorización de staff (mismo patrón que /api/moderador/*)
    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRol: string = callerData?.rol ?? "";
    const callerRoles: string[] = Array.isArray(callerData?.roles) ? callerData!.roles : [];
    const callerEmail = (decoded.email ?? "").trim().toLowerCase();

    const hasPermission =
      ROLES_PERMITIDOS.includes(callerRol) ||
      callerRoles.some((r) => ROLES_PERMITIDOS.includes(r)) ||
      callerEmail === ADMIN_EMAIL ||
      ALLOWED_MOD_EMAILS.includes(callerEmail);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "No tienes permisos de moderador." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const partidoId: string = (body?.partidoId ?? "").toString().trim();
    const golesA = normalizarGoles(body?.golesA);
    const golesB = normalizarGoles(body?.golesB);

    if (!partidoId) {
      return NextResponse.json({ error: "partidoId requerido" }, { status: 400 });
    }
    if (golesA === null || golesB === null) {
      return NextResponse.json(
        { error: "Los goles deben ser enteros entre 0 y 30." },
        { status: 400 },
      );
    }

    const partidoRef = adminDb.collection("mundial_partidos").doc(partidoId);
    const partidoSnap = await partidoRef.get();
    if (!partidoSnap.exists) {
      return NextResponse.json({ error: "Partido no encontrado." }, { status: 404 });
    }

    // Trae todos los pronósticos pendientes del partido
    const pronosticosSnap = await adminDb
      .collection("mundial_pronosticos")
      .where("partidoId", "==", partidoId)
      .get();

    let batch = adminDb.batch();
    let opsEnBatch = 0;
    const commits: Promise<any>[] = [];

    const flush = () => {
      if (opsEnBatch === 0) return;
      commits.push(batch.commit());
      batch = adminDb.batch();
      opsEnBatch = 0;
    };

    const stats = { total: 0, exactos: 0, ganador: 0, sinSellos: 0, sellosRepartidos: 0 };
    // uids que resolvimos en ESTA llamada (para enviar push solo a ellos y no
    // duplicar avisos si el resolver se reejecuta sobre un partido ya cerrado).
    const notificarPorUid = new Map<string, number>();

    for (const docSnap of pronosticosSnap.docs) {
      const data = docSnap.data();
      stats.total++;

      // Skip si ya fue resuelto (idempotencia)
      if (data.resuelto === true) continue;

      const predA = normalizarGoles(data.golesA);
      const predB = normalizarGoles(data.golesB);
      if (predA === null || predB === null) continue;

      const sellosGanados = calcularSellos(predA, predB, golesA, golesB);
      if (sellosGanados === 8) stats.exactos++;
      else if (sellosGanados === 3) stats.ganador++;
      else stats.sinSellos++;

      if (typeof data.userId === "string" && data.userId) {
        // Si un usuario tiene más de un pronóstico para el mismo partido
        // (edge case), nos quedamos con el mejor resultado para el push.
        const prev = notificarPorUid.get(data.userId) ?? -1;
        if (sellosGanados > prev) notificarPorUid.set(data.userId, sellosGanados);
      }

      batch.update(docSnap.ref, {
        resuelto: true,
        sellosGanados,
        marcadorRealA: golesA,
        marcadorRealB: golesB,
        resueltoEn: FieldValue.serverTimestamp(),
        resueltoPor: decoded.uid,
      });
      opsEnBatch++;

      if (sellosGanados > 0 && typeof data.userId === "string" && data.userId) {
        const userRef = adminDb.collection("usuarios").doc(data.userId);
        batch.update(userRef, {
          comprasRealizadas: FieldValue.increment(sellosGanados),
          sellosHistoricos: FieldValue.increment(sellosGanados),
          // Puntaje histórico del torneo (independiente del saldo canjeable).
          // Alimenta el leaderboard de /mundial.
          mundialPuntos: FieldValue.increment(sellosGanados),
          lastUpdate: new Date().toISOString(),
        });
        opsEnBatch++;
        stats.sellosRepartidos += sellosGanados;
      }

      if (opsEnBatch >= BATCH_MAX) flush();
    }

    // Marca el partido como finalizado (independiente del batch anterior)
    batch.update(partidoRef, {
      finalizado: true,
      golesA,
      golesB,
      resueltoEn: FieldValue.serverTimestamp(),
      resueltoPor: decoded.uid,
    });
    opsEnBatch++;
    flush();

    await Promise.all(commits);

    // ── Notificaciones push a quienes pronosticaron este partido ─────────────
    // Se envían tras confirmar los commits, así ningún usuario recibe aviso de
    // sellos que no le llegaron. Personalizadas según acierto.
    const pushStats = { destinatarios: 0, ok: 0, fail: 0, sinToken: 0 };
    try {
      const partidoData = partidoSnap.data() ?? {};
      const equipoA: string = partidoData.equipoA ?? "Equipo A";
      const equipoB: string = partidoData.equipoB ?? "Equipo B";
      const banderaA: string = partidoData.banderaA ?? "";
      const banderaB: string = partidoData.banderaB ?? "";

      const titulo = `⚽ Final ${banderaA} ${equipoA} ${golesA}-${golesB} ${equipoB} ${banderaB}`.replace(/\s+/g, " ").trim();
      const esEmpate = golesA === golesB;

      const cuerpoPor = (sellos: number): string => {
        if (sellos === 8) return "¡Marcador exacto! Ganaste 8 sellos por acertar el resultado.";
        if (sellos === 3) {
          return esEmpate
            ? "Acertaste el empate. Ganaste 3 sellos."
            : "Acertaste al ganador. Ganaste 3 sellos.";
        }
        return "Esta vez no acertaste. Quedan más partidos para sumar sellos.";
      };

      const uids = Array.from(notificarPorUid.keys());
      pushStats.destinatarios = uids.length;

      if (uids.length > 0) {
        // Firestore Admin `getAll` acepta hasta 500 refs por llamada.
        const CHUNK = 500;
        const userDocs: FirebaseFirestore.DocumentSnapshot[] = [];
        for (let i = 0; i < uids.length; i += CHUNK) {
          const refs = uids.slice(i, i + CHUNK).map((u) =>
            adminDb.collection("usuarios").doc(u),
          );
          const chunkDocs = await adminDb.getAll(...refs);
          userDocs.push(...chunkDocs);
        }

        const messages: Message[] = [];
        type NotifTarget = { uid: string; token?: string; titulo: string; cuerpo: string; sellos: number };
        const targets: NotifTarget[] = [];

        for (const snap of userDocs) {
          if (!snap.exists) continue;
          const uid = snap.id;
          const data = snap.data() ?? {};
          if (data.baneado) continue;
          const sellos = notificarPorUid.get(uid) ?? 0;
          const cuerpo = cuerpoPor(sellos);
          const token: unknown = data.fcmToken;
          const tokenValido = typeof token === "string" && token.length > 10;

          targets.push({ uid, token: tokenValido ? (token as string) : undefined, titulo, cuerpo, sellos });

          if (!tokenValido) {
            pushStats.sinToken++;
            continue;
          }

          messages.push({
            token: token as string,
            notification: { title: titulo, body: cuerpo },
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channelId: "club_patio_default",
                visibility: "public",
              },
            },
            apns: {
              headers: { "apns-priority": "10", "apns-push-type": "alert" },
              payload: {
                aps: {
                  alert: { title: titulo, body: cuerpo },
                  sound: "default",
                  badge: 1,
                  "content-available": 1,
                },
              },
            },
            webpush: {
              headers: { Urgency: "high", TTL: "86400" },
              notification: {
                title: titulo,
                body: cuerpo,
                icon: "/Logo2.png",
                badge: "/Logo2.png",
                // tag por partido: si el resolver se re-ejecuta, el navegador
                // reemplaza la notificación anterior en vez de apilarla.
                tag: `club-patio-mundial-${partidoId}`,
                renotify: false,
              },
              fcmOptions: { link: "/mundial" },
            },
          });
        }

        // Envío FCM en lotes de 500 (límite de sendEach).
        const invalidTokens: string[] = [];
        for (let i = 0; i < messages.length; i += 500) {
          const slice = messages.slice(i, i + 500);
          const result = await adminMessaging.sendEach(slice);
          pushStats.ok += result.successCount;
          pushStats.fail += result.failureCount;
          result.responses.forEach((resp, idx) => {
            if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
              // Todos los mensajes de este endpoint se construyen con `token`
              // (nunca con `topic`/`condition`), así que el cast es seguro.
              const tok = (slice[idx] as { token?: string }).token;
              if (tok) invalidTokens.push(tok);
            }
          });
        }

        // Guardar la notificación en la subcolección de cada usuario (500/batch).
        const now = new Date().toISOString();
        for (let i = 0; i < targets.length; i += 500) {
          const chunk = targets.slice(i, i + 500);
          const nBatch = adminDb.batch();
          chunk.forEach((t) => {
            const ref = adminDb.collection("usuarios").doc(t.uid).collection("notificaciones").doc();
            nBatch.set(ref, {
              titulo: t.titulo,
              mensaje: t.cuerpo,
              leida: false,
              fecha: now,
              tipo: "MUNDIAL_RESULTADO",
              isAI: false,
              cta: "Ver Mundial",
              partidoId,
              sellosGanados: t.sellos,
            });
          });
          await nBatch.commit();
        }

        // Limpiar tokens inválidos (mismo patrón que el cron diario).
        if (invalidTokens.length > 0) {
          const cleanupBatch = adminDb.batch();
          for (const t of targets) {
            if (t.token && invalidTokens.includes(t.token)) {
              cleanupBatch.update(adminDb.collection("usuarios").doc(t.uid), { fcmToken: null });
            }
          }
          await cleanupBatch.commit();
        }
      }
    } catch (e) {
      console.warn("[mundial/resolver] Envío de notificaciones falló:", e);
    }

    // Log no crítico
    (async () => {
      try {
        await adminDb.collection("system_logs").add({
          usuarioId: decoded.uid,
          usuario: decoded.email ?? "staff",
          accion: `resolvió partido mundialista ${partidoId} (${golesA}-${golesB}): ${stats.sellosRepartidos} sellos repartidos entre ${stats.exactos + stats.ganador} de ${stats.total} pronósticos · push: ${pushStats.ok}/${pushStats.destinatarios}`,
          fecha: new Date().toISOString(),
          tipo: "MUNDIAL_RESOLVER",
        });
      } catch (e) {
        console.warn("[mundial/resolver] Log falló:", e);
      }
    })();

    return NextResponse.json({ ok: true, partidoId, golesA, golesB, ...stats, push: pushStats });
  } catch (error: any) {
    console.error("[mundial/resolver] Error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Error interno" },
      { status: 500 },
    );
  }
}
