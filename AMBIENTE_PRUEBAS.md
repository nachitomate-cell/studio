# Ambiente de Pruebas (Emuladores Firebase)

Ambiente local 100% aislado para probar el flujo de canje de sellos **sin tocar
producción**. Usa el Firebase Emulator Suite (Auth + Firestore + Storage).

## Requisitos
- Firebase CLI y Java (ya instalados en este equipo).
- Dependencias del proyecto (`npm install`).

## Cómo levantarlo (3 terminales)

```bash
# 1) Emuladores (Auth :9099, Firestore :8080, Storage :9199, UI :4000)
npm run emulators

# 2) Sembrar datos de prueba (con los emuladores ya corriendo)
npm run seed:emu

# 3) App apuntando a los emuladores
npm run dev:emu
```

Abre la app en http://localhost:9002 y la consola de emuladores en http://localhost:4000.

> El emulador importa/exporta su estado en `./.emulator-data` (gitignored), así que
> los datos sembrados persisten entre reinicios. Para empezar de cero, borra esa carpeta.

## Cuentas sembradas (password para todas: `Test1234`)

| Rol | Email | Notas |
|---|---|---|
| Moderador/Admin | `ignaciiio.mate@gmail.com` | Panel moderador, auditoría de boletas |
| Emprendedor | `empre1@test.cl` | Flujo handshake. QR: `/scan?ref=u_empre1` |
| Comercio Asociado | `asoc1@test.cl` | Flujo boleta (auto-servicio). QR: `/scan?ref=u_asoc1` |
| Cliente 1 | `cliente1@test.cl` | 4 sellos (1 más = premio) |
| Cliente 2 | `cliente2@test.cl` | 9 sellos |

## Flujos a probar

**Emprendedor (handshake):** inicia sesión como `cliente1`, escanea/abre
`/canje?localId=u_empre1` → queda "esperando". En otra sesión, `empre1` confirma en
`/validar` ingresando un monto → el cliente recibe el sello.

**Comercio asociado (boleta):** como `cliente1`, abre `/canje?localId=u_asoc1` →
aparece el **formulario de boleta** (monto + foto) → "Obtener mis sellos" → sello
inmediato. El moderador puede auditar la boleta después.

**Canje de premio:** como `cliente2` (9 sellos) ve premios disponibles y canjea
(genera voucher vía `/api/canje/create`, server-side). El emprendedor valida el
código en `/validar`.

## Seguridad
- El cliente (`firebase.ts`) solo se conecta a emuladores si `NEXT_PUBLIC_USE_EMULATORS=true`
  (lo setea `dev:emu`). En producción nunca apunta a emuladores.
- El seed (`scripts/seed-emulator.mjs`) **aborta** si no detecta `FIRESTORE_EMULATOR_HOST`,
  para no escribir jamás en producción.
- El Admin SDK (`firebaseAdmin.ts`) entra en modo emulador (sin credenciales) solo si
  detecta las variables de emulador.
