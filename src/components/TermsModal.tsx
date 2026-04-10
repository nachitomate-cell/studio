"use client";

import { useEffect } from "react";
import { X, Scale } from "lucide-react";

interface TermsModalProps {
  onClose: () => void;
}

export default function TermsModal({ onClose }: TermsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex flex-col"
        style={{ maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pastilla superior */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-4 shrink-0" />

        {/* Cabecera — fija */}
        <div className="px-8 pt-6 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(211,182,115,0.15)", color: "#D3B673" }}
            >
              <Scale className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 space-y-1">
            <h2 className="text-xl font-black leading-snug" style={{ color: "#4A4A4A" }}>
              Términos y Condiciones
            </h2>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Club Patio Curauma
            </p>
          </div>
        </div>

        {/* Separador */}
        <div className="h-px bg-slate-100 mx-8 shrink-0" />

        {/* Contenido con scroll */}
        <div className="overflow-y-auto px-8 py-6 space-y-5 flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
          <Section title="1. Aceptación de los Términos">
            Al registrarse y utilizar la aplicación Club Patio Curauma (en adelante,{" "}
            <strong className="font-bold">"la App"</strong>), el usuario acepta estos
            Términos y Condiciones. Si no está de acuerdo, debe abstenerse de utilizar el
            servicio.
          </Section>

          <Section title="2. Descripción del Servicio">
            Club Patio Curauma es una plataforma de fidelización digital diseñada para
            digitalizar la experiencia de compra en el centro comercial Patio Curauma. La
            App permite a los usuarios:
            <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-slate-600 leading-relaxed">
              <li>Acumular sellos digitales por compras en locales adheridos.</li>
              <li>Recibir sellos de bienvenida o bonos por inicio de sesión.</li>
              <li>Canjear sellos por recompensas y beneficios exclusivos.</li>
            </ul>
          </Section>

          <Section title="3. Registro y Privacidad">
            El usuario se compromete a proporcionar información real y precisa (Nombre,
            Email, Teléfono, Fecha de Nacimiento).
            <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-slate-600 leading-relaxed">
              <li>
                <strong className="font-bold text-slate-700">Datos Personales:</strong>{" "}
                Los datos serán utilizados para la gestión de puntos, personalización de la
                experiencia y, en caso de ser aceptado por el usuario, para comunicaciones
                de marketing.
              </li>
              <li>
                <strong className="font-bold text-slate-700">Seguridad:</strong> El usuario
                es responsable de mantener la confidencialidad de su cuenta.
              </li>
            </ul>
          </Section>

          <Section title="4. El Sistema de Sellos y Recompensas">
            <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-slate-600 leading-relaxed">
              <li>
                <strong className="font-bold text-slate-700">Sello de Bienvenida:</strong>{" "}
                Se otorgará un (1) sello automático al momento del registro por única vez.
              </li>
              <li>
                <strong className="font-bold text-slate-700">Bono de Inicio de Sesión:</strong>{" "}
                Se podrá otorgar un (1) sello extra por inicio de sesión, sujeto a un
                límite de un solo uso por usuario (Bono de Única Vez).
              </li>
              <li>
                <strong className="font-bold text-slate-700">Acumulación:</strong> Los
                sellos por compra son otorgados exclusivamente por los locatarios
                autorizados mediante el escaneo de códigos o ingreso de PIN de validación.
              </li>
              <li>
                <strong className="font-bold text-slate-700">Valor:</strong> Los sellos no
                tienen valor monetario, no son transferibles ni pueden ser canjeados por
                dinero en efectivo.
              </li>
            </ul>
          </Section>

          <Section title="5. Proceso de Canje y Vigencia">
            <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-slate-600 leading-relaxed">
              <li>
                <strong className="font-bold text-slate-700">Generación de Ticket:</strong>{" "}
                Al completar los sellos requeridos, el usuario podrá generar un "Ticket de
                Canje".
              </li>
              <li>
                <strong className="font-bold text-slate-700">Vigencia:</strong> Cada ticket
                generado tiene una validez máxima de{" "}
                <strong className="font-bold">48 horas</strong>. Si el ticket no es
                validado en caja dentro de este plazo, expirará automáticamente y el
                beneficio se perderá.
              </li>
              <li>
                <strong className="font-bold text-slate-700">Validación:</strong> El
                beneficio se considera entregado una vez que el locatario valida el ticket
                en el sistema.
              </li>
            </ul>
          </Section>

          <Section title="6. Uso Justo y Medidas Anti-Fraude">
            <ul className="mt-2 space-y-1 list-disc pl-5 text-[13px] text-slate-600 leading-relaxed">
              <li>
                <strong className="font-bold text-slate-700">Límite de Tiempo (Cooldown):</strong>{" "}
                Un usuario no podrá recibir más de un sello en un periodo de{" "}
                <strong className="font-bold">12 horas</strong> para evitar abusos.
              </li>
              <li>
                <strong className="font-bold text-slate-700">Auditoría:</strong> La
                administración se reserva el derecho de auditar los registros del sistema.
                Cualquier actividad sospechosa resultará en la anulación de los puntos y la
                posible suspensión de la cuenta.
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
        </div>

        {/* Botón cerrar — fijo al fondo */}
        <div className="px-8 py-5 shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: "#D3B673", boxShadow: "0 4px 20px rgba(211,182,115,0.4)" }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "#D3B673" }}>
        {title}
      </p>
      <div className="text-[13px] text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}
