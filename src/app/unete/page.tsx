
"use client";

import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  LogIn,
  UserPlus,
  AlertCircle,
  Phone,
  Sparkles,
  User as UserIcon,
  Calendar,
  Loader2,
  Gift,
  Star,
  Trophy,
  ChevronRight,
  Mail,
  Lock,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TermsModal from "@/components/TermsModal";
import { registrarCompra } from "@/lib/puntos";
import { syncUserStampsToWallet } from "@/lib/walletSync";

import { ADMIN_EMAIL as EMAIL_MASTER_ADMIN } from "@/lib/constants";
const EMAILS_EMPRENDEDORES = ["aliado@clubpatio.cl"];

function generarCodigoReferido(nombre: string): string {
  const prefijo = nombre.trim().toUpperCase().replace(/\s/g, "").replace(/[^A-Z]/g, "").substring(0, 4).padEnd(4, "X");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sufijo = "";
  for (let i = 0; i < 4; i++) sufijo += chars[Math.floor(Math.random() * chars.length)];
  return `${prefijo}-${sufijo}`;
}

export default function UnetePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(false); // Registro por defecto
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [comuna, setComuna] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [aceptaPromoLocales, setAceptaPromoLocales] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [codigoReferido, setCodigoReferido] = useState("");
  const [comunaSeleccionada, setComunaSeleccionada] = useState("");
  const [step, setStep] = useState(1); // 1 = básico, 2 = adicional, 3 = términos

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo para recuperar la contraseña.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al enviar el correo");
      }

      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Error al enviar el correo. Intenta nuevamente.");
    } finally {
      setResetLoading(false);
    }
  };

  const preventAutoRedirect = useRef(false);

  // Capturar ?ref= del QR del locatario — persiste en localStorage para sobrevivir redirects OAuth
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem("referral_local_id", ref);
    }
  }, []);

  // Si ya está autenticado, redirigir al dashboard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (preventAutoRedirect.current) return;
      if (u) {
        const retornoAuto = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
        if (retornoAuto) localStorage.removeItem("url_retorno");
        router.replace(retornoAuto || "/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    let createdAuthUser: User | null = null;

    try {
      preventAutoRedirect.current = true;
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const u = userCredential.user;
        const userRef = doc(db, "usuarios", u.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          const data = snap.data();
          if (!data.bono_login_reclamado) {
            await updateDoc(userRef, {
              comprasRealizadas: increment(1),
              puntos: increment(50),
              bono_login_reclamado: true,
              lastUpdate: new Date().toISOString()
            });
            addDoc(collection(db, "system_logs"), {
              usuario: data.nombre || data.correo,
              usuarioId: u.uid,
              accion: "recibió un sello por Bono Único de Login",
              fecha: new Date().toISOString(),
              tipo: "FIDELIZACION",
              metodo: "SISTEMA"
            }).catch(() => {});
            toast({
              title: "¡Bono de Bienvenida! 🎉",
              description: "Te hemos regalado 1 sello extra por iniciar sesión.",
            });
          } else {
            toast({
              title: "¡Bienvenido de vuelta! 🎉",
              description: "Redirigiendo al Club Patio...",
            });
          }
        }
        const retorno = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
        if (retorno) localStorage.removeItem("url_retorno");
        router.replace(retorno || "/");
      } else {
        if (!aceptaTerminos) throw new Error("Debes aceptar los términos de uso.");
        if (!nombre.trim()) throw new Error("Ingresa tu nombre completo.");

        const normalizedPhone = phone.replace(/\s/g, "");

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        createdAuthUser = newUser;
        const emailLimpio = email.toLowerCase().trim();

        let rolAsignado = "cliente";
        if (emailLimpio === EMAIL_MASTER_ADMIN) rolAsignado = "admin";
        else if (EMAILS_EMPRENDEDORES.includes(emailLimpio)) rolAsignado = "emprendedor";

        const timestamp = new Date().toISOString();
        const miCodigo = generarCodigoReferido(nombre);
        const referralLocalId = typeof window !== "undefined"
          ? localStorage.getItem("referral_local_id")
          : null;

        // Actualizar perfil Auth y leer config en paralelo
        const [, configSnap] = await Promise.all([
          updateProfile(newUser, { displayName: nombre.trim() }),
          getDoc(doc(db, "configuracion", "general")).catch(() => null),
        ]);
        const configBienvenida = configSnap?.exists() ? configSnap.data()?.selloBienvenida : null;
        const bienvenidaActivo = configBienvenida?.activo !== false;
        const bienvenidaCantidad: number = Number(configBienvenida?.cantidad ?? 1);
        const sellosIniciales = referralLocalId ? 0 : (bienvenidaActivo ? bienvenidaCantidad : 0);
        const puntosIniciales = referralLocalId ? 50 : (bienvenidaActivo ? bienvenidaCantidad * 100 : 0);

        await Promise.all([
          setDoc(doc(db, "usuarios", newUser.uid), {
            id: newUser.uid,
            nombre: nombre.trim(),
            correo: emailLimpio,
            telefono: normalizedPhone,
            fechaNacimiento: fechaNacimiento,
            rol: rolAsignado,
            comprasRealizadas: sellosIniciales,
            puntos: puntosIniciales,
            totalCanjesHistoricos: 0,
            ticketsSorteo: 0,
            recompensaDisponible: false,
            avatarId: "User",
            baneado: false,
            aceptaTerminos: true,
            aceptaMarketing: aceptaMarketing,
            aceptaPromoLocales: aceptaPromoLocales,
            fechaConsentimiento: timestamp,
            createdAt: timestamp,
            comuna: comuna.trim(),
            codigoReferido: miCodigo,
            referidosExitosos: 0,
            bono_login_reclamado: true,
            ...(referralLocalId ? { referredByLocal: referralLocalId } : {}),
          }),
          setDoc(doc(db, "codigos_referido", miCodigo), {
            userId: newUser.uid,
            creadoEn: timestamp,
          }),
          setDoc(doc(db, "leads_marketing", newUser.uid), {
            uid: newUser.uid,
            nombre: nombre.trim(),
            correo: emailLimpio,
            telefono: normalizedPhone,
            fechaNacimiento: fechaNacimiento,
            comuna: comuna.trim(),
            aceptaMarketing: aceptaMarketing,
            aceptaPromoLocales: aceptaPromoLocales,
            aceptaTerminos: true,
            fechaRegistro: timestamp,
            fuente: "QR Registro - Club Patio",
          }),
        ]);

        // Atribución del sello de bienvenida
        if (referralLocalId) {
          // Vino de QR de locatario: sello atribuido al local (registrarCompra parte de 0 → 1)
          try {
            await registrarCompra(db, newUser.uid, referralLocalId, false, "REFERIDO");
            localStorage.removeItem("referral_local_id");
            // Limpiar url_retorno: el sello ya fue procesado aquí,
            // no debe ir a /canje de nuevo (evita doble sello)
            localStorage.removeItem("url_retorno");
          } catch {
            // No crítico: el usuario ya fue creado
          }
        } else if (bienvenidaActivo) {
          // Registro orgánico: log del sello de bienvenida + sync de Google Wallet
          addDoc(collection(db, "system_logs"), {
            usuario: nombre.trim(),
            usuarioId: newUser.uid,
            accion: `recibió ${bienvenidaCantidad} Sello${bienvenidaCantidad > 1 ? "s" : ""} de Bienvenida (registro orgánico)`,
            fecha: timestamp,
            tipo: "FIDELIZACION",
            metodo: "BIENVENIDA",
            cantidad: bienvenidaCantidad,
          }).catch(() => {});
          syncUserStampsToWallet(newUser.uid, bienvenidaCantidad);
        }

        // Procesar código de referido si se ingresó uno
        if (codigoReferido.trim()) {
          try {
            const idToken = await newUser.getIdToken();
            const res = await fetch("/api/referral/process", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ referralCode: codigoReferido.trim() }),
            });
            if (res.ok) {
              toast({
                title: "¡Código de referido aplicado! 🎁",
                description: "Ganaste 1 sello extra por unirte con un código de amigo.",
              });
            }
          } catch {
            // No crítico: el registro ya fue exitoso
          }
        }

        toast({
          title: "¡Registro exitoso! 🌟",
          description: "Tu primer sello de regalo ya está en tu cuenta.",
        });
        setShowCelebration(true);
        import("canvas-confetti").then((mod) => {
          const confetti = mod.default;
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#D3B673', '#9DCC65', '#6EBBD1']
          });
        });
      }
    } catch (err: any) {
      let message = err.message || "Ocurrió un error inesperado.";
      if (message.includes("email-already-in-use")) message = "Este correo ya está registrado. ¿Quizás quieres iniciar sesión?";
      if (message.includes("weak-password")) message = "La contraseña debe tener al menos 6 caracteres.";
      if (message.includes("invalid-email")) message = "El formato del correo electrónico no es válido.";
      if (message.includes("wrong-password") || message.includes("invalid-credential")) message = "Correo o contraseña incorrectos.";
      if (err?.code === "unavailable" || message.includes("IndexedDB") || message.includes("AbortError")) {
        // Si el usuario de Auth fue creado pero los datos de Firestore no pudieron guardarse,
        // eliminar la cuenta para evitar que quede "huérfana" (email-already-in-use en el siguiente intento)
        if (createdAuthUser) {
          try { await createdAuthUser.delete(); } catch {}
        }
        message = "Tu navegador bloqueó el almacenamiento local necesario para el registro. Abre esta página en una ventana normal (no privada/incógnito) e inténtalo de nuevo.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin) {
      if (step === 1) {
        if (!nombre.trim()) { setError("Ingresa tu nombre completo."); return; }
        if (!email.trim()) { setError("Ingresa tu correo electrónico."); return; }
        if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
        setStep(2);
        return;
      }
      if (step === 2) {
        if (!fechaNacimiento) { setError("Ingresa tu fecha de nacimiento."); return; }
        if (phone && !/^\+?56\s?9\s?\d{4}\s?\d{4}$/.test(phone.replace(/\s/g, ""))) {
          setError("Teléfono inválido. Usa formato +56 9 XXXX XXXX.");
          return;
        }
        setStep(3);
        return;
      }
    }

    handleAuth(e);
  };

  return (
    <div className="unete-page">
      {/* ===== Floating decorative elements ===== */}
      <div className="unete-decor unete-decor-1" />
      <div className="unete-decor unete-decor-2" />
      <div className="unete-decor unete-decor-3" />

      <div className="unete-container" style={showCelebration ? { justifyContent: 'center' } : {}}>
        {showCelebration ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: 'auto 0', width: '100%' }}>
            {/* === Sello de cortesía === */}
            <div className="unete-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
              {/* Animación del sello */}
              <div style={{
                width: '90px', height: '90px', margin: '0 auto 20px',
                background: 'linear-gradient(135deg, #9DCC65, #7ab84e)',
                borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 8px 28px rgba(157,204,101,0.45)',
                color: 'white', animation: 'bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <Gift style={{ width: 44, height: 44 }} />
              </div>

              <h2 className="unete-title" style={{ fontSize: '26px', marginBottom: '8px', color: '#2a2a2a' }}>
                ¡Bienvenido al Club! 🎉
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                Club Patio Curauma te regala tu primera estampilla de cortesía.
              </p>

              {/* Tarjeta visual con el sello */}
              <div style={{
                background: 'linear-gradient(135deg, #F7F9F0 0%, #EEF5E8 100%)',
                borderRadius: '20px', padding: '16px 20px', marginBottom: '20px',
                border: '2px solid rgba(157,204,101,0.3)',
                boxShadow: '0 4px 16px rgba(157,204,101,0.15)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: '#9DCC65', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>
                  Tu sello de cortesía ✓
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src="/Logo2.png"
                        alt={i === 0 ? "Sello activo" : "Sello pendiente"}
                        style={i === 0
                          ? { width: '100%', height: '100%', objectFit: 'contain' }
                          : { width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(100%) opacity(25%)' }}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px', fontWeight: '600' }}>
                  1 de 10 sellos obtenido
                </p>
              </div>

              <Button onClick={() => {
                const retorno = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
                if (retorno) localStorage.removeItem("url_retorno");
                router.replace(retorno || "/premios");
              }} style={{ width: '100%', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #9DCC65, #7ab84e)', color: 'white', fontWeight: '900', fontSize: '15px', border: 'none' }} className="shadow-lg transition-all hover:opacity-90 active:scale-[0.98]">
                Ver mi tarjeta de sellos →
              </Button>
            </div>

            {/* === Banner: Descarga la App === */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '24px', padding: '24px 20px',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '28px' }}>📱</span>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: '900', color: 'white', margin: 0 }}>
                    ¡Descarga la App!
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Club Patio Curauma
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { icon: '🔔', text: 'Notificaciones de premios y promociones en tiempo real' },
                  { icon: '📷', text: 'Escanea QR directamente desde la app sin abrir el navegador' },
                  { icon: '🗺️', text: 'Sigue tu ruta y desbloquea estampillas de cada local' },
                  { icon: '🎁', text: 'Canjea tus sellos y revisa tus premios disponibles' },
                  { icon: '📍', text: 'Alertas de geolocalización cuando estés cerca del patio' },
                ].map((feat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px', minWidth: '24px' }}>{feat.icon}</span>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.4 }}>{feat.text}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  // Trigger native PWA install prompt or link to store
                  if (typeof window !== 'undefined' && (window as any).deferredPwaPrompt) {
                    (window as any).deferredPwaPrompt.prompt();
                  } else {
                    // Fallback: scroll to banner or show toast
                    router.replace('/');
                  }
                }}
                style={{
                  width: '100%', height: '48px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #D3B673, #C9920A)',
                  color: 'white', fontWeight: '900', fontSize: '14px',
                  border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(201,146,10,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                className="transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <span>⬇️</span> Instalar App Gratis
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ===== Header: Logo + mensaje ===== */}
            <header className="unete-header">
          <div className="unete-logo-wrapper">
            <img src="/Logo3.webp" alt="Club Patio Curauma" className="unete-logo" />
          </div>
          <div className="unete-hero-text">
            <h1 className="unete-title">
              ¡Únete al Club<br />
              <span className="unete-title-accent">y gana premios!</span>
            </h1>
            <p className="unete-subtitle">
              Acumula sellos, canjea recompensas y participa en sorteos exclusivos
            </p>
          </div>

          {/* Feature pills */}
          <div className="unete-features">
            <div className="unete-feature-pill">
              <Gift className="unete-feature-icon" />
              <span>Sello Gratis</span>
            </div>
            <div className="unete-feature-pill">
              <MapPin className="unete-feature-icon" />
              <span>Ruta Geográfica</span>
            </div>
            <div className="unete-feature-pill">
              <Star className="unete-feature-icon" />
              <span>Premios</span>
            </div>
          </div>
        </header>

        {/* ===== Form Card ===== */}
        <div className="unete-card">
          {/* Card tab header */}
          <div className="unete-card-tabs">
            <button
              type="button"
              className={`unete-tab ${!isLogin ? "unete-tab-active" : ""}`}
              onClick={() => {
                setIsLogin(false);
                setError(null);
                setStep(1);
              }}
            >
              <UserPlus style={{ width: 16, height: 16 }} />
              Crear Cuenta
            </button>
            <button
              type="button"
              className={`unete-tab ${isLogin ? "unete-tab-active" : ""}`}
              onClick={() => {
                setIsLogin(true);
                setError(null);
                setStep(1);
              }}
            >
              <LogIn style={{ width: 16, height: 16 }} />
              Ingresar
            </button>
          </div>

          <form onSubmit={handleFormSubmit} noValidate className="unete-form">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* === Indicador de pasos (solo registro) === */}
            {!isLogin && (
              <div className="unete-steps">
                {(['Datos', 'Perfil', 'Confirmar'] as const).map((label, i) => (
                  <div key={i} className={`unete-step${step > i + 1 ? ' unete-step-done' : step === i + 1 ? ' unete-step-active' : ''}`}>
                    <div className="unete-step-dot">{step > i + 1 ? '✓' : i + 1}</div>
                    <span className="unete-step-label">{label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* === Paso 1 / Login: Nombre === */}
            {!isLogin && step === 1 && (
              <div className="unete-field">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[#D3B673]" />
                  <Label htmlFor="unete-nombre">Nombre Completo</Label>
                </div>
                <Input
                  id="unete-nombre"
                  type="text"
                  placeholder="Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
            )}

            {/* === Paso 1 / Login: Email === */}
            {(isLogin || step === 1) && (
              <div className="unete-field">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#D3B673]" />
                  <Label htmlFor="unete-email">Correo Electrónico</Label>
                </div>
                <Input
                  id="unete-email"
                  type="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            {/* === Paso 1 / Login: Contraseña === */}
            {(isLogin || step === 1) && (
              <div className="unete-field">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#D3B673]" />
                  <Label htmlFor="unete-password">Contraseña</Label>
                </div>
                <Input
                  id="unete-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl"
                  minLength={6}
                />
              </div>
            )}

            {/* === Solo login: Recuperar contraseña === */}
            {isLogin && (
              <div className="text-right" style={{ marginTop: -8 }}>
                {resetSent ? (
                  <p className="text-xs font-bold" style={{ color: "#9DCC65" }}>
                    ✅ Revisa tu correo para restablecer tu contraseña.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resetLoading}
                    className="unete-link text-xs font-bold"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    {resetLoading ? "Enviando..." : "¿Olvidaste tu contraseña?"}
                  </button>
                )}
              </div>
            )}

            {/* === Paso 2: Datos adicionales === */}
            {!isLogin && step === 2 && (
              <>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-phone">Teléfono (Opcional)</Label>
                  </div>
                  <Input
                    id="unete-phone"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-birthday">Fecha de Nacimiento</Label>
                  </div>
                  <Input
                    id="unete-birthday"
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="rounded-xl"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-comuna">Comuna / Región (Opcional)</Label>
                  </div>
                  <select
                    id="unete-comuna"
                    className="unete-select"
                    value={comunaSeleccionada}
                    onChange={(e) => {
                      const val = e.target.value;
                      setComunaSeleccionada(val);
                      if (val !== "otra") setComuna(val);
                      else setComuna("");
                    }}
                  >
                    <option value="">— Selecciona tu comuna —</option>
                    <optgroup label="Zona Curauma">
                      <option value="Curauma / Placilla">Curauma / Placilla</option>
                    </optgroup>
                    <optgroup label="Región de Valparaíso">
                      <option value="Valparaíso">Valparaíso</option>
                      <option value="Viña del Mar">Viña del Mar</option>
                      <option value="Quilpué">Quilpué</option>
                      <option value="Villa Alemana">Villa Alemana</option>
                      <option value="Concón">Concón</option>
                      <option value="San Antonio">San Antonio</option>
                      <option value="Casablanca">Casablanca</option>
                    </optgroup>
                    <optgroup label="Región Metropolitana">
                      <option value="Santiago">Santiago</option>
                      <option value="Providencia">Providencia</option>
                      <option value="Las Condes">Las Condes</option>
                      <option value="Ñuñoa">Ñuñoa</option>
                      <option value="La Florida">La Florida</option>
                      <option value="Maipú">Maipú</option>
                      <option value="Puente Alto">Puente Alto</option>
                    </optgroup>
                    <optgroup label="Otras ciudades">
                      <option value="Rancagua">Rancagua</option>
                      <option value="Concepción">Concepción</option>
                      <option value="Temuco">Temuco</option>
                      <option value="La Serena">La Serena</option>
                      <option value="Antofagasta">Antofagasta</option>
                      <option value="Iquique">Iquique</option>
                      <option value="Arica">Arica</option>
                      <option value="Puerto Montt">Puerto Montt</option>
                    </optgroup>
                    <option value="otra">Otra (escribir)...</option>
                  </select>
                  {comunaSeleccionada === "otra" && (
                    <Input
                      type="text"
                      placeholder="Escribe tu comuna o ciudad..."
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      className="rounded-xl"
                      autoFocus
                    />
                  )}
                </div>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-referido">Código de Referido (Opcional)</Label>
                  </div>
                  <Input
                    id="unete-referido"
                    type="text"
                    placeholder="Ej: JUAN-A3K9"
                    value={codigoReferido}
                    onChange={(e) => setCodigoReferido(e.target.value.toUpperCase())}
                    className="rounded-xl"
                    maxLength={9}
                  />
                </div>
              </>
            )}

            {/* === Paso 3: Términos === */}
            {!isLogin && step === 3 && (
              <div className="unete-terms">
                <p className="unete-terms-title">Términos y Privacidad</p>

                <label className={`unete-check-card ${aceptaTerminos ? "unete-check-card--checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="unete-checkbox"
                  />
                  <span className="unete-check-text">
                    He leído y acepto los{" "}
                    <button
                      type="button"
                      className="unete-link"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                      onClick={(e) => { e.stopPropagation(); setShowTerms(true); }}
                    >
                      Términos de Uso
                    </button>{" "}
                    del Club Patio. <span className="unete-required">*</span>
                  </span>
                </label>

                <label className={`unete-check-card ${aceptaMarketing ? "unete-check-card--checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={aceptaMarketing}
                    onChange={(e) => setAceptaMarketing(e.target.checked)}
                    className="unete-checkbox"
                  />
                  <span className="unete-check-text">
                    Acepto recibir noticias y comunicaciones generales de Club Patio.
                  </span>
                </label>

                <label className={`unete-check-card ${aceptaPromoLocales ? "unete-check-card--checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={aceptaPromoLocales}
                    onChange={(e) => setAceptaPromoLocales(e.target.checked)}
                    className="unete-checkbox"
                  />
                  <span className="unete-check-text">
                    Acepto recibir ofertas y promociones personalizadas de los locales del Patio que he visitado.
                  </span>
                </label>
              </div>
            )}

            {/* === Submit === */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl text-base font-black gap-2 transition-all duration-300 unete-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar al Club
                </>
              ) : step < 3 ? (
                <>
                  Continuar
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  ¡Quiero mi sello de regalo!
                </>
              )}
            </Button>

            {/* === Botón volver (pasos 2 y 3) === */}
            {!isLogin && step > 1 && (
              <button
                type="button"
                className="unete-toggle"
                onClick={() => { setStep(step - 1); setError(null); }}
              >
                ← Volver
              </button>
            )}

            {/* === Toggle login/register === */}
            <button
              type="button"
              className="unete-toggle"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setStep(1);
                setNombre("");
                setFechaNacimiento("");
                setComuna("");
                setComunaSeleccionada("");
                setCodigoReferido("");
                setAceptaTerminos(false);
                setAceptaMarketing(false);
                setAceptaPromoLocales(false);
              }}
            >
              {isLogin ? (
                <>
                  ¿No tienes cuenta? <strong>Regístrate aquí</strong>
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta? <strong>Inicia sesión aquí</strong>
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ===== Footer ===== */}
        <footer className="unete-footer">
          <p>Club Patio Curauma © {new Date().getFullYear()}</p>
        </footer>
          </>
        )}
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      {/* ========================================================= */}
      {/* Scoped Styles - Mobile First, Premium Design               */}
      {/* ========================================================= */}
      <style jsx>{`
        /* ━━━ Page Container ━━━ */
        .unete-page {
          position: fixed;
          inset: 0;
          z-index: 99999;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          background: #0f172a;
          background-image: 
            radial-gradient(at 0% 0%, rgba(211, 182, 115, 0.15) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(157, 204, 101, 0.1) 0px, transparent 50%);
          font-family: 'PT Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
        }

        /* ━━━ Decorative Blobs (static — blur animado es muy costoso en GPU móvil) ━━━ */
        .unete-decor {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.12;
          filter: blur(40px);
        }
        .unete-decor-1 {
          width: 300px;
          height: 300px;
          top: -80px;
          right: -80px;
          background: #D3B673;
        }
        .unete-decor-2 {
          width: 200px;
          height: 200px;
          bottom: 80px;
          left: -60px;
          background: #1e293b;
        }
        .unete-decor-3 {
          width: 160px;
          height: 160px;
          top: 50%;
          right: -40px;
          background: #334155;
        }

        /* ━━━ Content Container ━━━ */
        .unete-container {
          position: relative;
          z-index: 1;
          max-width: 440px;
          margin: 0 auto;
          padding: 32px 20px 40px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ━━━ Header ━━━ */
        .unete-header {
          text-align: center;
          padding-top: env(safe-area-inset-top, 24px);
          margin-bottom: 32px;
        }
        .unete-logo-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          background: rgba(30, 41, 59, 0.5);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          margin-bottom: 24px;
          border: 1px solid rgba(211, 182, 115, 0.3);
        }
        .unete-logo {
          height: 48px;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .unete-hero-text {
          margin-bottom: 20px;
        }
        .unete-title {
          font-size: 32px;
          font-weight: 900;
          line-height: 1.15;
          color: #f8fafc;
          letter-spacing: -0.5px;
          margin: 0 0 12px;
        }
        .unete-title-accent {
          background: linear-gradient(135deg, #D3B673, #F2D59B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .unete-subtitle {
          font-size: 15px;
          color: #94a3b8;
          line-height: 1.6;
          max-width: 300px;
          margin: 0 auto;
          font-weight: 400;
        }

        /* ━━━ Feature Pills ━━━ */
        .unete-features {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .unete-feature-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 100px;
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(211, 182, 115, 0.2);
          font-size: 12px;
          font-weight: 700;
          color: #D3B673;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          transition: all 0.3s ease;
        }
        .unete-feature-pill:hover {
          background: rgba(211, 182, 115, 0.1);
          border-color: rgba(211, 182, 115, 0.4);
          transform: translateY(-2px);
        }
        .unete-feature-icon {
          width: 14px;
          height: 14px;
          color: #D3B673;
        }

        /* ━━━ Card ━━━ */
        .unete-card {
          background: rgba(30, 41, 59, 0.4);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 28px;
          box-shadow:
            0 24px 48px rgba(0,0,0,0.2),
            inset 0 1px 1px rgba(255,255,255,0.05);
          overflow: hidden;
          flex: 1;
        }

        /* ━━━ Tabs ━━━ */
        .unete-card-tabs {
          display: flex;
          background: rgba(15, 23, 42, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .unete-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 18px 8px;
          font-size: 14px;
          font-weight: 700;
          color: #64748b;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          font-family: inherit;
        }
        .unete-tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: #D3B673;
          transition: width 0.3s ease;
        }
        .unete-tab-active {
          color: #D3B673;
          background: rgba(211, 182, 115, 0.05);
        }
        .unete-tab-active::after {
          width: 40px;
        }

        /* ━━━ Form ━━━ */
        .unete-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .unete-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        
        /* ━━━ Inputs overriding global styles ━━━ */
        .unete-form :global(input) {
          background: rgba(15, 23, 42, 0.6) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #f8fafc !important;
          height: 48px;
          padding: 0 16px;
          transition: all 0.3s ease;
        }
        .unete-form :global(input:focus) {
          border-color: #D3B673 !important;
          box-shadow: 0 0 0 3px rgba(211, 182, 115, 0.15) !important;
          background: rgba(15, 23, 42, 0.8) !important;
        }
        .unete-form :global(input::placeholder) {
          color: #475569 !important;
        }
        .unete-form :global(label) {
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 600;
        }

        /* ━━━ Select (comuna) ━━━ */
        .unete-select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          height: 48px;
          padding: 0 40px 0 16px;
          background-color: rgba(15, 23, 42, 0.6);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23D3B673' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          background-size: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #f8fafc;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .unete-select:focus {
          outline: none;
          border-color: #D3B673;
          box-shadow: 0 0 0 3px rgba(211, 182, 115, 0.15);
          background-color: rgba(15, 23, 42, 0.8);
        }
        .unete-select option,
        .unete-select optgroup {
          background-color: #1e293b;
          color: #f8fafc;
        }

        /* ━━━ Terms ━━━ */
        .unete-terms {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .unete-terms-title {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0;
        }

        /* Checkbox cards */
        .unete-check-card {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 48px;
          padding: 12px 16px;
          border-radius: 16px;
          background: rgba(15, 23, 42, 0.4);
          border: 1.5px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }
        .unete-check-card:hover {
          border-color: rgba(211, 182, 115, 0.5);
          background: rgba(211, 182, 115, 0.05);
        }
        .unete-check-card--checked {
          border-color: #D3B673;
          background: rgba(211, 182, 115, 0.1);
        }
        .unete-checkbox {
          width: 20px;
          height: 20px;
          min-width: 20px;
          flex-shrink: 0;
          accent-color: #D3B673;
          cursor: pointer;
        }
        .unete-check-text {
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.5;
          flex: 1;
        }
        .unete-link {
          color: #D3B673;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 4px;
          transition: color 0.2s;
        }
        .unete-link:hover {
          color: #F2D59B;
        }
        .unete-required {
          color: #ef4444;
        }

        /* ━━━ Submit Button ━━━ */
        .unete-submit-btn {
          background: linear-gradient(135deg, #D3B673, #BFA05C) !important;
          color: #0f172a !important;
          border: none !important;
          box-shadow: 0 8px 24px rgba(211, 182, 115, 0.25) !important;
        }
        .unete-submit-btn:hover {
          box-shadow: 0 12px 32px rgba(211, 182, 115, 0.4) !important;
          transform: translateY(-2px);
        }
        .unete-submit-btn:active {
          transform: translateY(0);
        }

        /* ━━━ Toggle button ━━━ */
        .unete-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 12px;
          background: transparent;
          border: none;
          font-size: 14px;
          color: #94a3b8;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.2s;
        }
        .unete-toggle:hover {
          color: #cbd5e1;
        }
        .unete-toggle strong {
          color: #D3B673;
          font-weight: 800;
        }

        /* ━━━ Footer ━━━ */
        .unete-footer {
          text-align: center;
          padding: 32px 0 16px;
          margin-top: auto;
        }
        .unete-footer p {
          font-size: 12px;
          color: #475569;
          font-weight: 400;
          margin: 0;
          letter-spacing: 0.5px;
        }

        /* ━━━ Very small screens (iPhone SE, etc) ━━━ */
        @media (max-height: 700px) {
          .unete-header {
            margin-bottom: 20px;
          }
          .unete-logo-wrapper {
            margin-bottom: 16px;
            padding: 10px 24px;
          }
          .unete-logo {
            height: 36px;
          }
          .unete-title {
            font-size: 26px;
          }
          .unete-subtitle {
            font-size: 14px;
          }
          .unete-form {
            gap: 16px;
          }
        }

        /* ━━━ Step Indicator ━━━ */
        .unete-steps {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          position: relative;
          padding: 0 8px;
          margin-bottom: 4px;
        }
        .unete-steps::before {
          content: '';
          position: absolute;
          top: 15px;
          left: calc(16.67% + 8px);
          right: calc(16.67% + 8px);
          height: 2px;
          background: rgba(255,255,255,0.08);
        }
        .unete-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
          position: relative;
          z-index: 1;
        }
        .unete-step-dot {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255,255,255,0.05);
          border: 2px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          color: #475569;
          transition: all 0.3s ease;
        }
        .unete-step-label {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: color 0.3s ease;
        }
        .unete-step-active .unete-step-dot {
          background: rgba(211,182,115,0.15);
          border-color: #D3B673;
          color: #D3B673;
          box-shadow: 0 0 0 4px rgba(211,182,115,0.1);
        }
        .unete-step-active .unete-step-label {
          color: #D3B673;
        }
        .unete-step-done .unete-step-dot {
          background: rgba(157,204,101,0.15);
          border-color: #9DCC65;
          color: #9DCC65;
        }
        .unete-step-done .unete-step-label {
          color: #9DCC65;
        }
      `}</style>
    </div>
  );
}
