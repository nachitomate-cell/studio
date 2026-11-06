/**
 * GET /api/admin/usuarios
 *
 * Devuelve todos los usuarios de la colección 'usuarios' usando Admin SDK,
 * saltando las reglas de seguridad de Firestore del cliente.
 *
 * Requiere header: Authorization: Bearer <idToken>
 * Solo accesible por: email admin o rol staff (moderador/director/admin)
 */

import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
import { ALLOWED_MOD_EMAILS, puedeExportarBase } from "@/lib/constants";
import { getUserRoles } from "@/lib/roles";

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar token
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (tokenError) {
      console.warn("[admin/usuarios] Token inválido o expirado");
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Verificar que es staff o admin email
    const callerDoc  = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRoles = getUserRoles(callerData);
    const isAdmin    = ALLOWED_MOD_EMAILS.includes((decoded.email ?? "").toLowerCase());

    if (!isAdmin && !callerRoles.some((r) => ROLES_STAFF.includes(r))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    // Traer todos los usuarios
    const snap     = await adminDb.collection("usuarios").get();
    // Solo SynapTech recibe la base completa. El staff del Patio ve a cada socio
    // en el panel, pero correo y teléfono llegan enmascarados: este endpoint
    // devolvía en un solo GET la base entera con datos de contacto, que es
    // justamente lo que no se puede llevar (contrato 11-04-2026, cl. 3 y 5).
    const completo = puedeExportarBase(decoded.email);
    const usuarios = snap.docs.map((d) => {
      const x = d.data();
      if (completo) return { id: d.id, ...x };
      return {
        id: d.id,
        nombre: x.nombre ?? null,
        correo: enmascararCorreo(x.email || x.correo),
        telefono: enmascararTelefono(x.telefono || x.phone),
        comuna: x.comuna ?? null,
        fechaNacimiento: x.fechaNacimiento ?? null,
        createdAt: x.createdAt ?? null,
        fechaRegistro: x.fechaRegistro ?? null,
        lastUpdate: x.lastUpdate ?? null,
        comprasRealizadas: x.comprasRealizadas ?? 0,
        rol: x.rol ?? null,
        roles: Array.isArray(x.roles) ? x.roles : [],
        nps: x.nps ?? null,
        baneado: x.baneado === true,
      };
    });

    return NextResponse.json({ usuarios });
  } catch (error: unknown) {
    // Logea el error real en la terminal del servidor para facilitar el diagnóstico
    console.error("[admin/usuarios] Error interno:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

function enmascararCorreo(v: unknown): string | null {
  const s = String(v ?? "").trim();
  const at = s.indexOf("@");
  if (at < 1) return s ? "•••" : null;
  return `${s.slice(0, Math.min(2, at))}•••${s.slice(at)}`;
}

function enmascararTelefono(v: unknown): string | null {
  const s = String(v ?? "").replace(/\D/g, "");
  if (!s) return null;
  return `•••• ${s.slice(-3)}`;
}
