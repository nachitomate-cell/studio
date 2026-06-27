# Integración Link in Bio premium (bioo.cl)

Cada comercio **Premium** del Club Patio puede activar una página **bioo.cl/&lt;handle&gt;**
(editor con temas, fondos y animaciones) que nace **prellenada** con sus datos
(nombre, logo, WhatsApp, Instagram, web). El comercio la **reclama** con su cuenta de
Google y la personaliza.

> bioo.cl vive en OTRO proyecto (`barberia-elegance`). Club Patio se conecta a él
> server-to-server con un **secret compartido**. No comparten base de datos ni login.

## Arquitectura

```
Club Patio (/directorio)                bioo (proyecto barberia-elegance)
  └─ "Activar Link in Bio"
        POST /api/bioo/provision  ──►  HTTP biooProvision (secret compartido)
                                          · crea bios/<handle> (uid:null, prellenado)
                                          · crea bio_claims/<token> (privado)
        guarda biooHandle/...     ◄──    devuelve { handle, claimUrl, publicUrl }

  └─ envía claimUrl al comercio
        comercio abre bioo.cl/claim?h=&t=
        inicia sesión con Google  ──►  callable biooClaim (Admin SDK)
                                          · asigna uid dueño a bios/<handle>
                                          · crea bio_users/<uid>
        → bioo.cl/editor (ya es suyo, personaliza)

  Público: /emprendedor/[id] muestra botón "Ver mi Link in Bio" → bioo.cl/<handle>
```

## Campos nuevos en `entrepreneur_profiles/{vendorId}`
- `biooHandle` — handle público (ej. `cafe-aurora`)
- `biooClaimUrl` — enlace de activación (se le envía al comercio una sola vez)
- `biooPublicUrl` — `https://bioo.cl/<handle>`
- `biooProvisionedAt` — timestamp

## Variables de entorno (Club Patio / este proyecto)
En `.env.local` (local) y en **Vercel → Project → Settings → Environment Variables** (prod):

```
BIOO_PROVISION_URL=<URL que imprime el deploy de la función biooProvision>
BIOO_PROVISION_SECRET=<un secreto largo aleatorio, idéntico al del lado bioo>
```

`BIOO_PROVISION_URL` es la URL que la CLI muestra tras desplegar `biooProvision`
(función v2 onRequest, región us-central1).

## Despliegue — lado bioo (repo Barberia-Elegance)
```bash
# 1) Define el secret (mismo valor que pondrás en Club Patio)
firebase functions:secrets:set BIOO_PROVISION_SECRET

# 2) Despliega las funciones nuevas
firebase deploy --only functions:biooProvision,functions:biooClaim

# 3) Despliega las reglas (añade bio_claims privado)
firebase deploy --only firestore:rules

# 4) git commit + push  → Vercel publica claim.html, el rewrite /claim y el middleware
```
Requisito: `bioo.cl` debe estar en Firebase Authentication → Authorized domains
(ya lo está, lo usan registro/editor).

## Despliegue — lado Club Patio (este proyecto)
```bash
# 1) Configura BIOO_PROVISION_URL y BIOO_PROVISION_SECRET (local + Vercel)
# 2) git commit + push  → Vercel publica /api/bioo/provision y la UI del directorio
```

## Probar
1. En `/directorio`, edita un comercio, actívalo como **Patrocinado**, guarda.
2. Reabre y pulsa **Activar Link in Bio premium** → aparece `bioo.cl/<handle>` + enlace de activación.
3. Abre el enlace de activación en incógnito, inicia sesión con Google → cae en `bioo.cl/editor` con la página ya prellenada.
4. En `/emprendedor/<id>` aparece el botón **Ver mi Link in Bio**.
