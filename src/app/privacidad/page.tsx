"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacidadPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-slate-100"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: "#D3B673" }} />
          <h1 className="font-black text-slate-800 text-base">Política de Privacidad</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Club Patio Curauma
          </p>
          <p className="text-xs text-slate-400">
            Conforme a la Ley N° 19.628 sobre Protección de la Vida Privada (Chile) ·
            Última actualización: mayo 2026
          </p>
        </div>

        <Section title="1. Responsable del Tratamiento">
          El responsable del tratamiento de datos personales es{" "}
          <strong>Club Patio Curauma</strong>, plataforma de fidelización del centro
          comercial Patio Curauma, Valparaíso, Chile. Contacto:{" "}
          <a href="mailto:contacto@clubpatio.cl" className="underline" style={{ color: "#D3B673" }}>
            contacto@clubpatio.cl
          </a>
        </Section>

        <Section title="2. Datos que Recopilamos">
          Al registrarse y usar la App recopilamos:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Datos de identificación:</strong> Nombre completo, correo
              electrónico, número de teléfono y fecha de nacimiento.
            </li>
            <li>
              <strong>Datos de actividad:</strong> Sellos acumulados, canjes realizados,
              fecha de registro e historial de transacciones dentro del Club.
            </li>
            <li>
              <strong>Datos de dispositivo:</strong> Token de notificaciones push (FCM)
              para el envío de alertas, solo si el usuario otorga permiso explícito.
            </li>
            <li>
              <strong>Datos de ubicación (primer plano):</strong> Coordenadas GPS
              aproximadas, utilizadas para mostrar el mapa del mall y calcular la
              distancia a locales adheridos.
            </li>
            <li>
              <strong>Datos de ubicación (segundo plano / background):</strong>{" "}
              Coordenadas GPS del dispositivo mientras la App está minimizada o con la
              pantalla apagada.{" "}
              <strong>
                Estas coordenadas se procesan exclusivamente en el dispositivo
              </strong>{" "}
              para detectar ingreso a geocercas (zonas de 100 metros de radio alrededor
              del mall) y activar notificaciones de bienvenida. No se transmiten ni
              almacenan en ningún servidor.
            </li>
          </ul>
        </Section>

        <Section title="3. Finalidad del Tratamiento">
          Los datos personales son utilizados para:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>Gestionar la cuenta de fidelización y el sistema de sellos y premios.</li>
            <li>
              <strong>Detectar la llegada física al mall (geofencing)</strong> para
              enviar notificaciones de bienvenida y ofertas relevantes exclusivamente
              cuando el usuario se encuentre dentro del radio del centro comercial.
            </li>
            <li>Personalizar la experiencia dentro de la App.</li>
            <li>
              Enviar comunicaciones de marketing (ofertas, promociones, sorteos){" "}
              <strong>solo con consentimiento expreso</strong> del usuario al registrarse.
            </li>
            <li>
              Cumplir con obligaciones legales y prevenir fraudes o usos indebidos de
              la plataforma.
            </li>
          </ul>
        </Section>

        <Section title="4. Uso de Ubicación en Segundo Plano">
          <p className="mb-3">
            La App solicita permiso de ubicación en segundo plano ("Permitir siempre")
            para una única función: el sistema de <strong>geocercas de proximidad</strong>.
          </p>
          <ul className="space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              Cuando el usuario activa esta función, la App monitorea la posición del
              dispositivo mediante un Servicio en Primer Plano visible (notificación
              persistente titulada "Club Patio activo") mientras la pantalla está apagada.
            </li>
            <li>
              Al detectar ingreso a una geocerca, se dispara una notificación local
              directamente en el dispositivo. No se envían coordenadas a servidores externos.
            </li>
            <li>
              El usuario puede revocar este permiso en cualquier momento desde
              Configuración &gt; Club Patio &gt; Ubicación.
            </li>
            <li>
              El sistema incluye un período de enfriamiento de 12 horas por ubicación
              para evitar notificaciones repetitivas.
            </li>
          </ul>
        </Section>

        <Section title="5. Base Legal">
          El tratamiento se realiza con base en:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Consentimiento del titular</strong> (Art. 4 Ley 19.628): el usuario
              acepta expresamente al registrarse y autoriza permisos de ubicación de forma
              explícita en el dispositivo.
            </li>
            <li>
              <strong>Ejecución de contrato:</strong> para prestar el servicio de
              fidelización contratado.
            </li>
            <li>
              <strong>Interés legítimo:</strong> para prevención de fraudes y seguridad
              de la plataforma.
            </li>
          </ul>
        </Section>

        <Section title="6. Almacenamiento y Seguridad">
          <ul className="space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              Los datos de perfil, sellos y transacciones se almacenan en{" "}
              <strong>Google Firebase Firestore</strong> con cifrado en tránsito (TLS 1.3)
              y en reposo (AES-256).
            </li>
            <li>
              Los datos de ubicación en segundo plano se procesan{" "}
              <strong>solo localmente en el dispositivo</strong> y nunca se almacenan en
              servidores.
            </li>
            <li>
              El acceso a los datos de la plataforma está restringido a personal
              autorizado mediante roles diferenciados (socio, vendedor, director,
              moderador).
            </li>
          </ul>
        </Section>

        <Section title="7. Compartición de Datos con Terceros">
          <strong>No vendemos ni compartimos</strong> datos personales con terceros para
          fines comerciales propios. Los datos solo pueden ser compartidos con:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Google Firebase</strong> (Firestore, Authentication, Cloud Messaging):
              proveedor de infraestructura, actúa como encargado del tratamiento bajo los
              Términos de Servicio de Google Cloud.
            </li>
            <li>
              <strong>Google Wallet:</strong> para la emisión de tarjetas de fidelización
              digitales, si el usuario lo solicita.
            </li>
            <li>
              <strong>Vercel Inc.:</strong> plataforma de alojamiento de la App Web, bajo
              acuerdo de confidencialidad.
            </li>
            <li>
              Locales comerciales adheridos al Club, en la medida estrictamente necesaria
              para validar canjes (se comparte el número de canje, no el perfil completo).
            </li>
            <li>Autoridades competentes cuando sea requerido por ley.</li>
          </ul>
        </Section>

        <Section title="8. Derechos del Titular">
          Conforme a la Ley 19.628, el usuario tiene derecho a:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li><strong>Acceso:</strong> conocer qué datos personales tenemos sobre usted.</li>
            <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
            <li>
              <strong>Cancelación / Eliminación:</strong> solicitar el borrado de su cuenta
              y datos asociados.
            </li>
            <li>
              <strong>Oposición:</strong> oponerse al tratamiento de sus datos para fines
              de marketing en cualquier momento.
            </li>
            <li>
              <strong>Portabilidad:</strong> recibir sus datos en formato estructurado.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Para ejercer sus derechos, contáctenos en{" "}
            <a href="mailto:contacto@clubpatio.cl" className="underline" style={{ color: "#D3B673" }}>
              contacto@clubpatio.cl
            </a>
            . Respondemos en un plazo máximo de 30 días hábiles.
          </p>
        </Section>

        <Section title="9. Retención de Datos">
          Los datos se conservan mientras la cuenta esté activa. Al solicitar la
          eliminación de la cuenta, los datos son borrados en un plazo máximo de{" "}
          <strong>30 días</strong>, salvo obligación legal de conservarlos por mayor tiempo.
          Los datos de ubicación no se retienen (procesamiento solo en memoria del dispositivo).
        </Section>

        <Section title="10. Menores de Edad">
          La App no está dirigida a menores de 14 años. No recopilamos conscientemente
          datos de menores de esa edad. Si detectamos que un menor se ha registrado,
          eliminaremos su cuenta de inmediato.
        </Section>

        <Section title="11. Cookies y Tecnologías de Seguimiento">
          La App utiliza almacenamiento local (<em>localStorage</em> y Capacitor
          Preferences) únicamente para mejorar la experiencia offline del usuario y
          gestionar preferencias locales. No utiliza cookies de seguimiento ni publicidad
          de terceros.
        </Section>

        <Section title="12. Modificaciones de Esta Política">
          Nos reservamos el derecho de actualizar esta política cuando sea necesario.
          Los cambios relevantes serán notificados a través de la App y/o por correo
          electrónico con al menos 15 días de anticipación.
        </Section>

        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Club Patio Curauma · Valparaíso, Chile · 2026
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-sm font-black uppercase tracking-wide mb-3"
        style={{ color: "#D3B673" }}
      >
        {title}
      </h2>
      <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}
