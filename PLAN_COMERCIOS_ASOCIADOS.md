# Plan: Comercios Asociados + Flujo de sellos con boleta

## 1. Concepto

Hoy todos los comercios viven en `entrepreneur_profiles` sin distinción. Se introduce un
segundo tipo de comercio con identidad, presentación y **flujo de sellos propio**:

| | **Emprendedor** (actual) | **Comercio Asociado** (nuevo) |
|---|---|---|
| Quién es | Artesano / persona (joyería, deco, artesanía) | Local/marca establecida (cafetería, restaurante, gimnasio) |
| Flujo de sellos | El **vendedor escanea** al cliente y confirma en caja | **Auto-servicio**: el cliente escanea el QR del local, ingresa el monto y **sube foto de la boleta** |
| Aprobación | Inmediata por el vendedor | Automática, con **auditoría posterior** del moderador (revisa boletas, anula las falsas) |
| Cálculo de sellos | `calcularSellos(monto)` (1–4 según monto) | **El mismo** `calcularSellos(monto)` — la mecánica no cambia |
| Meta de premio | 5 sellos | 5 sellos (igual) |

La diferencia funcional real es **cómo se gana el sello** (auto-servicio con prueba) y la
**auditoría de boletas**.

---

## 2. Modelo de datos

### 2.1 `entrepreneur_profiles` — campo nuevo
- `tipo: "emprendedor" | "asociado"` — default `"emprendedor"` (lectura tolerante: si falta, es emprendedor). Nada existente se rompe.

### 2.2 `system_logs` — campos nuevos en registros de sello por boleta
- `metodo: "CLIENT_BOLETA"` (distinto de `VENDOR_SCAN`)
- `boletaUrl: string` — URL de la imagen en Storage
- `boletaPath: string` — ruta interna en Storage (para poder borrarla en limpieza)
- `monto`, `numSellos`, `tipo: "FIDELIZACION"` (como hoy)
- `revisada?: boolean` — marca de auditoría (opcional, para el panel)

### 2.3 Firebase Storage — nueva carpeta
- `boletas/{vendorId}/{timestamp}_{uid}.jpg` — fotos de boletas. Carpeta separada de
  `entrepreneur_photos/` para poder limpiarla sin tocar logos.

### 2.4 Reglas de seguridad (Storage + Firestore)
- Permitir a un usuario autenticado **subir** a `boletas/` (solo crear, no leer ajeno).
- Lectura de boletas restringida a roles staff (moderador/admin/director).

---

## 3. Fundación compartida

**Nuevo:** `src/lib/tipoComercio.ts`
- Tipo `TipoComercio`, etiquetas (`"Comercio Asociado"` / `"Emprendedor"`), estilos de badge,
  emoji/icono, y lector `getTipoComercio(data): TipoComercio` (default `"emprendedor"`).
- Helper `esAsociado(data): boolean`.
- Punto único de verdad para no repetir strings por toda la app.

---

## 4. Fases de implementación

### FASE 1 — Fundación + carga masiva (sin UI visible para el socio)
1. Crear `src/lib/tipoComercio.ts`.
2. Agregar campo `tipo` a la plantilla [comercios_a_cargar.mjs](comercios_a_cargar.mjs) y al
   script [_ingresar_comercios.mjs](_ingresar_comercios.mjs), para marcar cada comercio al cargarlo.
3. Default propuesto para los 6 que se están cargando:
   - **Asociados:** Fika, El Refugio, Máster Brod, Pomarus, Moviclean
   - **Emprendedor:** Antojitos de la Nutri
   *(ajustable)*

**Entregable:** los 6 comercios cargados con su `tipo` correcto. Aún sin cambios visuales.

---

### FASE 2 — Panel Moderador: cambiar el tipo
- En la gestión de comercios del moderador, agregar un toggle **Emprendedor ⇄ Comercio Asociado**
  que escribe `tipo` en `entrepreneur_profiles/{uid}`.
- Cumple el requisito de asignar el tipo "en ambos" (carga masiva + panel).

**Archivos:** `src/app/moderador/page.tsx` (y/o `src/app/directorio/page.tsx`, que ya tiene el form CRUD).

---

### FASE 3 — Superficies visibles para el socio
1. **Directorio / Descubre:**
   - Sección separada **"Comercios Asociados"** (arriba) y **"Emprendedores"** (abajo).
   - **Badge** "Asociado" en la tarjeta del comercio.
   - **Filtro** para ver solo Asociados / solo Emprendedores.
   - Archivos: `src/app/directorio/page.tsx`, `src/app/descubre/page.tsx`.
2. **Home / Destacados:**
   - Los Asociados aparecen **priorizados** en Destacados.
   - Archivo: la sección Destacados del home.

**Entregable:** el socio ve la distinción en directorio, descubre y home.

---

### FASE 4 — Flujo de sellos por boleta (auto-servicio) — núcleo del cambio
Disparador: el cliente escanea el QR del local (`/canje?localId=<uid>`), que **ya existe**.

1. **Detección de tipo en `/canje`:** al cargar, leer el perfil del local.
   - Si `tipo !== "asociado"` → flujo actual (handshake con aprobación del vendedor). **Sin cambios.**
   - Si `tipo === "asociado"` → **nuevo formulario auto-servicio**:
     1. Campo **monto de la compra** (validado: $1–$150.000).
     2. **Foto de la boleta** (cámara/galería) — obligatoria.
     3. Botón "Obtener mis sellos".
