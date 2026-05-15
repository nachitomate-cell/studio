import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

import { ADMIN_EMAIL } from "@/lib/constants";

function generarCodigoReferido(nombre: string): string {
  const prefijo = nombre.trim().toUpperCase().replace(/\s/g, "").replace(/[^A-Z]/g, "").substring(0, 4).padEnd(4, "X");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sufijo = "";
  for (let i = 0; i < 4; i++) sufijo += chars[Math.floor(Math.random() * chars.length)];
  return `${prefijo}-${sufijo}`;
}

export async function POST(req: NextRequest) {
  // Verificar que sea el admin
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(auth.slice(7));
    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const usuariosSnap = await adminDb.collection("usuarios").get();

  // Cargar códigos existentes para evitar colisiones
  const codigosSnap = await adminDb.collection("codigos_referido").get();
  const codigosExistentes = new Set(codigosSnap.docs.map((d) => d.id));

  let actualizados = 0;
  let omitidos = 0;
  const errores: string[] = [];

  for (const userDoc of usuariosSnap.docs) {
    const data = userDoc.data();
    if (data.codigoReferido) { omitidos++; continue; }

    // Generar código único
    let codigo = generarCodigoReferido(data.nombre || "USER");
    let intentos = 0;
    while (codigosExistentes.has(codigo) && intentos < 10) {
      codigo = generarCodigoReferido(data.nombre || "USER");
      intentos++;
    }
    if (codigosExistentes.has(codigo)) {
      errores.push(userDoc.id);
      continue;
    }

    try {
      const batch = adminDb.batch();
      batch.update(adminDb.collection("usuarios").doc(userDoc.id), {
        codigoReferido: codigo,
        referidosExitosos: data.referidosExitosos ?? 0,
      });
      batch.set(adminDb.collection("codigos_referido").doc(codigo), {
        userId: userDoc.id,
        creadoEn: new Date().toISOString(),
      });
      await batch.commit();
      codigosExistentes.add(codigo);
      actualizados++;
    } catch (e: any) {
      errores.push(userDoc.id);
    }
  }

  return NextResponse.json({ ok: true, actualizados, omitidos, errores });
}
