import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ALLOWED_MOD_EMAILS } from "@/lib/constants";
import { getUserRoles } from "@/lib/roles";

const ROLES_STAFF = ["moderador", "admin", "director", "director_patio"];
const SKIP_METHODS = new Set(["BIENVENIDA", "REFERIDO", "SISTEMA", "MODERADOR_GRANT"]);
const SKIP_VENDORS = new Set(["MODERADOR", "simulacion"]);

interface ClientAgg {
  nombre: string;
  count: number;
  totalMonto: number;
  countConMonto: number;
}

export async function GET(request: Request) {
  try {
    const idToken = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

    // Traer todos los logs de fidelización no anulados
    const snap = await adminDb
      .collection("system_logs")
      .where("tipo", "==", "FIDELIZACION")
      .get();

    // Agregar por vendedorId → clienteId
    const byVendor: Record<string, Record<string, ClientAgg>> = {};

    for (const d of snap.docs) {
      const data = d.data();
      if (data.anulada === true) continue;
      const vendorId: string = data.vendedorId ?? "";
      if (!vendorId || SKIP_VENDORS.has(vendorId)) continue;
      if (data.metodo && SKIP_METHODS.has(data.metodo)) continue;

      const clientId: string = data.usuarioId ?? "";
      if (!clientId) continue;

      if (!byVendor[vendorId]) byVendor[vendorId] = {};
      if (!byVendor[vendorId][clientId]) {
        byVendor[vendorId][clientId] = {
          nombre: data.usuario ?? "Miembro del Club",
          count: 0,
          totalMonto: 0,
          countConMonto: 0,
        };
      }

      const agg = byVendor[vendorId][clientId];
      agg.count++;
      const monto = typeof data.monto === "number" && data.monto > 0 ? data.monto : 0;
      if (monto > 0) {
        agg.totalMonto += monto;
        agg.countConMonto++;
      }
    }

    // Resolver nombres genéricos de los clientes que lideran por vendor
    const genericNames = new Set(["miembro del club", "miembro", "desconocido", ""]);
    const clientsToResolve = new Set<string>();

    for (const vendorId of Object.keys(byVendor)) {
      const clients = byVendor[vendorId];
      const sorted = Object.entries(clients);
      // top spender (by totalMonto)
      const [topSpenderId] = [...sorted].sort((a, b) => b[1].totalMonto - a[1].totalMonto)[0] ?? [];
      // top frequent (by count)
      const [topFreqId] = [...sorted].sort((a, b) => b[1].count - a[1].count)[0] ?? [];

      for (const id of [topSpenderId, topFreqId]) {
        if (id && clients[id] && genericNames.has(clients[id].nombre.toLowerCase().trim())) {
          clientsToResolve.add(id);
        }
      }
    }

    // Batch-fetch nombres reales
    const resolvedNames: Record<string, string> = {};
    await Promise.all(
      [...clientsToResolve].map(async (uid) => {
        try {
          const doc = await adminDb.collection("usuarios").doc(uid).get();
          if (doc.exists) {
            const nombre = doc.data()?.nombre;
            if (nombre) resolvedNames[uid] = nombre;
          }
        } catch { /* ignore */ }
      })
    );

    // Resolver nombres de vendors
    const vendorIds = Object.keys(byVendor);
    const vendorNames: Record<string, string> = {};
    await Promise.all(
      vendorIds.map(async (vid) => {
        try {
          const doc = await adminDb.collection("usuarios").doc(vid).get();
          if (doc.exists) {
            const d = doc.data()!;
            vendorNames[vid] = d.nombreTienda || d.businessName || d.nombre || vid;
          }
        } catch { /* ignore */ }
      })
    );

    // Construir resultado final
    const result = vendorIds
      .map((vendorId) => {
        const clients = byVendor[vendorId];
        const sorted = Object.entries(clients);

        // Top spender — solo clientes con monto registrado
        const conMonto = sorted.filter(([, c]) => c.totalMonto > 0);
        const [topSpenderId, topSpenderData] = conMonto.length
          ? [...conMonto].sort((a, b) => b[1].totalMonto - a[1].totalMonto)[0]
          : [null, null];

        // Top frecuente — todos
        const [topFreqId, topFreqData] = sorted.length
          ? [...sorted].sort((a, b) => b[1].count - a[1].count)[0]
          : [null, null];

        const resolveName = (id: string | null, fallback: string) =>
          id ? (resolvedNames[id] || fallback) : fallback;

        return {
          vendorId,
          vendorName: vendorNames[vendorId] || vendorId,
          totalTransacciones: sorted.reduce((s, [, c]) => s + c.count, 0),
          topSpender: topSpenderId && topSpenderData
            ? {
                nombre: resolveName(topSpenderId, topSpenderData.nombre),
                totalMonto: topSpenderData.totalMonto,
                avgTicket: topSpenderData.countConMonto > 0
                  ? Math.round(topSpenderData.totalMonto / topSpenderData.countConMonto)
                  : 0,
                compras: topSpenderData.countConMonto,
              }
            : null,
          topFrecuente: topFreqId && topFreqData
            ? {
                nombre: resolveName(topFreqId, topFreqData.nombre),
                visitas: topFreqData.count,
              }
            : null,
        };
      })
      .filter((v) => v.totalTransacciones > 0)
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    return NextResponse.json({ locales: result });
  } catch (error) {
    console.error("[admin/stats-locales] Error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