2. **Subida de la imagen:** a Storage `boletas/{localId}/{timestamp}_{uid}.jpg`
   (mismo patrón `uploadBytes` + `getDownloadURL` que ya se usa para logos).
3. **Nueva API** `POST /api/handshake/boleta-scan`:
   - Auth por `idToken`, rate limit (igual que `vendor-scan`).
   - Valida monto y que el `localId` sea un comercio `tipo: "asociado"`.
   - Calcula `calcularSellos(monto)` (misma función).
   - Otorga los sellos al cliente (mismos campos: `comprasRealizadas`, `sellosHistoricos`,
     `puntos`, `sellosLocales`, `recompensaDisponible`).
   - Registra en `system_logs` con `metodo: "CLIENT_BOLETA"`, `boletaUrl`, `boletaPath`, `monto`, `numSellos`.
   - Notificación push al cliente (reutiliza la lógica de `vendor-scan`).
4. **Pantalla de confirmación:** misma celebración de sello que el flujo actual.

**Archivos:** `src/app/canje/page.tsx`, nuevo `src/app/api/handshake/boleta-scan/route.ts`.

#### Anti-fraude (importante, porque es auto-reportado)
- Boleta **obligatoria** (sin foto no se otorga sello).
- **Rate limit** por IP y **cooldown por usuario+local** (reutiliza `lastVendorScans`) para evitar repetir.
- Tope de monto ($150.000, como hoy).
- Todo queda con boleta adjunta para que el moderador **anule** las falsas.
- *(Opcional)* marcar el sello como "pendiente de revisión" hasta que el moderador lo valide,
  si se prefiere control previo en vez de posterior. **Decisión abierta (ver §5).**

---

### FASE 5 — Auditoría de boletas en Moderador
Sobre la pantalla existente `src/app/moderador/sellos/page.tsx` (que ya lista sellos y permite anular):
1. **Ver la boleta:** en los registros `CLIENT_BOLETA`, mostrar miniatura de `boletaUrl`
   (click → imagen completa).
2. **Anular sello falso:** ya existe `POST /api/admin/anular-sello` (resta el sello, actualiza
   Google Wallet, marca `anulada: true`). **Extender** para que al anular **también borre la
   imagen** de Storage (`boletaPath`).
3. **Limpiar imágenes de la base:** acción nueva para borrar en lote las boletas antiguas de
   Storage (p. ej. boletas de sellos ya revisados o con más de N días), conservando el registro
   en `system_logs` pero liberando almacenamiento.
   - Nueva API `POST /api/admin/limpiar-boletas` (solo staff) que borra de Storage y limpia
     `boletaUrl`/`boletaPath` del log.

**Archivos:** `src/app/moderador/sellos/page.tsx`, `src/app/api/admin/anular-sello/route.ts` (extensión),
nuevo `src/app/api/admin/limpiar-boletas/route.ts`.

---

## 5. Decisiones abiertas (necesito tu confirmación)
1. **¿Aprobación previa o posterior?** El requisito dice "se le dan los sellos" al subir la boleta
   → **otorgar de inmediato** y auditar después (anular las falsas). Es lo que asumo. Alternativa:
   dejar el sello "pendiente" hasta que el moderador apruebe (más fricción, menos fraude).
   **Asumo: otorgar de inmediato + auditoría posterior.**
2. **¿Cuáles de los 6 son Asociados?** Propuesta en Fase 1 (todos menos Antojitos de la Nutri).
3. **¿Limpieza de imágenes automática o manual?** Propongo **manual** (botón en moderador) +
   opción de "borrar boletas de más de N días". ¿Algún criterio fijo (ej. 90 días)?
4. **Cooldown auto-servicio:** ¿permitir solo 1 boleta por local cada X horas por usuario?
   Propongo sí, para evitar spam de la misma compra.

---

## 6. Orden de ejecución sugerido
Fase 1 → 2 (fundación, ya te sirve para cargar los 6) → Fase 4 + 5 (el flujo de boleta y su
auditoría, que es el corazón) → Fase 3 (las superficies visuales). Así lo funcional queda antes
que lo cosmético. Cada fase es entregable y verificable por separado.

---

## 7. Resumen de archivos
**Nuevos:**
- `src/lib/tipoComercio.ts`
- `src/app/api/handshake/boleta-scan/route.ts`
- `src/app/api/admin/limpiar-boletas/route.ts`

**Modificados:**
- `comercios_a_cargar.mjs`, `_ingresar_comercios.mjs` (campo `tipo`)
- `src/app/moderador/page.tsx` (toggle tipo)
- `src/app/directorio/page.tsx`, `src/app/descubre/page.tsx` (secciones, badge, filtro)
- Home / Destacados (priorizar asociados)
- `src/app/canje/page.tsx` (formulario boleta para asociados)
- `src/app/moderador/sellos/page.tsx` (ver boletas, limpiar)
- `src/app/api/admin/anular-sello/route.ts` (borrar imagen al anular)
- Reglas de Storage/Firestore (carpeta `boletas/`)
