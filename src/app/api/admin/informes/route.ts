/**
 * POST   /api/admin/informes      — sube un informe (PDF) y avisa al comercio
 * DELETE /api/admin/informes?id=  — borra el informe (archivo + metadatos)
 *
 * Solo staff. La subida va por el Admin SDK igual que /api/admin/upload-imagen:
 * `informes/` no tiene regla en storage.rules a propósito (deny-all), porque el
 * informe trae las ventas de un local y no puede quedar en una URL adivinable.
 *
 * POST body (multipart/form-data):
 *   file:     File     — PDF, máx 20 MB
 *   alcance:  "general" | "comercio"
 *   vendorId: string   — requerido cuando alcance === "comercio"
 *   titulo:   string
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminMessaging, adminStorage } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS, ROLES_STAFF_PANEL, CANONICAL_BASE_URL } from "@/lib/constants";
import { INFORMES_COLLECTION, MAX_INFORME_BYTES } from "@/lib/informes";

const CTA_INFORMES = "/vendedor?vista=informes";
const LOTE_PUSH = 500;

async function autorizarStaff(request: Request): Promise<{ email: string } | NextResponse> {
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

  const email = (decoded.email ?? "").trim().toLowerCase();
  let autorizado = ALLOWED_MOD_EMAILS.includes(email);
  if (!autorizado) {
    const snap = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const data = snap.exists ? snap.data()! : null;
    const rol: string = data?.rol ?? "";
    const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
    autorizado =
      ROLES_STAFF_PANEL.includes(rol) || roles.some((r) => ROLES_STAFF_PANEL.includes(r));
  }
  if (!autorizado) {
    return NextResponse.json({ error: "Sin permisos de staff" }, { status: 403 });
  }

  return { email };
}

/** Deja el nombre original reconocible pero incapaz de escapar del prefijo. */
function nombreSeguro(nombre: string): string {
  // slice(-80) y no slice(0, 80): recorta por delante para no perder el ".pdf".
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "informe.pdf";
}

async function notificar(
  uids: string[],
  titulo: string,
  mensaje: string,
): Promise<{ notificados: number; pushEnviados: number }> {
  if (!uids.length) return { notificados: 0, pushEnviados: 0 };

  const fecha = new Date().toISOString();

  const batch = adminDb.batch();
  for (const uid of uids) {
    batch.set(
      adminDb.collection("usuarios").doc(uid).collection("notificaciones").doc(),
      {
        titulo,
        mensaje,
        leida: false,
        fecha,
        tipo: "INFORME",
        receptorId: uid,
        actionUrl: CTA_INFORMES,
        cta: CTA_INFORMES,
      },
    );
  }
  await batch.commit();

  const snaps = await adminDb.getAll(
    ...uids.map((uid) => adminDb.collection("usuarios").doc(uid)),
  );
  const tokens = snaps
    .map((s) => (s.exists ? s.data()?.fcmToken : null))
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  const url = `${CANONICAL_BASE_URL}${CTA_INFORMES}`;
  let pushEnviados = 0;
  for (let i = 0; i < tokens.length; i += LOTE_PUSH) {
    try {
      const res = await adminMessaging.sendEachForMulticast({
        tokens: tokens.slice(i, i + LOTE_PUSH),
        notification: { title: titulo, body: mensaje },
        data: { type: "INFORME", cta: CTA_INFORMES, url },
        android: {
          priority: "high",
          notification: { channelId: "club_patio_default", icon: "ic_notification", sound: "default" },
        },
        apns: { payload: { aps: { badge: 1, sound: "default" } } },
        webpush: { notification: { tag: "club-patio-informe", icon: "/Logo2.png" }, fcmOptions: { link: url } },
      });
      pushEnviados += res.successCount;
    } catch (e) {
      // La bandeja ya quedó escrita: el informe se ve igual aunque el push falle.
      console.warn("[admin/informes] push falló en un lote:", e);
    }
  }

  return { notificados: uids.length, pushEnviados };
}

export async function POST(request: Request) {
  try {
    const staff = await autorizarStaff(request);
    if (staff instanceof NextResponse) return staff;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Se esperaba multipart/form-data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }
    if (file.size > MAX_INFORME_BYTES) {
      return NextResponse.json({ error: "El informe supera los 20 MB" }, { status: 413 });
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "El informe debe ser un PDF" }, { status: 400 });
    }

    const titulo = String(form.get("titulo") ?? "").trim();
    if (!titulo) {
      return NextResponse.json({ error: "Falta el título del informe" }, { status: 400 });
    }

    const alcance = String(form.get("alcance") ?? "").trim();
    let vendorId: string | null = null;
    let vendorNombre: string | null = null;
    let carpeta: string;

    if (alcance === "comercio") {
      vendorId = String(form.get("vendorId") ?? "").trim();
      if (!vendorId || vendorId.includes("/") || vendorId.includes("..")) {
        return NextResponse.json({ error: "vendorId inválido" }, { status: 400 });
      }
      const perfil = await adminDb.collection("entrepreneur_profiles").doc(vendorId).get();
      if (!perfil.exists) {
        return NextResponse.json({ error: "Ese comercio no existe" }, { status: 404 });
      }
      const data = perfil.data()!;
      vendorNombre = String(data.businessName || data.nombre || "").trim() || "Comercio";
      carpeta = vendorId;
    } else if (alcance === "general") {
      carpeta = "general";
    } else {
      return NextResponse.json({ error: "alcance inválido" }, { status: 400 });
    }

    const archivoPath = `informes/${carpeta}/${Date.now()}_${nombreSeguro(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Sin firebaseStorageDownloadTokens: el archivo queda privado y solo se
    // alcanza por la signed URL que emite /api/informes/url.
    await adminStorage.bucket().file(archivoPath).save(buffer, {
      contentType: "application/pdf",
    });

    const creadoEn = new Date().toISOString();
    const docRef = await adminDb.collection(INFORMES_COLLECTION).add({
      titulo,
      alcance,
      vendorId,
      vendorNombre,
      archivoPath,
      nombreArchivo: file.name,
      tamanoBytes: file.size,
      creadoEn,
      subidoPor: staff.email,
    });

    // A quién avisar: al comercio, o a todos los que tienen ficha de comercio.
    let destinatarios: string[];
    if (alcance === "comercio") {
      destinatarios = [vendorId!];
    } else {
      const perfiles = await adminDb.collection("entrepreneur_profiles").get();
      destinatarios = perfiles.docs.map((d) => d.id);
    }

    const { notificados, pushEnviados } = await notificar(
      destinatarios,
      "📄 Nuevo informe disponible",
      alcance === "general"
        ? `Ya puedes revisar el informe del club: ${titulo}.`
        : `Ya puedes revisar tu informe: ${titulo}.`,
    );

    return NextResponse.json({ ok: true, id: docRef.id, notificados, pushEnviados });
  } catch (error: any) {
    console.error("[admin/informes] Error al subir:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const staff = await autorizarStaff(request);
    if (staff instanceof NextResponse) return staff;

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del informe" }, { status: 400 });
    }

    const ref = adminDb.collection(INFORMES_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Ese informe ya no existe" }, { status: 404 });
    }

    const archivoPath = String(snap.data()?.archivoPath ?? "");
    if (archivoPath.startsWith("informes/")) {
      await adminStorage.bucket().file(archivoPath).delete({ ignoreNotFound: true });
    }
    await ref.delete();

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[admin/informes] Error al borrar:", error);
    return NextResponse.json({ error: error?.message ?? "Error interno" }, { status: 500 });
  }
}
