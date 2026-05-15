import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

import { ADMIN_EMAIL } from "@/lib/constants";

const RANGOS = [
  { nombre: "Platino", min: 100 },
  { nombre: "Oro",     min: 50 },
  { nombre: "Plata",   min: 15 },
  { nombre: "Bronce",  min: 5 },
  { nombre: "Visitante", min: 0 },
];

function calcularRangoNombre(sellos: number): string {
  return RANGOS.find((r) => sellos >= r.min)?.nombre ?? "Visitante";
}

export async function POST(req: NextRequest) {
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
  let actualizados = 0;
  let omitidos = 0;
  const errores: string[] = [];

  for (const userDoc of usuariosSnap.docs) {
    const data = userDoc.data();

    // Ya migrado
    if (typeof data.sellosHistoricos === "number") { omitidos++; continue; }

    try {
      // Sumar todos los sellos descontados en canjes de este usuario
      const canjesSnap = await adminDb
        .collection("canjes")
        .where("clienteId", "==", userDoc.id)
        .get();

      const totalCanjeado = canjesSnap.docs.reduce((sum, d) => {
        const v = d.data().sellosDescontados;
        return sum + (typeof v === "number" ? v : 0);
      }, 0);

      const comprasActuales = data.comprasRealizadas || 0;
      const sellosHistoricos = comprasActuales + totalCanjeado;
      const rangoActual = calcularRangoNombre(sellosHistoricos);

      await adminDb.collection("usuarios").doc(userDoc.id).update({
        sellosHistoricos,
        rangoActual,
        rangoMaximo: rangoActual,
      });

      actualizados++;
    } catch (e: any) {
      errores.push(userDoc.id);
    }
  }

  return NextResponse.json({ ok: true, actualizados, omitidos, errores });
}
