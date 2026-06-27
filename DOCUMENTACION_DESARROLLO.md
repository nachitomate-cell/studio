# Documentación del Proceso de Desarrollo — Club Patio Curauma

**Producto:** Club Patio Curauma — PWA de fidelización con modelo de datos conductual propietario
**Titular del desarrollo:** Synaptech Spa
**Período documentado:** 24 de marzo de 2026 – 14 de junio de 2026
**Evidencia técnica:** historial de control de versiones (Git) — 342 registros de cambios fechados y trazables
**Base de código:** 155 archivos fuente · ~38.400 líneas de código (TypeScript/React)

---

## 1. Naturaleza del I+D

El componente de Investigación y Desarrollo del proyecto consiste en el **desarrollo iterativo de un modelo de datos conductual propietario** que ningún sistema estándar de fidelización por sellos ofrece de forma nativa. Mientras una plataforma de "tarjeta de sellos" convencional solo cuenta visitas, este desarrollo construye sobre cada interacción un **perfil conductual** que cruza tres dimensiones medibles —frecuencia, valor y recencia— y entrega a cada comercio analítica individual comparada contra el promedio del ecosistema.

El desarrollo se ejecutó de forma **iterativa e incremental**, con tres versiones claramente diferenciadas. Cada versión está respaldada por su correspondiente conjunto de cambios en el historial de control de versiones del proyecto.

---

## 2. Iteraciones del desarrollo

### Versión 1.0 — Sistema básico de sellos digitales (prueba de concepto)

**Período:** 24 de marzo – 11 de abril de 2026 · **135 iteraciones de código (commits)**
**Hito de cierre:** `Release v1.0 — Versión funcional estable` (10–11 de abril de 2026)

Prueba de concepto que valida la mecánica central de fidelización digital:

- Acumulación de sellos mediante escaneo de códigos QR (cliente ↔ comercio).
- Autenticación de usuarios y creación automática de perfiles en base de datos.
- Catálogo de premios y mecanismo de canje de sellos.
- Directorio de comercios adheridos y distinción de roles (socio, emprendedor, director).
- Empaquetado como aplicación instalable (PWA) y base para apps nativas (Android/iOS).

**Resultado:** se demuestra técnicamente la viabilidad del circuito completo "ganar → canjear" sobre infraestructura propia. Es la línea base estable sobre la que se construye el I+D diferenciador.

---

### Versión 2.0 — Módulo de segmentación por 5 perfiles conductuales

**Período:** 12 de abril – 22 de mayo de 2026 · **144 iteraciones de código (commits)**
**Hitos clave:** `sistema de referidos, CRM del vendedor y segmentación de marketing` (5-may) → `recolección de datos de usuario para segmentación y analytics` (22-may)

Incorporación del núcleo de I+D: un **motor de segmentación conductual** que clasifica automáticamente a cada cliente en uno de **5 perfiles propietarios**, a partir de su frecuencia de visitas, su gasto/ticket promedio y la recencia de su última interacción:

| Perfil | Criterio conductual |
|---|---|
| **VIP** 👑 | Alta frecuencia + actividad reciente. Núcleo de mayor valor del comercio. |
| **Alto Valor** 💎 | Gasto/ticket por sobre el promedio aunque su frecuencia no sea la más alta. |
| **Fidelizado** 🤝 | Cliente recurrente y activo; hábito de regreso consolidado. |
| **En Desarrollo** 🌱 | 2–3 visitas; en proceso de construcción de hábito. |
| **Potencial** ✨ | Cliente nuevo o por reactivar; conversión sin explotar. |

Funcionalidades asociadas a la segmentación:

- CRM por comercio con identificación de clientes inactivos (>30 días), tasa de retorno y ticket promedio.
- Acciones de marketing dirigidas por segmento (reactivación vía WhatsApp, plantillas).
- Notificaciones push segmentadas según comportamiento (motor de mensajería con IA).
- Sistema de referidos y captura ampliada de datos conductuales.

**Resultado:** el sistema deja de ser un contador de sellos y pasa a generar **inteligencia conductual accionable** por comercio. La clasificación de los 5 perfiles está implementada como un módulo canónico y reutilizable del sistema (`src/lib/perfilesConductuales.ts`).

---

### Versión actual — Dashboard de analytics por comercio (métricas individuales vs promedio del ecosistema)

**Período:** 22 de mayo – 14 de junio de 2026 · **63 iteraciones de código (commits)**
**Hitos clave:** `módulos SynapTech AI en /vendedor, perfil socio y /director` (22-may), agregación de métricas por comercio.

Capa de analítica que entrega a cada comercio un **tablero individual** y posiciona su desempeño frente al **promedio del ecosistema** Club Patio Curauma:

- Distribución visual de la cartera de cada comercio entre los 5 perfiles conductuales.
- Métricas individuales por comercio (visitas, retención, ticket, días más activos) calculadas sobre los registros reales de fidelización.
- Panel directivo (`/director`) con ranking y métricas globales del ecosistema, base de la comparación "individual vs promedio".
- Capa de insights asistida por IA (Gemini) que traduce los datos en recomendaciones de gestión.

**Resultado:** cada comercio adherido accede a analítica de nivel profesional —antes reservada a grandes cadenas— y puede comparar su rendimiento contra el agregado del ecosistema, cerrando el ciclo de valor del modelo de datos conductual.

---

## 3. Trazabilidad y verificabilidad

Todo el proceso de desarrollo está registrado en el sistema de control de versiones del proyecto (Git), con **342 cambios fechados** entre el 24 de marzo y el 14 de junio de 2026. Cada iteración descrita en este documento es verificable mediante el historial de commits, lo que constituye evidencia técnica objetiva del esfuerzo de I+D, su cronología y su carácter incremental.

| Versión | Período | Iteraciones (commits) |
|---|---|---|
| V1.0 — Sellos digitales (PoC) | 24-mar a 11-abr 2026 | 135 |
| V2.0 — Segmentación 5 perfiles | 12-abr a 22-may 2026 | 144 |
| Versión actual — Analytics por comercio | 22-may a 14-jun 2026 | 63 |
| **Total** | **24-mar a 14-jun 2026** | **342** |

---

*Documento generado a partir del historial técnico real del repositorio. Las fechas, conteos de iteraciones y nombres de hitos provienen directamente del control de versiones del proyecto y pueden auditarse.*
