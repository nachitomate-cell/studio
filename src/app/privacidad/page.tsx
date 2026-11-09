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
          onClick={() => window.history.length > 1 ? router.back() : router.push("/")}
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
            Última actualización: noviembre 2026
          </p>
        </div>

        <Section title="1. Responsable del Tratamiento">
          El responsable del tratamiento de datos personales es{" "}
          <strong>Club Patio Curauma</strong>, plataforma de fidelización del centro
          comercial Patio Curauma, Valparaíso, Chile. Contacto:{" "}
          <a href="mailto:hola@synaptechspa.cl" className="underline" style={{ color: "#D3B673" }}>
            hola@synaptechspa.cl
          </a>
          . La App es desarrollada y operada técnicamente por SynapTech SpA, que actúa
          como encargado del tratamiento.
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

        <Section title="4. Uso de Ubicación (Aviso de llegada al Patio)">
          <p className="mb-3">
            La App puede usar la ubicación del dispositivo, incluso cuando está cerrada o
            no se está usando, para una única función: <strong>avisarte cuando llegas a
            Patio Curauma</strong> y recordarte tus sellos y premios. La función se activa
            solo si el usuario la acepta dentro de la App, después de ver esta explicación.
          </p>
          <ul className="space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              Funciona con las geocercas del sistema operativo (Android e iOS): el teléfono
              detecta por su cuenta la llegada a las zonas del Patio y muestra el aviso.
              No hay seguimiento continuo ni notificación permanente.
            </li>
            <li>
              Tus coordenadas y tu recorrido <strong>no se envían a nuestros servidores ni se
              guardan</strong>. Solo se registra que llegaste a una zona del Patio (por
              ejemplo, &quot;Outlet Curauma&quot;) y la hora, para medir el servicio y dejar
              el aviso en tu bandeja de mensajes.
            </li>
            <li>
              Hay un período de enfriamiento (un aviso por zona cada 24 horas como máximo) y
              no se envían avisos de noche.
            </li>
            <li>
              Puedes desactivarla en cualquier momento quitando el permiso de ubicación en
              los ajustes del teléfono (Ajustes &gt; Aplicaciones &gt; Club Patio &gt;
              Ubicación, o Ajustes &gt; Club Patio &gt; Ubicación en iPhone).
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
          <p id="eliminar-cuenta" className="mt-3 text-sm text-slate-600 scroll-mt-24">
            <strong>Eliminar tu cuenta:</strong> desde la App, en Mi perfil → Eliminar mi
            cuenta. Se borran de inmediato tu perfil, tus datos de contacto, tus mensajes y
            tu acceso. Los registros de sellos y canjes ya realizados se conservan en el
            historial de los locales, como respaldo contable.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Para ejercer cualquier otro derecho, o si no puedes entrar a la App, escríbenos a{" "}
            <a href="mailto:hola@synaptechspa.cl" className="underline" style={{ color: "#D3B673" }}>
              hola@synaptechspa.cl
            </a>
            . Respondemos en un plazo máximo de 30 días hábiles.
          </p>
        </Section>

        <Section title="9. Retención de Datos">
          Los datos se conservan mientras la cuenta esté activa. Al solicitar la
          eliminación de la cuenta, los datos son borrados en un plazo máximo de{" "}
          <strong>30 días</strong>, salvo obligación legal de conservarlos por mayor tiempo.
          Las coordenadas de ubicación no se retienen: solo se guarda la zona del Patio a la que llegaste y la hora.
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
