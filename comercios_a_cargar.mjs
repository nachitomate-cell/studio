/**
 * PLANTILLA DE CARGA DE COMERCIOS
 * ──────────────────────────────────────────────────────────────────────────
 * Completa los datos de cada comercio según lo que devuelvan los dueños en el
 * formulario (FORMULARIO_COMERCIO.pdf) y luego corre:
 *
 *   Revisar (no escribe):  node _ingresar_comercios.mjs
 *   Aplicar de verdad:     node _ingresar_comercios.mjs --apply
 *
 * Campos:
 *   nombre*       Nombre del comercio
 *   correoDueno*  Correo con el que el dueño se registró en la app (para vincular)
 *   nombreDueno   Nombre del dueño/administrador (opcional)
 *   rubro         Categoría (Cafetería, Gourmet, Belleza, etc.)
 *   descripcion   Descripción del local
 *   direccion     Dirección / ubicación
 *   horario       Horario de atención
 *   whatsapp      WhatsApp de contacto
 *   instagram     @usuario o URL
 *   website       Sitio web u otra red
 *   mediosPago    Array, ej: ["Efectivo","Débito","Transferencia"]
 *   slugLegacy    (solo si ya existía con otro ID) — hereda datos/fotos y oculta el duplicado
 *
 * * = obligatorio. Si falta el correo, o el dueño no está registrado en la app,
 *     ese comercio se OMITE (no se carga) y el script te avisa.
 */
export const COMERCIOS = [
  // ── Ya existen en la base (ocultos) — solo falta vincular dueño y publicar ──
  {
    nombre: "Fika Coffeshop",
    slugLegacy: "fika-coffeshop",
    correoDueno: "",          // ← COMPLETAR
    nombreDueno: "",          // ← COMPLETAR (opcional)
    // descripción, dirección, horario y fotos se heredan del registro existente.
    // Completa cualquiera de estos campos SOLO si quieres reemplazar lo actual:
    rubro: "",
    descripcion: "",
    direccion: "",
    horario: "",
    whatsapp: "",
    instagram: "",
    website: "",
    mediosPago: [],
  },
  {
    nombre: "El Refugio Coffe House",
    slugLegacy: "el-refugio-coffe-house",
    correoDueno: "",          // ← COMPLETAR
    nombreDueno: "",
    rubro: "",
    descripcion: "",
    direccion: "",
    horario: "",
    whatsapp: "",
    instagram: "",
    website: "",
    mediosPago: [],
  },

  // ── Nuevos — completar todos los datos del formulario ──
  {
    nombre: "Máster Brod",
    correoDueno: "",          // ← COMPLETAR
    nombreDueno: "",
    rubro: "",                // ← COMPLETAR
    descripcion: "",          // ← COMPLETAR
    direccion: "",            // ← COMPLETAR
    horario: "",              // ← COMPLETAR
    whatsapp: "",             // ← COMPLETAR
    instagram: "",
    website: "",
    mediosPago: [],
  },
  {
    nombre: "Pomarus",
    correoDueno: "",
    nombreDueno: "",
    rubro: "",
    descripcion: "",
    direccion: "",
    horario: "",
    whatsapp: "",
    instagram: "",
    website: "",
    mediosPago: [],
  },
  {
    nombre: "Moviclean",
    correoDueno: "",
    nombreDueno: "",
    rubro: "",
    descripcion: "",
    direccion: "",
    horario: "",
    whatsapp: "",
    instagram: "",
    website: "",
    mediosPago: [],
  },
  {
    nombre: "Antojitos de la Nutri",
    correoDueno: "",
    nombreDueno: "",
    rubro: "",
    descripcion: "",
    direccion: "",
    horario: "",
    whatsapp: "",
    instagram: "",
    website: "",
    mediosPago: [],
  },
];
