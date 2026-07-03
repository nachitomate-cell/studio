
"use client";

import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFriendlyErrorMessage } from "@/lib/firebaseErrors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LogIn, UserPlus, AlertCircle, Phone, Sparkles,
  User as UserIcon, Calendar, Loader2, Gift,
  ChevronRight, ChevronDown, Mail, Lock, MapPin,
  Eye, EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TermsModal from "@/components/TermsModal";
import { registrarCompra } from "@/lib/puntos";
import { syncUserStampsToWallet } from "@/lib/walletSync";
import { captureUTMParams, registrarVisitaUTM } from "@/lib/utmTracking";

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

  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+569");
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.startsWith("+569")) { setPhone("+569"); return; }
    setPhone(val);
  };
  const [nombre, setNombre] = useState("");
  const [diaNac, setDiaNac] = useState("");
  const [mesNac, setMesNac] = useState("");
  const [anioNac, setAnioNac] = useState("");
  const diaRef = useRef<HTMLInputElement>(null);
  const mesRef = useRef<HTMLInputElement>(null);
  const anioRef = useRef<HTMLInputElement>(null);
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
  const [showOptional, setShowOptional] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [comoNosConocio, setComoNosConocio] = useState("");

  const preventAutoRedirect = useRef(false);

  // Validación + composición de fecha YYYY-MM-DD desde los 3 campos
  const fechaNacimientoValida = (() => {
    if (!diaNac || !mesNac || !anioNac) return null;
    const d = Number(diaNac), m = Number(mesNac), y = Number(anioNac);
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
    if (y < 1900 || y > new Date().getFullYear()) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    if (dt.getTime() > Date.now()) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  })();
  const fechaNacimiento = fechaNacimientoValida ?? "";

  // Capturar ?ref= del QR del locatario y parámetros UTM
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) localStorage.setItem("referral_local_id", ref);
      const utm = captureUTMParams() ?? {
        utm_source: "qr",
        utm_medium: "qr",
        utm_campaign: "entrada_local",
        utm_content: "",
      };
      registrarVisitaUTM(utm, null);
    }
  }, []);

  // Redirigir si ya está autenticado
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

  const handlePasswordReset = async () => {
    if (!email.trim()) { setError("Ingresa tu correo para recuperar la contraseña."); return; }
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar el correo");
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

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
              lastUpdate: new Date().toISOString(),
            });
            addDoc(collection(db, "system_logs"), {
              usuario: data.nombre || data.correo,
              usuarioId: u.uid,
              accion: "recibió un sello por Bono Único de Login",
              fecha: new Date().toISOString(),
              tipo: "FIDELIZACION",
              metodo: "SISTEMA",
            }).catch(() => {});
            toast({ title: "¡Bono de Bienvenida! 🎉", description: "Te hemos regalado 1 sello extra por iniciar sesión." });
          } else {
            toast({ title: "¡Bienvenido de vuelta! 🎉", description: "Redirigiendo al Club Patio..." });
          }
        }
        const retorno = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
        if (retorno) localStorage.removeItem("url_retorno");
        router.replace(retorno || "/");

      } else {
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
        const referralLocalId = typeof window !== "undefined" ? localStorage.getItem("referral_local_id") : null;

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const dispositivo = /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "web";

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
            fechaNacimiento,
            rol: rolAsignado,
            comprasRealizadas: sellosIniciales,
            puntos: puntosIniciales,
            totalCanjesHistoricos: 0,
            ticketsSorteo: 0,
            recompensaDisponible: false,
            avatarId: "User",
            baneado: false,
            aceptaTerminos: true,
            aceptaMarketing,
            aceptaPromoLocales,
            fechaConsentimiento: timestamp,
            createdAt: timestamp,
            comuna: comuna.trim(),
            codigoReferido: miCodigo,
            referidosExitosos: 0,
            bono_login_reclamado: true,
            dispositivo,
            ...(comoNosConocio ? { comoNosConocio } : {}),
            ...(referralLocalId ? { referredByLocal: referralLocalId } : {}),
          }),
          setDoc(doc(db, "codigos_referido", miCodigo), { userId: newUser.uid, creadoEn: timestamp }),
          setDoc(doc(db, "leads_marketing", newUser.uid), {
            uid: newUser.uid,
            nombre: nombre.trim(),
            correo: emailLimpio,
            telefono: normalizedPhone,
            fechaNacimiento,
            comuna: comuna.trim(),
            aceptaMarketing,
            aceptaPromoLocales,
            aceptaTerminos: true,
            fechaRegistro: timestamp,
            fuente: "QR Registro - Club Patio",
            dispositivo,
            ...(comoNosConocio ? { comoNosConocio } : {}),
          }),
        ]);

        if (referralLocalId) {
          try {
            await registrarCompra(db, newUser.uid, referralLocalId, false, "REFERIDO");
            localStorage.removeItem("referral_local_id");
            localStorage.removeItem("url_retorno");
          } catch { /* no crítico */ }
        } else if (bienvenidaActivo) {
          // Trazabilidad de origen. Los QR físicos están impresos con la URL base
          // (sin params), así que el default es "qr". Solo marcamos Instagram cuando
          // el parámetro es explícito o llega el fbclid (IG lo añade siempre).
          const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
          const rawSource = (urlParams?.get("source") || urlParams?.get("utm_source") || "").toLowerCase();
          const hasFbclid = !!urlParams?.get("fbclid");
          const origenBienvenida = rawSource === "instagram" || hasFbclid ? "instagram" : "qr";

          addDoc(collection(db, "system_logs"), {
            usuario: nombre.trim(),
            usuarioId: newUser.uid,
            accion: `recibió ${bienvenidaCantidad} Sello${bienvenidaCantidad > 1 ? "s" : ""} de Bienvenida (registro orgánico)`,
            fecha: timestamp,
            tipo: "FIDELIZACION",
            metodo: "BIENVENIDA",
            cantidad: bienvenidaCantidad,
            origenBienvenida,
          }).catch(() => {});
          syncUserStampsToWallet(newUser.uid, bienvenidaCantidad);
        }

        if (codigoReferido.trim()) {
          try {
            const idToken = await newUser.getIdToken();
            const res = await fetch("/api/referral/process", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
              body: JSON.stringify({ referralCode: codigoReferido.trim() }),
            });
            if (res.ok) toast({ title: "¡Código de referido aplicado! 🎁", description: "Ganaste 1 sello extra por unirte con un código de amigo." });
          } catch { /* no crítico */ }
        }

        toast({ title: "¡Registro exitoso! 🌟", description: "Tu primer sello de regalo ya está en tu cuenta." });
        setShowCelebration(true);
        import("canvas-confetti").then((mod) => {
          mod.default({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ["#D3B673", "#9DCC65", "#6EBBD1"] });
        });
      }
    } catch (err: any) {
      const raw: string = err?.message || "";
      let message = getFriendlyErrorMessage(err);
      // Caso especial (no es de Auth): el navegador bloqueó IndexedDB (modo privado, etc.).
      if (err?.code === "unavailable" || raw.includes("IndexedDB") || raw.includes("AbortError")) {
        if (createdAuthUser) { try { await createdAuthUser.delete(); } catch {} }
        message = "Tu navegador bloqueó el almacenamiento local. Abre esta página en una ventana normal (no privada) e inténtalo de nuevo.";
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
      if (!nombre.trim()) { setError("Ingresa tu nombre completo."); return; }
      if (!email.trim()) { setError("Ingresa tu correo electrónico."); return; }
      if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
      if (!comunaSeleccionada) { setError("Selecciona tu comuna o ciudad."); return; }
      if (!phone.trim()) { setError("Ingresa tu número de teléfono."); return; }
      if (!/^\+?56\s?9\s?\d{4}\s?\d{4}$/.test(phone.replace(/\s/g, ""))) {
        setError("Teléfono inválido. Usa formato +56 9 XXXX XXXX."); return;
      }
      if (!diaNac || !mesNac || !anioNac) { setError("Ingresa tu fecha de nacimiento."); return; }
      if (!fechaNacimientoValida) { setError("La fecha de nacimiento no es válida. Revisa día, mes y año."); return; }
      if (!aceptaTerminos) { setError("Debes aceptar los términos de uso para continuar."); return; }
    }
    handleAuth(e);
  };

  const resetForm = () => {
    setError(null);
    setNombre(""); setDiaNac(""); setMesNac(""); setAnioNac(""); setComuna(""); setComunaSeleccionada("");
    setCodigoReferido(""); setAceptaTerminos(false); setAceptaMarketing(false);
    setAceptaPromoLocales(false); setShowOptional(false); setShowPassword(false);
    setResetSent(false); setComoNosConocio("");
  };

  return (
    <div className="u-page">
      {/* Blobs decorativos estáticos */}
      <div className="u-blob u-blob-1" />
      <div className="u-blob u-blob-2" />

      <div className="u-container" style={showCelebration ? { justifyContent: "center" } : {}}>
        {showCelebration ? (

          /* ── Pantalla de celebración ── */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
            <div className="u-card" style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{
                width: 80, height: 80, margin: "0 auto 20px",
                background: "linear-gradient(135deg, #9DCC65, #7ab84e)",
                borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", boxShadow: "0 8px 28px rgba(157,204,101,0.45)",
                animation: "bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1)",
              }}>
                <Gift style={{ width: 40, height: 40, color: "white" }} />
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: "#f8fafc", margin: "0 0 8px" }}>
                ¡Bienvenido al Club! 🎉
              </h2>
              <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20, lineHeight: 1.6 }}>
                Club Patio Curauma te regala tu primera estampilla de cortesía.
              </p>
              <div style={{
                background: "linear-gradient(135deg, rgba(157,204,101,0.12), rgba(157,204,101,0.06))",
                borderRadius: 20, padding: "16px 20px", marginBottom: 20,
                border: "1px solid rgba(157,204,101,0.25)",
              }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: "#9DCC65", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>
                  Tu sello de cortesía ✓
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src="/Logo2.png" alt=""
                        style={i === 0
                          ? { width: "100%", height: "100%", objectFit: "contain" }
                          : { width: "100%", height: "100%", objectFit: "contain", filter: "grayscale(100%) opacity(20%)" }}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10, fontWeight: 600 }}>1 de 10 sellos obtenido</p>
              </div>
              <Button
                onClick={() => {
                  const retorno = typeof window !== "undefined" ? localStorage.getItem("url_retorno") : null;
                  if (retorno) localStorage.removeItem("url_retorno");
                  router.replace(retorno || "/premios");
                }}
                style={{
                  width: "100%", height: 52, borderRadius: 16,
                  background: "linear-gradient(135deg, #9DCC65, #7ab84e)",
                  color: "white", fontWeight: 900, fontSize: 15, border: "none",
                }}
                className="shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Ver mi tarjeta de sellos →
              </Button>
            </div>

            {/* Banner app */}
            <div style={{
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
              borderRadius: 24, padding: "20px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>📱</span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 900, color: "white", margin: 0 }}>¡Descarga la App!</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: 0, letterSpacing: "1px", textTransform: "uppercase" }}>Club Patio Curauma</p>
                </div>
              </div>
              {[
                { icon: "🔔", text: "Notificaciones de premios en tiempo real" },
                { icon: "📷", text: "Escanea QR sin abrir el navegador" },
                { icon: "🎁", text: "Canjea sellos y revisa tus premios" },
              ].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16, minWidth: 22 }}>{f.icon}</span>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.4 }}>{f.text}</p>
                </div>
              ))}
              <button
                onClick={() => {
                  if (typeof window !== "undefined" && (window as any).deferredPwaPrompt) {
                    (window as any).deferredPwaPrompt.prompt();
                  } else {
                    router.replace("/");
                  }
                }}
                style={{
                  width: "100%", height: 46, borderRadius: 14, marginTop: 12,
                  background: "linear-gradient(135deg, #D3B673, #C9920A)",
                  color: "white", fontWeight: 900, fontSize: 14,
                  border: "none", cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(201,146,10,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
                className="transition-all hover:opacity-90 active:scale-[0.98]"
              >
                ⬇️ Instalar App Gratis
              </button>
            </div>
          </div>

        ) : (

          /* ── Formulario principal ── */
          <>
            {/* Header compacto */}
            <header className="u-header">
              <div className="u-logo-wrap">
                <img src="/Logo3.webp" alt="Club Patio Curauma" className="u-logo" />
              </div>
              <h1 className="u-title">
                {isLogin
                  ? "Bienvenido de vuelta"
                  : <><span className="u-accent">¡Únete al Club</span> y gana tu primer sello gratis! 🎁</>
                }
              </h1>
            </header>

            {/* Card */}
            <div className="u-card">
              {/* Tabs */}
              <div className="u-tabs">
                <button type="button" className={`u-tab ${!isLogin ? "u-tab--active" : ""}`}
                  onClick={() => { setIsLogin(false); resetForm(); }}>
                  <UserPlus style={{ width: 15, height: 15 }} />
                  Crear cuenta
                </button>
                <button type="button" className={`u-tab ${isLogin ? "u-tab--active" : ""}`}
                  onClick={() => { setIsLogin(true); resetForm(); }}>
                  <LogIn style={{ width: 15, height: 15 }} />
                  Ya tengo cuenta
                </button>
              </div>

              <form onSubmit={handleFormSubmit} noValidate className="u-form">

                {/* Error */}
                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400 py-2 px-3">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <AlertDescription className="text-xs ml-1">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Nombre (solo registro) */}
                {!isLogin && (
                  <div className="u-field">
                    <Label htmlFor="u-nombre" className="u-label">
                      <UserIcon className="u-label-icon" /> Nombre completo
                    </Label>
                    <Input id="u-nombre" type="text" placeholder="Juan Pérez"
                      value={nombre} onChange={(e) => setNombre(e.target.value)}
                      className="u-input" autoFocus autoComplete="name" />
                  </div>
                )}

                {/* Email */}
                <div className="u-field">
                  <Label htmlFor="u-email" className="u-label">
                    <Mail className="u-label-icon" /> Correo electrónico
                  </Label>
                  <Input id="u-email" type="email" placeholder="tu@ejemplo.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="u-input" autoFocus={isLogin} autoComplete="email" />
                </div>

                {/* Password */}
                <div className="u-field">
                  <Label htmlFor="u-password" className="u-label">
                    <Lock className="u-label-icon" /> Contraseña
                  </Label>
                  <div className="u-pass-wrap">
                    <Input id="u-password" type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="u-input u-input--pass" minLength={6}
                      autoComplete={isLogin ? "current-password" : "new-password"} />
                    <button type="button" className="u-eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Comuna (obligatoria, solo registro) */}
                {!isLogin && (
                  <div className="u-field">
                    <Label htmlFor="u-comuna" className="u-label">
                      <MapPin className="u-label-icon" /> Comuna <span style={{ color: "#ef4444" }}>*</span>
                    </Label>
                    <select id="u-comuna" className="u-select" value={comunaSeleccionada}
                      onChange={(e) => {
                        const val = e.target.value;
                        setComunaSeleccionada(val);
                        if (val !== "otra") setComuna(val); else setComuna("");
                      }}>
                      <option value="">— Selecciona tu ciudad —</option>
                      <optgroup label="Zona Curauma"><option value="Curauma / Placilla">Curauma / Placilla</option></optgroup>
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
                      <option value="otra">Otra...</option>
                    </select>
                    {comunaSeleccionada === "otra" && (
                      <Input type="text" placeholder="Escribe tu ciudad..."
                        value={comuna} onChange={(e) => setComuna(e.target.value)} className="u-input" style={{ marginTop: 6 }} autoFocus />
                    )}
                  </div>
                )}

                {/* Teléfono (obligatorio, solo registro) */}
                {!isLogin && (
                  <div className="u-field">
                    <Label htmlFor="u-phone" className="u-label">
                      <Phone className="u-label-icon" /> Teléfono <span style={{ color: "#ef4444" }}>*</span>
                    </Label>
                    <Input id="u-phone" type="tel" placeholder="+569 1234 5678"
                      value={phone} onChange={handlePhoneChange}
                      className="u-input" autoComplete="tel" />
                  </div>
                )}

                {/* Fecha de nacimiento (obligatoria, solo registro) */}
                {!isLogin && (
                  <div className="u-field">
                    <Label htmlFor="u-bday-d" className="u-label">
                      <Calendar className="u-label-icon" /> Fecha de nacimiento <span style={{ color: "#ef4444" }}>*</span>
                    </Label>
                    <div className="u-bday">
                      <input
                        ref={diaRef}
                        id="u-bday-d"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="DD"
                        maxLength={2}
                        autoComplete="bday-day"
                        value={diaNac}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                          setDiaNac(v);
                          if (v.length === 2) mesRef.current?.focus();
                        }}
                        className="u-input u-bday-input"
                        aria-label="Día"
                      />
                      <span className="u-bday-sep">/</span>
                      <input
                        ref={mesRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="MM"
                        maxLength={2}
                        autoComplete="bday-month"
                        value={mesNac}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                          setMesNac(v);
                          if (v.length === 2) anioRef.current?.focus();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && mesNac === "") diaRef.current?.focus();
                        }}
                        className="u-input u-bday-input"
                        aria-label="Mes"
                      />
                      <span className="u-bday-sep">/</span>
                      <input
                        ref={anioRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="AAAA"
                        maxLength={4}
                        autoComplete="bday-year"
                        value={anioNac}
                        onChange={(e) => setAnioNac(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        onKeyDown={(e) => {
                          if (e.key === "Backspace" && anioNac === "") mesRef.current?.focus();
                        }}
                        className="u-input u-bday-input u-bday-input--year"
                        aria-label="Año"
                      />
                    </div>
                  </div>
                )}

                {/* ¿Olvidaste contraseña? (solo login) */}
                {isLogin && (
                  <div style={{ textAlign: "right", marginTop: -8 }}>
                    {resetSent ? (
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#9DCC65" }}>✅ Revisa tu correo.</p>
                    ) : (
                      <button type="button" onClick={handlePasswordReset} disabled={resetLoading}
                        className="u-link" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12 }}>
                        {resetLoading ? "Enviando..." : "¿Olvidaste tu contraseña?"}
                      </button>
                    )}
                  </div>
                )}

                {/* Datos opcionales (solo registro) */}
                {!isLogin && (
                  <div className="u-optional">
                    <button type="button" className="u-optional-toggle" onClick={() => setShowOptional(!showOptional)}>
                      <ChevronDown className={`u-optional-arrow ${showOptional ? "u-optional-arrow--open" : ""}`} />
                      Agregar datos opcionales
                    </button>
                    {showOptional && (
                      <div className="u-optional-body">
                        <div className="u-field">
                          <Label htmlFor="u-ref" className="u-label u-label--sm">
                            <Gift className="u-label-icon" /> Código de referido
                          </Label>
                          <Input id="u-ref" type="text" placeholder="Ej: JUAN-A3K9"
                            value={codigoReferido} onChange={(e) => setCodigoReferido(e.target.value.toUpperCase())}
                            className="u-input" maxLength={9} />
                        </div>
                        <div className="u-field">
                          <Label htmlFor="u-conocio" className="u-label u-label--sm">
                            <Sparkles className="u-label-icon" /> ¿Cómo nos conociste?
                          </Label>
                          <select id="u-conocio" className="u-select" value={comoNosConocio}
                            onChange={(e) => setComoNosConocio(e.target.value)}>
                            <option value="">— Selecciona una opción —</option>
                            <option value="amigo">Me lo recomendó un amigo/a</option>
                            <option value="redes_sociales">Redes sociales (Instagram, Facebook...)</option>
                            <option value="qr_local">Escaneé el QR en un local</option>
                            <option value="flyer">Vi un flyer o afiche</option>
                            <option value="paso_por_ahi">Pasé por el Patio y lo vi</option>
                            <option value="otro">Otra forma</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Términos inline (solo registro) */}
                {!isLogin && (
                  <div className="u-terms">
                    <label className={`u-check ${aceptaTerminos ? "u-check--on" : ""}`}>
                      <input type="checkbox" checked={aceptaTerminos}
                        onChange={(e) => setAceptaTerminos(e.target.checked)} className="u-checkbox" />
                      <span className="u-check-text">
                        Acepto los{" "}
                        <button type="button" className="u-link"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
                          onClick={(e) => { e.stopPropagation(); setShowTerms(true); }}>
                          Términos de Uso
                        </button>{" "}
                        <span style={{ color: "#ef4444" }}>*</span>
                      </span>
                    </label>
                    <label className={`u-check ${aceptaMarketing ? "u-check--on" : ""}`}>
                      <input type="checkbox" checked={aceptaMarketing}
                        onChange={(e) => setAceptaMarketing(e.target.checked)} className="u-checkbox" />
                      <span className="u-check-text">Recibir novedades y promociones del Club</span>
                    </label>
                  </div>
                )}

                {/* CTA */}
                <Button type="submit" disabled={loading} className="u-submit">
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                  ) : isLogin ? (
                    <><LogIn className="w-5 h-5" /> Entrar al Club</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> ¡Quiero mi sello de regalo!</>
                  )}
                </Button>

                {/* Toggle */}
                <button type="button" className="u-toggle"
                  onClick={() => { setIsLogin(!isLogin); resetForm(); }}>
                  {isLogin
                    ? <>¿No tienes cuenta? <strong>Regístrate gratis</strong><ChevronRight style={{ width: 15, height: 15 }} /></>
                    : <>¿Ya tienes cuenta? <strong>Inicia sesión</strong><ChevronRight style={{ width: 15, height: 15 }} /></>
                  }
                </button>
              </form>
            </div>

            <footer className="u-footer">
              <p>Club Patio Curauma © {new Date().getFullYear()}</p>
            </footer>
          </>
        )}
      </div>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <style jsx>{`
        /* ── Page ── */
        .u-page {
          position: fixed;
          inset: 0;
          z-index: 99999;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background: #0f172a;
          background-image:
            radial-gradient(at 10% 10%, rgba(211,182,115,0.12) 0px, transparent 55%),
            radial-gradient(at 90% 90%, rgba(157,204,101,0.08) 0px, transparent 55%);
          font-family: 'PT Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
        }

        /* ── Blobs estáticos ── */
        .u-blob {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.10;
          filter: blur(40px);
        }
        .u-blob-1 { width: 280px; height: 280px; top: -80px; right: -60px; background: #D3B673; }
        .u-blob-2 { width: 180px; height: 180px; bottom: 60px; left: -50px; background: #9DCC65; }

        /* ── Container ── */
        .u-container {
          position: relative;
          z-index: 1;
          max-width: 420px;
          margin: 0 auto;
          padding: 24px 16px 40px;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ── Header ── */
        .u-header {
          text-align: center;
          padding-top: env(safe-area-inset-top, 16px);
          margin-bottom: 20px;
        }
        .u-logo-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 24px;
          background: rgba(30,41,59,0.5);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 20px;
          border: 1px solid rgba(211,182,115,0.25);
          margin-bottom: 16px;
        }
        .u-logo {
          height: 40px;
          object-fit: contain;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        .u-title {
          font-size: 22px;
          font-weight: 800;
          line-height: 1.3;
          color: #f8fafc;
          letter-spacing: -0.3px;
          margin: 0;
          padding: 0 8px;
        }
        .u-accent {
          background: linear-gradient(135deg, #D3B673, #F2D59B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Card ── */
        .u-card {
          background: rgba(30,41,59,0.45);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05);
          overflow: hidden;
          flex: 1;
        }

        /* ── Tabs ── */
        .u-tabs {
          display: flex;
          background: rgba(15,23,42,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .u-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 16px 8px;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          font-family: inherit;
        }
        .u-tab::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 2px;
          border-radius: 2px 2px 0 0;
          background: #D3B673;
          transition: width 0.25s ease;
        }
        .u-tab--active { color: #D3B673; background: rgba(211,182,115,0.04); }
        .u-tab--active::after { width: 36px; }

        /* ── Form ── */
        .u-form {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .u-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .u-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.2px;
        }
        .u-label--sm { font-size: 11px; }
        .u-label-icon {
          width: 13px;
          height: 13px;
          color: #D3B673;
          flex-shrink: 0;
        }

        /* Inputs */
        .u-form :global(.u-input) {
          background: rgba(15,23,42,0.65) !important;
          border: 1px solid rgba(255,255,255,0.09) !important;
          color: #f8fafc !important;
          height: 48px;
          border-radius: 14px !important;
          padding: 0 16px;
          font-size: 15px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .u-form :global(.u-input:focus) {
          border-color: #D3B673 !important;
          box-shadow: 0 0 0 3px rgba(211,182,115,0.12) !important;
          background: rgba(15,23,42,0.85) !important;
        }
        .u-form :global(.u-input::placeholder) { color: #334155 !important; }
        .u-form :global(.u-input--pass) { padding-right: 44px; }

        /* Password wrapper */
        .u-pass-wrap { position: relative; }
        .u-eye {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          padding: 4px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
        }
        .u-eye:hover { color: #94a3b8; }

        /* Fecha de nacimiento (3 campos) */
        .u-bday {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .u-bday-input {
          flex: 1;
          min-width: 0;
          text-align: center;
          font-variant-numeric: tabular-nums;
          letter-spacing: 1px;
        }
        .u-bday-input--year { flex: 1.4; }
        .u-bday-sep {
          color: #475569;
          font-size: 18px;
          font-weight: 700;
          user-select: none;
        }

        /* Select */
        .u-select {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          height: 48px;
          padding: 0 36px 0 14px;
          background-color: rgba(15,23,42,0.65);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23D3B673' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 14px;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 14px;
          color: #f8fafc;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .u-select:focus {
          outline: none;
          border-color: #D3B673;
          box-shadow: 0 0 0 3px rgba(211,182,115,0.12);
        }
        .u-select option, .u-select optgroup { background: #1e293b; color: #f8fafc; }

        /* ── Opcional ── */
        .u-optional {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          overflow: hidden;
        }
        .u-optional-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(15,23,42,0.4);
          border: none;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          text-align: left;
          transition: color 0.2s, background 0.2s;
        }
        .u-optional-toggle:hover { color: #94a3b8; background: rgba(15,23,42,0.6); }
        .u-optional-arrow {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .u-optional-arrow--open { transform: rotate(180deg); }
        .u-optional-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: rgba(15,23,42,0.2);
        }

        /* ── Términos ── */
        .u-terms {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .u-check {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 44px;
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(15,23,42,0.35);
          border: 1px solid rgba(255,255,255,0.05);
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .u-check:hover { border-color: rgba(211,182,115,0.4); background: rgba(211,182,115,0.04); }
        .u-check--on { border-color: rgba(211,182,115,0.5); background: rgba(211,182,115,0.08); }
        .u-checkbox { width: 18px; height: 18px; min-width: 18px; flex-shrink: 0; accent-color: #D3B673; cursor: pointer; }
        .u-check-text { font-size: 12px; color: #94a3b8; line-height: 1.5; flex: 1; }

        /* ── Link ── */
        .u-link { color: #D3B673; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
        .u-link:hover { color: #F2D59B; }

        /* ── Submit ── */
        .u-form :global(.u-submit) {
          width: 100%;
          height: 56px;
          border-radius: 18px !important;
          font-size: 15px;
          font-weight: 900;
          gap: 8px;
          background: linear-gradient(135deg, #D3B673, #BFA05C) !important;
          color: #0f172a !important;
          border: none !important;
          box-shadow: 0 8px 24px rgba(211,182,115,0.3) !important;
          transition: all 0.2s ease !important;
        }
        .u-form :global(.u-submit:hover:not(:disabled)) {
          box-shadow: 0 12px 32px rgba(211,182,115,0.45) !important;
          transform: translateY(-1px);
        }
        .u-form :global(.u-submit:active:not(:disabled)) { transform: translateY(0); }
        .u-form :global(.u-submit:disabled) { opacity: 0.6; }

        /* ── Toggle ── */
        .u-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
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
        .u-toggle:hover { color: #94a3b8; }
        .u-toggle strong { color: #D3B673; font-weight: 800; }

        /* ── Footer ── */
        .u-footer { text-align: center; padding: 20px 0 8px; margin-top: auto; }
        .u-footer p { font-size: 11px; color: #334155; font-weight: 400; margin: 0; }

        /* ── Pantallas pequeñas (iPhone SE) ── */
        @media (max-height: 680px) {
          .u-container { padding-top: 12px; }
          .u-header { margin-bottom: 12px; }
          .u-logo-wrap { padding: 8px 20px; margin-bottom: 10px; }
          .u-logo { height: 32px; }
          .u-title { font-size: 18px; }
          .u-form { gap: 12px; padding: 16px; }
        }
      `}</style>
    </div>
  );
}
