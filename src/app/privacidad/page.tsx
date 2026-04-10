"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacidadPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
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

      {/* Contenido */}
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Club Patio Curauma
          </p>
          <p className="text-xs text-slate-400">
            Conforme a la Ley N° 19.628 sobre Protección de la Vida Privada (Chile) ·
            Última actualización: 2026
          </p>
        </div>

        <Section title="1. Responsable del Tratamiento">
          El responsable del tratamiento de datos personales es{" "}
          <strong>Club Patio Curauma</strong>, plataforma de fidelización del centro
          comercial Patio Curauma, Valparaíso, Chile. Contacto:{" "}
          <a
            href="mailto:contacto@clubpatio.cl"
            className="underline"
            style={{ color: "#D3B673" }}
          >
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
              fecha de registro e historial de transacciones.
            </li>
            <li>
              <strong>Datos de dispositivo:</strong> Token de notificaciones push para
              el envío de alertas (solo si el usuario otorga permiso).
            </li>
          </ul>
        </Section>

        <Section title="3. Finalidad del Tratamiento">
          Los datos personales son utilizados para:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>Gestionar la cuenta de fidelización y el sistema de sellos y premios.</li>
            <li>Personalizar la experiencia dentro de la App.</li>
            <li>
              Enviar comunicaciones de marketing (ofertas, promociones, sorteos){" "}
              <strong>solo si el usuario ha dado su consentimiento expreso</strong> al
              registrarse.
            </li>
            <li>
              Cumplir con obligaciones legales y prevenir fraudes o usos indebidos de
              la plataforma.
            </li>
          </ul>
        </Section>

        <Section title="4. Base Legal">
          El tratamiento de datos se realiza con base en:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Consentimiento del titular</strong> (Art. 4 Ley 19.628): al
              registrarse, el usuario acepta expresamente estos términos.
            </li>
            <li>
              <strong>Ejecución de contrato</strong>: para prestar el servicio de
              fidelización contratado.
            </li>
            <li>
              <strong>Interés legítimo</strong>: para prevención de fraudes y seguridad
              de la plataforma.
            </li>
          </ul>
        </Section>

        <Section title="5. Almacenamiento y Seguridad">
          Los datos se almacenan en servidores seguros de{" "}
          <strong>Google Firebase</strong> (Firestore), con cifrado en tránsito (TLS) y
          en reposo. El acceso está restringido a personal autorizado.
        </Section>

        <Section title="6. Compartición de Datos">
          <strong>No vendemos ni compartimos</strong> datos personales con terceros para
          fines comerciales propios. Los datos solo pueden ser compartidos con:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              Locales comerciales adheridos al Club, en la medida estrictamente necesaria
              para validar canjes.
            </li>
            <li>
              Proveedores tecnológicos (Google Firebase) que actúan como encargados del
              tratamiento bajo acuerdos de confidencialidad.
            </li>
            <li>Autoridades competentes cuando sea requerido por ley.</li>
          </ul>
        </Section>

        <Section title="7. Derechos del Titular">
          Conforme a la Ley 19.628, el usuario tiene derecho a:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Acceso:</strong> Conocer qué datos personales tenemos sobre usted.
            </li>
            <li>
              <strong>Rectificación:</strong> Corregir datos inexactos o incompletos.
            </li>
            <li>
              <strong>Cancelación:</strong> Solicitar la eliminación de sus datos cuando
              ya no sean necesarios.
            </li>
            <li>
              <strong>Oposición:</strong> Oponerse al tratamiento de sus datos para fines
              de marketing en cualquier momento.
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Para ejercer sus derechos, contáctenos en{" "}
            <a
              href="mailto:contacto@clubpatio.cl"
              className="underline"
              style={{ color: "#D3B673" }}
            >
              contacto@clubpatio.cl
            </a>
            .
          </p>
        </Section>

        <Section title="8. Retención de Datos">
          Los datos se conservan mientras la cuenta esté activa. Al eliminar la cuenta,
          los datos son borrados en un plazo máximo de <strong>30 días</strong>, salvo
          obligación legal de conservarlos por mayor tiempo.
        </Section>

        <Section title="9. Cookies y Tecnologías de Seguimiento">
          La App utiliza almacenamiento local (<em>localStorage</em>) únicamente para
          mejorar la experiencia offline del usuario (caché de sellos). No utiliza
          cookies de seguimiento ni publicidad de terceros.
        </Section>

        <Section title="10. Modificaciones">
          Nos reservamos el derecho de actualizar esta política. Notificaremos cambios
          relevantes a través de la App.
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
