import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS } from "@/lib/constants";
import { getUserRoles } from "@/lib/roles";

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
const PENDING_STATUSES = ["pending", "vendor_processing"];

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const callerDoc = await adminDb.collection("usuarios").doc(decoded.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : null;
    const callerRoles = getUserRoles(callerData);
    const isAdmin = ALLOWED_MOD_EMAILS.includes((decoded.email ?? "").toLowerCase());

    if (!isAdmin && !callerRoles.some((r) => ROLES_STAFF.includes(r))) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const snap = await adminDb
      .collection("pending_stamps")
      .where("status", "in", PENDING_STATUSES)
      .get();

    const stamps = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId ?? null,
          userName: data.userName ?? "Miembro del Club",
          vendorId: data.vendorId ?? null,
          vendorName: data.vendorName ?? null,
          status: data.status,
          monto: data.monto ?? null,
          initiatedBy: data.initiatedBy ?? "client",
          createdAt: data.createdAt?.toMillis?.() ?? null,
        };
      })
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return NextResponse.json({ stamps });
  } catch (error) {
    console.error("[admin/pending-stamps] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
