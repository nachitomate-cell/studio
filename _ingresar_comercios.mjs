/**
 * CARGA MASIVA DE COMERCIOS — crea/vincula/publica los comercios definidos en
 * comercios_a_cargar.mjs.
 *
 *   Revisar (DRY-RUN, no escribe):  node _ingresar_comercios.mjs
 *   Aplicar de verdad:              node _ingresar_comercios.mjs --apply
 *
 * Por cada comercio:
 *   1. Busca al dueño en 'usuarios' por su correo. Si no existe → OMITE y avisa
 *      (el dueño debe registrarse primero en la app con ese correo).
 *   2. Crea/actualiza entrepreneur_profiles/{UID_del_dueño} con los datos.
 *   3. Le asigna el rol 'emprendedor' al usuario (igual que el panel moderador).
 *   4. Publica el local (isHiddenFromFeed = false).
 *   5. Si tenía un registro antiguo con otro ID (slugLegacy): hereda sus fotos y
 *      oculta el duplicado para que no aparezca dos veces en el feed.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { COMERCIOS } from "./comercios_a_cargar.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dirname, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}
initializeApp({ credential: cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const db = getFirestore();

const DRY_RUN = !process.argv.includes("--apply");
const now = new Date().toISOString();

console.log(`\n🏬 CARGA DE COMERCIOS  ${DRY_RUN ? "(DRY-RUN — no escribe nada)" : "(APLICANDO CAMBIOS)"}`);
console.log("══════════════════════════════════════════════════════════════");

const norm = (s) => (s || "").toString().trim();
const lower = (s) => norm(s).toLowerCase();

// Busca un usuario por correo (case-insensitive). Devuelve {id, data} o null.
async function buscarUsuarioPorCorreo(correo) {
  const c = lower(correo);
  if (!c) return null;
  // Intento directo por campo 'correo'
  let snap = await db.collection("usuarios").where("correo", "==", correo).limit(1).get();
  if (!snap.empty) return { id: snap.docs[0].id, data: snap.docs[0].data() };
  // Fallback case-insensitive: escanear (colección pequeña)
  snap = await db.collection("usuarios").get();
  const hit = snap.docs.find((d) => lower(d.data().correo) === c);
  return hit ? { id: hit.id, data: hit.data() } : null;
}

let okCount = 0, skipCount = 0;
const resumen = [];

for (const com of COMERCIOS) {
  const nombre = norm(com.nombre);
  console.log(`\n• ${nombre || "(sin nombre)"}`);

  if (!nombre) { console.log("   ❌ Sin nombre — se omite."); skipCount++; resumen.push(["OMITIDO", nombre, "sin nombre"]); continue; }
  if (!norm(com.correoDueno)) { console.log("   ❌ Falta correoDueno — se omite."); skipCount++; resumen.push(["OMITIDO", nombre, "sin correo"]); continue; }

  const usuario = await buscarUsuarioPorCorreo(com.correoDueno);
  if (!usuario) {
    console.log(`   ❌ El dueño (${com.correoDueno}) NO está registrado en la app — se omite.`);
    console.log("      → Pídele que descargue la app y se registre con ESE correo, luego vuelve a correr.");
    skipCount++; resumen.push(["OMITIDO", nombre, `dueño no registrado: ${com.correoDueno}`]);
    continue;
  }
  const uid = usuario.id;

  // Heredar datos del registro antiguo (slug) si existe
  let legacy = null;
  if (norm(com.slugLegacy)) {
    const ls = await db.collection("entrepreneur_profiles").doc(com.slugLegacy).get();
    if (ls.exists) legacy = ls.data();
  }
  const pick = (campo, legacyCampo) => norm(com[campo]) || (legacy ? norm(legacy[legacyCampo ?? campo]) : "");

  const descripcion = pick("descripcion", "description") || pick("descripcion", "descripcion");
  const rubro = pick("rubro", "category") || pick("rubro", "rubro");
  const direccion = pick("direccion", "ubicacionTienda") || pick("direccion", "address");
  const horario = pick("horario", "operatingHours") || pick("horario", "horario");
  const whatsapp = pick("whatsapp", "whatsapp");
  const instagram = pick("instagram", "instagram");
  const website = pick("website", "website");
  const mediosPago = (Array.isArray(com.mediosPago) && com.mediosPago.length) ? com.mediosPago : (legacy?.mediosPago ?? []);
  const imageUrl = legacy?.imageUrl ?? "";
  const imageUrls = legacy?.imageUrls ?? (imageUrl ? [imageUrl] : []);

  // Perfil canónico (escribe ambos juegos de campos: inglés=actual, español=legacy)
  const perfil = {
    id: uid, userId: uid,
    businessName: nombre, nombre,
    description: descripcion, descripcion,
    category: rubro, rubro,
    ubicacionTienda: direccion, address: direccion, ubicacion: direccion,
    operatingHours: horario, horario,
    whatsapp, instagram, website,
    mediosPago,
    imageUrl, imageUrls, imagenPerfil: imageUrl, imagenTarjeta: imageUrl,
    active: true, isPremium: legacy?.isPremium ?? false,
    promoText: legacy?.promoText || "Premios disponibles canjeando tus sellos",
    isHiddenFromFeed: false,
    createdAt: legacy?.createdAt ?? now,
    updatedAt: now,
  };

  // Rol emprendedor (misma lógica que el panel moderador)
  const currentRoles = Array.isArray(usuario.data.roles) ? usuario.data.roles : [];
  const oldRole = usuario.data.rol;
  const updatedRoles = [...new Set([...currentRoles.filter((r) => r !== oldRole), "emprendedor"])];

  console.log(`   ✅ Dueño: ${usuario.data.nombre || com.nombreDueno || "?"} (uid:${uid})`);
  console.log(`      perfil → entrepreneur_profiles/${uid}  [${rubro || "sin rubro"}]  publicado`);
  console.log(`      rol → emprendedor  (roles: ${updatedRoles.join(", ")})`);
  if (legacy) console.log(`      legacy '${com.slugLegacy}' → se ocultará (hereda fotos/datos)`);
  if (!descripcion || !rubro || !direccion) console.log(`      ⚠️ Faltan datos recomendados (descripción/rubro/dirección).`);

  if (!DRY_RUN) {
    await db.collection("entrepreneur_profiles").doc(uid).set(perfil, { merge: true });
    await db.collection("usuarios").doc(uid).update({ rol: "emprendedor", roles: updatedRoles, updatedAt: now });
    if (legacy && com.slugLegacy !== uid) {
      await db.collection("entrepreneur_profiles").doc(com.slugLegacy).set({ isHiddenFromFeed: true, updatedAt: now }, { merge: true });
    }
  }
  okCount++; resumen.push(["OK", nombre, `uid:${uid}`]);
}

console.log(`\n══════════════════════════════════════════════════════════════`);
console.log(`Resumen: ${okCount} a cargar · ${skipCount} omitidos`);
resumen.forEach(([estado, nombre, det]) => console.log(`  ${estado === "OK" ? "✅" : "⏭️ "} ${nombre} — ${det}`));
console.log(DRY_RUN ? "\n🔸 DRY-RUN: no se escribió nada. Corre con --apply para aplicar.\n" : "\n✅ Cambios aplicados.\n");
process.exit(0);
