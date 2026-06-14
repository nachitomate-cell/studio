"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SolicitudClubModal({ open, onClose }: Props) {
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "", rut: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.email.trim()) {
      setError("Nombre y email son obligatorios.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await addDoc(collection(db, "solicitudes_club"), {
        ...form,
        fecha: serverTimestamp(),
        estado: "pendiente",
      });
      setDone(true);
    } catch {
      setError("Error al enviar. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setForm({ nombre: "", email: "", telefono: "", rut: "" });
    setError("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.34, 1.1, 0.64, 1] }}
            className="fixed inset-x-4 bottom-4 z-50 rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "#FAFAF8", maxWidth: 460, margin: "0 auto" }}
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4" style={{ borderBottom: "1px solid #F0EDE8" }}>
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: "#F0EDE8" }}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
              <p style={{ fontSize: 9, letterSpacing: "3px", color: "#C9920A", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                Club Patio Curauma
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#1A1A1A", lineHeight: 1.1 }}>
                Únete al Club
              </h2>
              <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                Completa el formulario y te contactaremos pronto.
              </p>
            </div>

            {done ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 gap-3 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#EEF6F1" }}>
                  <CheckCircle2 className="w-8 h-8" style={{ color: "#4A7C59" }} />
                </div>
                <p style={{ fontSize: 17, fontWeight: 900, color: "#1A1A1A" }}>¡Solicitud enviada!</p>
                <p style={{ fontSize: 13, color: "#888" }}>Nos pondremos en contacto contigo a la brevedad.</p>
                <button
                  onClick={handleClose}
                  className="mt-2 px-8 py-2.5 rounded-2xl font-bold text-sm"
                  style={{ background: "linear-gradient(135deg, #C9920A, #E8C547)", color: "#1C1408" }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-3">
                {[
                  { key: "nombre", label: "Nombre completo", placeholder: "Ej: María González", type: "text", required: true },
                  { key: "email", label: "Correo electrónico", placeholder: "correo@email.com", type: "email", required: true },
                  { key: "telefono", label: "Teléfono", placeholder: "+56 9 1234 5678", type: "tel", required: false },
                  { key: "rut", label: "RUT", placeholder: "12.345.678-9", type: "text", required: false },
                ].map(({ key, label, placeholder, type, required }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.5px", display: "block", marginBottom: 5 }}>
                      {label}{required && <span style={{ color: "#C9920A" }}> *</span>}
                    </label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full h-11 px-4 rounded-2xl outline-none text-sm transition-all"
                      style={{ background: "#F5F3EF", border: "1.5px solid #EEEBE4", color: "#1A1A1A" }}
                    />
                  </div>
                ))}

                {error && (
                  <p style={{ fontSize: 12, color: "#C2185B", fontWeight: 600 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mt-1 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #C9920A 0%, #E8C547 100%)", color: "#1C1408", boxShadow: "0 4px 14px rgba(201,146,10,0.35)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar solicitud"}
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
