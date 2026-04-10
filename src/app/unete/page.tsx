
"use client";

import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import confetti from "canvas-confetti";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMAIL_MASTER_ADMIN = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
const EMAILS_EMPRENDEDORES = ["aliado@clubpatio.cl"];

export default function UnetePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(false); // Registro por defecto
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  
  const preventAutoRedirect = useRef(false);

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
        router.replace("/");
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
        router.replace("/");
      } else {
        if (!aceptaTerminos) throw new Error("Debes aceptar los términos de uso.");
        if (!nombre.trim()) throw new Error("Ingresa tu nombre completo.");
        if (!fechaNacimiento) throw new Error("Ingresa tu fecha de nacimiento.");

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        const emailLimpio = email.toLowerCase().trim();

        let rolAsignado = "cliente";
        if (emailLimpio === EMAIL_MASTER_ADMIN) rolAsignado = "admin";
        else if (EMAILS_EMPRENDEDORES.includes(emailLimpio)) rolAsignado = "emprendedor";

        const timestamp = new Date().toISOString();

        await setDoc(doc(db, "usuarios", newUser.uid), {
          id: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          rol: rolAsignado,
          comprasRealizadas: 1,
          puntos: 100,
          totalCanjesHistoricos: 0,
          ticketsSorteo: 0,
          recompensaDisponible: false,
          avatarId: "User",
          baneado: false,
          aceptaTerminos: true,
          aceptaMarketing: aceptaMarketing,
          fechaConsentimiento: timestamp,
          createdAt: timestamp,
        });

        await setDoc(doc(db, "leads_marketing", newUser.uid), {
          uid: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          aceptaMarketing: aceptaMarketing,
          aceptaTerminos: true,
          fechaRegistro: timestamp,
          fuente: "QR Registro - Club Patio",
        });

        toast({
          title: "¡Registro exitoso! 🌟",
          description: "Tu primer sello de regalo ya está en tu cuenta.",
        });
        setShowCelebration(true);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D3B673', '#9DCC65', '#6EBBD1']
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
          <div className="unete-card" style={{ padding: '40px 24px', textAlign: 'center', margin: 'auto 0' }}>
            <div style={{ width: '80px', height: '80px', margin: '0 auto 24px', background: '#9DCC65', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(157,204,101,0.4)', color: 'white' }}>
              <Gift style={{ width: 40, height: 40 }} />
            </div>
            <h2 className="unete-title" style={{ fontSize: '28px', marginBottom: '16px', color: '#4A4A4A' }}>¡Felicidades! 🎉</h2>
            <p className="unete-subtitle" style={{ fontSize: '15px', padding: '0 10px', marginBottom: '32px', color: '#4A4A4A', fontWeight: '500', lineHeight: 1.6 }}>
              Patio Curauma te ha regalado tu primer sello de bienvenida. ¡Ya estás más cerca de tu premio!
            </p>
            <Button onClick={() => router.replace("/")} style={{ width: '100%', height: '56px', borderRadius: '16px', backgroundColor: '#9DCC65', color: 'white', fontWeight: '900', fontSize: '16px' }} className="shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]">
              Ver mi tarjeta de sellos
            </Button>
          </div>
        ) : (
          <>
            {/* ===== Header: Logo + mensaje ===== */}
            <header className="unete-header">
          <div className="unete-logo-wrapper">
            <img src="/Logo.png" alt="Club Patio Curauma" className="unete-logo" />
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
              <span>Sello gratis</span>
            </div>
            <div className="unete-feature-pill">
              <Trophy className="unete-feature-icon" />
              <span>Sorteos</span>
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
              Registrarse
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
              Iniciar sesión
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
                <Label htmlFor="unete-nombre">Nombre Completo</Label>
                <div className="unete-input-wrapper">
                  <UserIcon className="unete-input-icon" />
                  <Input
                    id="unete-nombre"
                    type="text"
                    placeholder="Juan Pérez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    className="rounded-xl pl-10"
                  />
                </div>
              </div>
            )}

            <div className="unete-field">
              <Label htmlFor="unete-email">Correo Electrónico</Label>
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
                  <Label htmlFor="unete-phone">Teléfono (WhatsApp)</Label>
                  <div className="unete-input-wrapper">
                    <Phone className="unete-input-icon" />
                    <Input
                      id="unete-phone"
                      type="tel"
                      placeholder="+56 9 1234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="rounded-xl pl-10"
                    />
                  </div>
                </div>
                <div className="unete-field">
                  <Label htmlFor="unete-birthday">Fecha de Nacimiento</Label>
                  <div className="unete-input-wrapper">
                    <Calendar className="unete-input-icon" />
                    <Input
                      id="unete-birthday"
                      type="date"
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      required
                      className="rounded-xl pl-10"
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="unete-field">
              <Label htmlFor="unete-password">Contraseña</Label>
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

            {/* === Términos === */}
            {!isLogin && (
              <div className="unete-terms">
                <p className="unete-terms-title">Términos y Privacidad</p>

                <label className="unete-checkbox-label">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="unete-checkbox"
                  />
                  <span>
                    He leído y acepto los{" "}
                    <a href="#" className="unete-link" onClick={(e) => e.preventDefault()}>
                      Términos de Uso
                    </a>{" "}
                    del Club Patio. <span className="unete-required">*</span>
                  </span>
                </label>

                <label className="unete-checkbox-label">
                  <input
                    type="checkbox"
                    checked={aceptaMarketing}
                    onChange={(e) => setAceptaMarketing(e.target.checked)}
                    className="unete-checkbox"
                  />
                  <span>
                    Acepto recibir comunicaciones de marketing de Club Patio y sus aliados comerciales.
                  </span>
                </label>
              </div>
            )}

            {/* === Submit === */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-2xl text-base font-black gap-2 shadow-lg shadow-primary/30 transition-all duration-200 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.98]"
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
                setAceptaTerminos(false);
                setAceptaMarketing(false);
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
          background: linear-gradient(160deg, #faf4e6 0%, #ffffff 35%, #f8f9fa 70%, #f5edd8 100%);
          font-family: 'PT Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ━━━ Decorative Blobs ━━━ */
        .unete-decor {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.12;
          filter: blur(60px);
        }
        .unete-decor-1 {
          width: 300px;
          height: 300px;
          top: -100px;
          right: -80px;
          background: #D3B673;
          animation: float1 8s ease-in-out infinite alternate;
        }
        .unete-decor-2 {
          width: 200px;
          height: 200px;
          bottom: 120px;
          left: -60px;
          background: #9DCC65;
          animation: float2 10s ease-in-out infinite alternate;
        }
        .unete-decor-3 {
          width: 150px;
          height: 150px;
          top: 40%;
          right: -40px;
          background: #6EBBD1;
          animation: float3 12s ease-in-out infinite alternate;
        }
        @keyframes float1 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-30px, 40px) scale(1.1); }
        }
        @keyframes float2 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(20px, -30px) scale(1.15); }
        }
        @keyframes float3 {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-20px, 20px) scale(1.08); }
        }

        /* ━━━ Content Container ━━━ */
        .unete-container {
          position: relative;
          z-index: 1;
          max-width: 440px;
          margin: 0 auto;
          padding: 24px 20px 40px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.5s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ━━━ Header ━━━ */
        .unete-header {
          text-align: center;
          padding-top: env(safe-area-inset-top, 16px);
          margin-bottom: 24px;
        }
        .unete-logo-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 24px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          box-shadow: 0 4px 24px rgba(211, 182, 115, 0.15);
          margin-bottom: 20px;
          border: 1px solid rgba(211, 182, 115, 0.2);
        }
        .unete-logo {
          height: 44px;
          object-fit: contain;
        }
        .unete-hero-text {
          margin-bottom: 16px;
        }
        .unete-title {
          font-size: 28px;
          font-weight: 900;
          line-height: 1.15;
          color: #1a1a2e;
          letter-spacing: -0.5px;
          margin: 0 0 8px;
        }
        .unete-title-accent {
          background: linear-gradient(135deg, #D3B673, #9DCC65);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .unete-subtitle {
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
          max-width: 280px;
          margin: 0 auto;
          font-weight: 500;
        }

        /* ━━━ Feature Pills ━━━ */
        .unete-features {
          display: flex;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .unete-feature-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(211, 182, 115, 0.25);
          font-size: 11px;
          font-weight: 700;
          color: #8a7340;
          box-shadow: 0 2px 8px rgba(211, 182, 115, 0.1);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .unete-feature-icon {
          width: 14px;
          height: 14px;
          color: #D3B673;
        }

        /* ━━━ Card ━━━ */
        .unete-card {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(211, 182, 115, 0.15);
          border-radius: 24px;
          box-shadow:
            0 8px 32px rgba(0,0,0,0.06),
            0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
          flex: 1;
        }

        /* ━━━ Tabs ━━━ */
        .unete-card-tabs {
          display: flex;
          background: #faf8f2;
          border-bottom: 1px solid rgba(211, 182, 115, 0.12);
        }
        .unete-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px 8px;
          font-size: 13px;
          font-weight: 700;
          color: #94a3b8;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          font-family: inherit;
        }
        .unete-tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: transparent;
          transition: background 0.25s ease;
        }
        .unete-tab-active {
          color: #BFA05C;
          background: rgba(211, 182, 115, 0.06);
        }
        .unete-tab-active::after {
          background: #D3B673;
        }

        /* ━━━ Form ━━━ */
        .unete-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .unete-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .unete-input-wrapper {
          position: relative;
        }
        .unete-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: #94a3b8;
          pointer-events: none;
          z-index: 1;
        }

        /* ━━━ Terms ━━━ */
        .unete-terms {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
        }
        .unete-terms-title {
          font-size: 9px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0;
        }
        .unete-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }
        .unete-checkbox-label:hover span {
          color: #1e293b;
        }
        .unete-checkbox {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          margin-top: 2px;
          accent-color: #9DCC65;
          cursor: pointer;
        }
        .unete-link {
          color: #D3B673;
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .unete-required {
          color: #ef4444;
        }

        /* ━━━ Toggle button ━━━ */
        .unete-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          width: 100%;
          padding: 10px;
          background: transparent;
          border: none;
          font-size: 13px;
          color: #64748b;
          cursor: pointer;
          font-family: inherit;
          transition: color 0.2s;
        }
        .unete-toggle:hover {
          color: #D3B673;
        }
        .unete-toggle strong {
          color: #BFA05C;
          font-weight: 800;
        }

        /* ━━━ Footer ━━━ */
        .unete-footer {
          text-align: center;
          padding: 24px 0 8px;
          margin-top: auto;
        }
        .unete-footer p {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 300;
          margin: 0;
        }

        /* ━━━ Responsive — Larger phones / tablets ━━━ */
        @media (min-width: 400px) {
          .unete-title {
            font-size: 32px;
          }
          .unete-subtitle {
            font-size: 15px;
            max-width: 320px;
          }
          .unete-form {
            padding: 24px;
            gap: 16px;
          }
        }

        @media (min-width: 640px) {
          .unete-container {
            padding-top: 48px;
            padding-bottom: 48px;
            justify-content: center;
          }
          .unete-title {
            font-size: 36px;
          }
        }

        /* ━━━ Very small screens (iPhone SE, etc) ━━━ */
        @media (max-height: 700px) {
          .unete-header {
            margin-bottom: 16px;
          }
          .unete-logo-wrapper {
            margin-bottom: 12px;
            padding: 8px 20px;
          }
          .unete-logo {
            height: 36px;
          }
          .unete-title {
            font-size: 24px;
          }
          .unete-subtitle {
            font-size: 13px;
          }
          .unete-features {
            gap: 6px;
          }
          .unete-feature-pill {
            padding: 4px 10px;
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
