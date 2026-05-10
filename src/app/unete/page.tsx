
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

const EMAIL_MASTER_ADMIN = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com";
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
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [codigoReferido, setCodigoReferido] = useState("");

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
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (preventAutoRedirect.current) return;
      if (u) {
        // Verificar si está baneado
        const userRef = doc(db, "usuarios", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().baneado) {
          setCheckingAuth(false);
          return;
        }
        const retornoAuto = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
        if (retornoAuto) localStorage.removeItem("url_retorno");
        router.replace(retornoAuto || "/");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

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
            try {
              await addDoc(collection(db, "system_logs"), {
                usuario: data.nombre || data.correo,
                usuarioId: u.uid,
                accion: "recibió un sello por Bono Único de Login",
                fecha: new Date().toISOString(),
                tipo: "FIDELIZACION",
                metodo: "SISTEMA"
              });
            } catch(e) {}
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
        if (!fechaNacimiento) throw new Error("Ingresa tu fecha de nacimiento.");
        if (phone && !/^\+?56\s?9\s?\d{4}\s?\d{4}$/.test(phone.replace(/\s/g, ""))) {
          throw new Error("Teléfono inválido. Usa formato +56 9 XXXX XXXX.");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        const emailLimpio = email.toLowerCase().trim();

        // Setear displayName en Firebase Auth para que aparezca en el panel del vendedor
        await updateProfile(newUser, { displayName: nombre.trim() });

        let rolAsignado = "cliente";
        if (emailLimpio === EMAIL_MASTER_ADMIN) rolAsignado = "admin";
        else if (EMAILS_EMPRENDEDORES.includes(emailLimpio)) rolAsignado = "emprendedor";

        const timestamp = new Date().toISOString();
        const miCodigo = generarCodigoReferido(nombre);
        const referralLocalId = typeof window !== "undefined"
          ? localStorage.getItem("referral_local_id")
          : null;

        await setDoc(doc(db, "usuarios", newUser.uid), {
          id: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          rol: rolAsignado,
          comprasRealizadas: referralLocalId ? 0 : 1,
          puntos: referralLocalId ? 50 : 100,
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
        });

        // Registrar el código en la colección de búsqueda rápida
        await setDoc(doc(db, "codigos_referido", miCodigo), {
          userId: newUser.uid,
          creadoEn: timestamp,
        });

        await setDoc(doc(db, "leads_marketing", newUser.uid), {
          uid: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          comuna: comuna.trim(),
          aceptaMarketing: aceptaMarketing,
          aceptaPromoLocales: aceptaPromoLocales,
          aceptaTerminos: true,
          fechaRegistro: timestamp,
          fuente: "QR Registro - Club Patio",
        });

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
        } else {
          // Registro orgánico: log del sello de bienvenida + sync de Google Wallet
          try {
            await addDoc(collection(db, "system_logs"), {
              usuario: nombre.trim(),
              usuarioId: newUser.uid,
              accion: "recibió Sello de Bienvenida (registro orgánico)",
              fecha: timestamp,
              tipo: "FIDELIZACION",
              metodo: "BIENVENIDA",
            });
            syncUserStampsToWallet(newUser.uid, 1);
          } catch {
            // No crítico
          }
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
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de carga mientras se verifica autenticación
  if (checkingAuth) {
    return (
      <div className="unete-page">
        <div className="unete-loader">
          <Loader2 className="unete-spin-icon" />
        </div>

        <style jsx>{`
          .unete-page {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(160deg, #faf4e6 0%, #ffffff 40%, #f8f9fa 100%);
          }
          .unete-loader {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .unete-spin-icon {
            width: 40px;
            height: 40px;
            color: #D3B673;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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
              }}
            >
              <LogIn style={{ width: 16, height: 16 }} />
              Ingresar
            </button>
          </div>

          <form onSubmit={handleAuth} className="unete-form">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* === Registro fields === */}
            {!isLogin && (
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
                  required
                  className="rounded-xl"
                />
              </div>
            )}

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
                required
                className="rounded-xl"
              />
            </div>

            {!isLogin && (
              <>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-phone">Teléfono (WhatsApp)</Label>
                  </div>
                  <Input
                    id="unete-phone"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
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
                    required
                    className="rounded-xl"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="unete-field">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#D3B673]" />
                    <Label htmlFor="unete-comuna">Comuna / Región (Opcional)</Label>
                  </div>
                  <Input
                    id="unete-comuna"
                    type="text"
                    placeholder="Ej: Curauma, Valparaíso"
                    value={comuna}
                    onChange={(e) => setComuna(e.target.value)}
                    className="rounded-xl"
                  />
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
                required
                className="rounded-xl"
                minLength={6}
              />
            </div>

            {/* === Recuperar contraseña === */}
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

            {/* === Términos === */}
            {!isLogin && (
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
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  ¡Quiero mi sello de regalo!
                </>
              )}
            </Button>

            {/* === Toggle login/register === */}
            <button
              type="button"
              className="unete-toggle"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setNombre("");
                setFechaNacimiento("");
                setComuna("");
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

        /* ━━━ Decorative Blobs ━━━ */
        .unete-decor {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.15;
          filter: blur(80px);
        }
        .unete-decor-1 {
          width: 350px;
          height: 350px;
          top: -100px;
          right: -100px;
          background: #D3B673;
          animation: float1 10s ease-in-out infinite alternate;
        }
        .unete-decor-2 {
          width: 250px;
          height: 250px;
          bottom: 100px;
          left: -80px;
          background: #1e293b;
          animation: float2 12s ease-in-out infinite alternate;
        }
        .unete-decor-3 {
          width: 200px;
          height: 200px;
          top: 50%;
          right: -50px;
          background: #334155;
          animation: float3 14s ease-in-out infinite alternate;
        }
        @keyframes float1 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-40px, 50px) scale(1.1); }
        }
        @keyframes float2 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(30px, -40px) scale(1.15); }
        }
        @keyframes float3 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-30px, 30px) scale(1.08); }
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
      `}</style>
    </div>
  );
}
