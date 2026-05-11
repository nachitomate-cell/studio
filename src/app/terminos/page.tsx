"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Scale } from "lucide-react";

export default function TerminosPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
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
          <Scale className="w-4 h-4" style={{ color: "#D3B673" }} />
          <h1 className="font-black text-slate-800 text-base">Términos y Condiciones</h1>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            Club Patio Curauma
          </p>
          <p className="text-xs text-slate-400">Última actualización: 2026</p>
        </div>

        <Section title="1. Aceptación de los Términos">
          Al registrarse y utilizar la aplicación Club Patio Curauma (en adelante,{" "}
          <strong>"la App"</strong>), el usuario acepta estos Términos y Condiciones. Si
          no está de acuerdo, debe abstenerse de utilizar el servicio.
        </Section>

        <Section title="2. Descripción del Servicio">
          Club Patio Curauma es una plataforma de fidelización digital diseñada para
          digitalizar la experiencia de compra en el centro comercial Patio Curauma. La
          App permite a los usuarios:
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>Acumular sellos digitales por compras en locales adheridos.</li>
            <li>Recibir sellos de bienvenida o bonos por inicio de sesión.</li>
            <li>Canjear sellos por recompensas y beneficios exclusivos.</li>
          </ul>
        </Section>

        <Section title="3. Registro y Privacidad">
          El usuario se compromete a proporcionar información real y precisa (Nombre,
          Email, Teléfono, Fecha de Nacimiento).
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Datos Personales:</strong> Los datos serán utilizados para la
              gestión de puntos, personalización de la experiencia y, en caso de ser
              aceptado por el usuario, para comunicaciones de marketing.
            </li>
            <li>
              <strong>Seguridad:</strong> El usuario es responsable de mantener la
              confidencialidad de su cuenta.
            </li>
          </ul>
        </Section>

        <Section title="4. El Sistema de Sellos y Recompensas">
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Sello de Bienvenida:</strong> Se otorgará un (1) sello automático
              al momento del registro por única vez.
            </li>
            <li>
              <strong>Bono de Inicio de Sesión:</strong> Se podrá otorgar un (1) sello
              extra por inicio de sesión, sujeto a un límite de un solo uso por usuario
              (Bono de Única Vez).
            </li>
            <li>
              <strong>Acumulación:</strong> Los sellos por compra son otorgados
              exclusivamente por los locatarios autorizados mediante el escaneo de códigos
              o ingreso de PIN de validación.
            </li>
            <li>
              <strong>Valor:</strong> Los sellos no tienen valor monetario, no son
              transferibles ni pueden ser canjeados por dinero en efectivo.
            </li>
          </ul>
        </Section>

        <Section title="5. Proceso de Canje y Vigencia">
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Generación de Ticket:</strong> Al completar los sellos requeridos,
              el usuario podrá generar un "Ticket de Canje".
            </li>
            <li>
              <strong>Vigencia:</strong> Cada ticket generado tiene una validez máxima de{" "}
              <strong>48 horas</strong>. Si el ticket no es validado en caja dentro de
              este plazo, expirará automáticamente y el beneficio se perderá.
            </li>
            <li>
              <strong>Validación:</strong> El beneficio se considera entregado una vez que
              el locatario valida el ticket en el sistema.
            </li>
          </ul>
        </Section>

        <Section title="6. Uso Justo y Medidas Anti-Fraude">
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              <strong>Límite de Tiempo (Cooldown):</strong> Un usuario no podrá recibir
              más de un sello en un periodo de <strong>12 horas</strong> para evitar
              abusos.
            </li>
            <li>
              <strong>Auditoría:</strong> La administración se reserva el derecho de
              auditar los registros del sistema. Cualquier actividad sospechosa resultará
              en la anulación de los puntos y la posible suspensión de la cuenta.
            </li>
          </ul>
        </Section>

        <Section title="7. Comunicaciones de Marketing">
          Al marcar la casilla correspondiente, el usuario acepta recibir información
          sobre ofertas y promociones vía correo electrónico o WhatsApp.
        </Section>

        <Section title="8. Limitación de Responsabilidad">
          Club Patio Curauma actúa como intermediario tecnológico. La disponibilidad de
          los premios es responsabilidad exclusiva de cada local comercial.
        </Section>

        <Section title="9. Modificaciones">
          La administración se reserva el derecho de modificar estos términos informando
          a los usuarios a través de la App.
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
