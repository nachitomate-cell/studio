# 📱 Club Patio Curauma - Guía de Inicio

¡Bienvenido al sistema de fidelización de Patio Curauma! Esta aplicación está diseñada para funcionar como una PWA (Progressive Web App), lo que permite instalarla en celulares sin pasar por tiendas de aplicaciones.

## 🚀 Cómo "Descargar" e Instalar en tu Celular
Para tener la app en tu pantalla de inicio con su icono oficial:

### En iPhone (Safari):
1. Abre el enlace de vista previa de la app.
2. Toca el botón **Compartir** (el cuadrado con la flecha hacia arriba).
3. Busca y selecciona **"Añadir a la pantalla de inicio"**.
4. Confirma el nombre y toca **Añadir**.

### En Android (Chrome):
1. Abre el enlace de vista previa.
2. Toca los **tres puntos** verticales de la esquina superior derecha.
3. Selecciona **"Instalar aplicación"** o **"Añadir a la pantalla de inicio"**.

---

## 🔐 Roles y Accesos de Prueba
Durante esta fase de desarrollo, puedes saltar entre perfiles usando el **Simulador de Roles** en la esquina inferior derecha:

*   **👥 Socio Club**: Es la vista principal (`/`). Aquí puedes ver sellos, premios y el mapa.
*   **🏪 Emprendedor Aliado**: Vista para los locatarios (`/vendedor`). Permite escanear QRs.
*   **👑 Director del Patio**: Panel de gestión global (`/director`) con métricas.
*   **🛠️ Master Admin**: Control total (`/moderador`). 
    *   *Nota:* Para ver la **Zona de Pruebas**, asegúrate de estar logueado con el correo `ignaciiio.mate@gmail.com`.

---

## 🛠️ Tecnologías Utilizadas
- **Frontend**: Next.js 15, React 19, Tailwind CSS.
- **Backend**: Firebase (Auth, Firestore).
- **IA**: Google Genkit con Gemini 2.5 Flash para notificaciones persuasivas.
- **Móvil**: Capacitor 7 (listo para generar APK/IPA si se requiere).

---

## 📁 Estructura del Proyecto
- `src/app`: Rutas y páginas principales.
- `src/components`: Componentes reutilizables de UI y lógica.
- `src/lib`: Lógica de negocio (puntos, notificaciones, datos).
- `src/ai`: Flujos de Inteligencia Artificial.
