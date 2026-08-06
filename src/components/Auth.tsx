
"use client";

import { useState, useEffect, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, setDoc, getDoc, updateDoc, increment, addDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getFriendlyErrorMessage } from "@/lib/firebaseErrors";
import { AvisoError, type AccionAviso } from "@/components/AvisoError";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn, UserPlus, AlertCircle, LogOut, Phone, Sparkles, Ban, User as UserIcon, Calendar, Loader2, Gift, Mail, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TermsModal from "@/components/TermsModal";
import { registrarCompra } from "@/lib/puntos";
import { syncUserStampsToWallet } from "@/lib/walletSync";

import { ADMIN_EMAIL as EMAIL_MASTER_ADMIN } from "@/lib/constants";
const EMAILS_EMPRENDEDORES = [
  'aliado@clubpatio.cl',
];

function generarCodigoReferido(nombre: string): string {
  const prefijo = nombre.trim().toUpperCase().replace(/\s/g, "").replace(/[^A-Z]/g, "").substring(0, 4).padEnd(4, "X");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let sufijo = "";
  for (let i = 0; i < 4; i++) sufijo += chars[Math.floor(Math.random() * chars.length)];
  return `${prefijo}-${sufijo}`;
}

export function Auth({ onLoginSuccess }: { onLoginSuccess?: () => void } = {}) {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Fallos de servidor, en modal. `error` sigue siendo para la validación de
   * campos: en línea se lee mejor y no interrumpe. El modal es para lo que de
   * verdad detiene a la persona.
   */
  const [errorModal, setErrorModal] = useState<{ mensaje: string; accion?: AccionAviso } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRedirectingPendingStamp, setIsRedirectingPendingStamp] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const preventAutoRedirect = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, "usuarios", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().baneado) {
          setIsBanned(true);
          await signOut(auth);
          toast({
            variant: "destructive",
            title: "Cuenta Suspendida",
            description: "Tu acceso al Club Patio ha sido revocado.",
          });
        } else {
          setIsBanned(false);
        }
      } else {
        setIsBanned(false);
      }
    });
    return () => unsubscribe();
  }, [toast]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("register") === "true") {
        setIsLogin(false);
      }
    }
  }, []);

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico primero.");
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
      toast({
        title: "Correo enviado ✅",
        description: "Revisa tu bandeja de entrada (y carpeta de spam).",
      });
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorModal(null);
    setLoading(true);
    // Cuenta de Auth creada en este intento, para poder deshacerla si el
    // registro no llega a completarse. Ver el catch.
    let cuentaCreada: import("firebase/auth").User | null = null;

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
            } catch {}
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

        const urlPendiente = localStorage.getItem("url_retorno");
        if (urlPendiente) {
          localStorage.removeItem("url_retorno");
          setIsRedirectingPendingStamp(true);
          window.location.href = urlPendiente;
          return;
        }

        // Routing por rol: el emprendedor/staff entra directo a su herramienta
        // de trabajo (Validar); el cliente queda en Descubrir.
        const data = snap.exists() ? snap.data() : null;
        const roles: string[] = Array.isArray(data?.roles)
          ? data!.roles
          : data?.rol ? [data.rol] : [];
        const isVendor = roles.includes("emprendedor") || roles.includes("staff");
        if (isVendor) {
          router.replace("/validar");
          return;
        }
        onLoginSuccess?.();
      } else {
        if (!aceptaTerminos) throw new Error("Debes aceptar los términos de uso.");
        if (!nombre.trim()) throw new Error("Ingresa tu nombre completo.");
        if (!fechaNacimiento) throw new Error("Ingresa tu fecha de nacimiento.");
        if (phone && !/^\+?56\s?9\s?\d{4}\s?\d{4}$/.test(phone.replace(/\s/g, ""))) {
          throw new Error("Teléfono inválido. Usa formato +56 9 XXXX XXXX.");
        }

        // Capa 3: verificar unicidad del teléfono
        const normalizedPhone = phone.replace(/\s/g, "");
        if (normalizedPhone) {
          try {
            const phoneSnap = await getDocs(query(collection(db, "usuarios"), where("telefono", "==", normalizedPhone)));
            if (!phoneSnap.empty) {
              throw new Error("Este número de teléfono ya está registrado. Si ya tienes cuenta, inicia sesión.");
            }
          } catch (err: any) {
            if (err.message?.includes("ya está registrado")) throw err;
          }
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        cuentaCreada = newUser;
        const emailLimpio = email.toLowerCase().trim();

        await updateProfile(newUser, { displayName: nombre.trim() });

        let rolAsignado = "cliente";
        if (emailLimpio === EMAIL_MASTER_ADMIN) rolAsignado = "admin";
        else if (EMAILS_EMPRENDEDORES.includes(emailLimpio)) rolAsignado = "emprendedor";

        const timestamp = new Date().toISOString();
        const miCodigo = generarCodigoReferido(nombre);
        const referralLocalId = typeof window !== "undefined"
          ? localStorage.getItem("referral_local_id")
          : null;

        // Leer config del sello de bienvenida
        const configSnap = await getDoc(doc(db, "configuracion", "general")).catch(() => null);
        const configBienvenida = configSnap?.exists() ? configSnap.data()?.selloBienvenida : null;
        const bienvenidaActivo = configBienvenida?.activo !== false;
        const bienvenidaCantidad: number = Number(configBienvenida?.cantidad ?? 1);
        const sellosIniciales = referralLocalId ? 0 : (bienvenidaActivo ? bienvenidaCantidad : 0);
        const puntosIniciales = referralLocalId ? 50 : (bienvenidaActivo ? bienvenidaCantidad * 100 : 0);

        await setDoc(doc(db, "usuarios", newUser.uid), {
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
          fechaConsentimiento: timestamp,
          createdAt: timestamp,
          bono_login_reclamado: true,
          codigoReferido: miCodigo,
          referidosExitosos: 0,
          ...(referralLocalId ? { referredByLocal: referralLocalId } : {}),
        });

        await setDoc(doc(db, "codigos_referido", miCodigo), {
          userId: newUser.uid,
          creadoEn: timestamp,
        });

        await setDoc(doc(db, "leads_marketing", newUser.uid), {
          uid: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: normalizedPhone,
          fechaNacimiento: fechaNacimiento,
          aceptaMarketing: aceptaMarketing,
          aceptaTerminos: true,
          fechaRegistro: timestamp,
          fuente: "Club Patio App",
        });

        // Atribución del sello de bienvenida
        if (referralLocalId) {
          try {
            await registrarCompra(db, newUser.uid, referralLocalId, false, "REFERIDO");
            localStorage.removeItem("referral_local_id");
            localStorage.removeItem("url_retorno");
          } catch {
            // No crítico: el usuario ya fue creado
          }
        } else if (bienvenidaActivo) {
          try {
            // Trazabilidad de origen. Los QR físicos están impresos con la URL base
            // (sin params), así que el default es "qr". Solo marcamos Instagram cuando
            // el parámetro es explícito o llega el fbclid (IG lo añade siempre).
            const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
            const rawSource = (urlParams?.get("source") || urlParams?.get("utm_source") || "").toLowerCase();
            const hasFbclid = !!urlParams?.get("fbclid");
            const origenBienvenida = rawSource === "instagram" || hasFbclid ? "instagram" : "qr";

            await addDoc(collection(db, "system_logs"), {
              usuario: nombre.trim(),
              usuarioId: newUser.uid,
              accion: `recibió ${bienvenidaCantidad} Sello${bienvenidaCantidad > 1 ? "s" : ""} de Bienvenida (registro orgánico)`,
              fecha: timestamp,
              tipo: "FIDELIZACION",
              metodo: "BIENVENIDA",
              cantidad: bienvenidaCantidad,
              origenBienvenida,
            });
            syncUserStampsToWallet(newUser.uid, bienvenidaCantidad);
          } catch {
            // No crítico
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
        return;
      }
    } catch (err: any) {
      // Una cuenta de Auth sin su documento en Firestore deja a la persona
      // encerrada: al reintentar le dirá que el correo ya está en uso, y sin
      // documento tampoco puede entrar. Se deshace para que reintentar sirva.
      if (cuentaCreada) {
        try { await cuentaCreada.delete(); } catch { /* el reintento lo evidenciará */ }
      }
      setError(null);
      setErrorModal({
        mensaje: getFriendlyErrorMessage(err),
        // Con cuenta ya creada, lo útil no es explicar el error sino ofrecer la
        // salida: pasar a iniciar sesión, con el correo ya escrito.
        accion: err?.code === "auth/email-already-in-use"
          ? { texto: "Iniciar sesión", onClick: () => { setIsLogin(true); setPassword(""); } }
          : undefined,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (isRedirectingPendingStamp) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-primary/20 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <CardContent className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-800">Procesando tu sello...</h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">
                Te estamos llevando directo a tu canje. ¡Ya casi! 🌟
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCelebration) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-primary/20 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <CardContent className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg" style={{ background: '#9DCC65', boxShadow: '0 8px 24px rgba(157,204,101,0.4)' }}>
              <Gift className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800">¡Felicidades! 🎉</h2>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Patio Curauma te ha regalado tu primer sello de bienvenida. ¡Ya estás más cerca de tu premio!
              </p>
            </div>
            <Button
              className="w-full h-12 rounded-xl font-bold"
              onClick={() => {
                const urlPendiente = localStorage.getItem("url_retorno");
                if (urlPendiente) {
                  localStorage.removeItem("url_retorno");
                  window.location.href = urlPendiente;
                } else {
                  setShowCelebration(false);
                }
              }}
            >
              Ver mi tarjeta de sellos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isBanned) {
    return (
      <Card className="w-full max-w-md mx-auto border-red-500 shadow-2xl bg-red-50">
        <CardHeader className="text-center">
          <Ban className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <CardTitle className="text-red-700">Acceso Denegado</CardTitle>
          <CardDescription>
            Tu cuenta ha sido bloqueada por el administrador.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => setIsBanned(false)} variant="outline" className="w-full">Volver al inicio</Button>
        </CardFooter>
      </Card>
    );
  }

  if (user) {
    return (
      <Card className="w-full max-w-md mx-auto border-primary/20 shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary font-bold">Sesión Iniciada</CardTitle>
          <CardDescription>Estás conectado como {user.email}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={handleLogout} variant="destructive" className="w-full gap-2 rounded-xl">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto border-primary/20 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <CardHeader className="bg-primary/5 pb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            {isLogin ? "Iniciar Sesión" : "Únete al Club"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Accede para acumular sellos."
              : "¡Regístrate hoy y recibe tu primer sello de regalo! 🎁"}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleAuth}>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Nombre completo — solo al registrarse */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nombre"
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

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl pl-10"
                />
              </div>
            </div>

            {/* Teléfono — solo al registrarse */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (WhatsApp)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="rounded-xl pl-10"
                  />
                </div>
              </div>
            )}

            {/* Fecha de nacimiento — solo al registrarse */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="fechaNacimiento"
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    required
                    className="rounded-xl pl-10"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl pl-10"
                  minLength={6}
                />
              </div>
            </div>

            {/* Recuperar contraseña — solo en login */}
            {isLogin && (
              <div className="text-right" style={{ marginTop: -8 }}>
                {resetSent ? (
                  <p className="text-xs font-bold text-green-600">
                    ✅ Revisa tu correo para restablecer tu contraseña.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={resetLoading}
                    className="text-xs font-bold text-primary underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer"
                  >
                    {resetLoading ? "Enviando..." : "¿Olvidaste tu contraseña?"}
                  </button>
                )}
              </div>
            )}

            {/* Consentimientos — solo al registrarse */}
            {!isLogin && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Términos y Privacidad</p>

                <label className="flex items-start gap-3 cursor-pointer group min-h-[44px] p-2.5 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={aceptaTerminos}
                      onChange={(e) => setAceptaTerminos(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-slate-600 leading-relaxed">
                    He leído y acepto los{" "}
                    <button
                      type="button"
                      className="text-primary font-semibold underline underline-offset-2 bg-transparent border-none p-0 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setShowTerms(true); }}
                    >
                      Términos de Uso
                    </button>{" "}
                    del Club Patio. <span className="text-red-500">*</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group min-h-[44px] p-2.5 rounded-xl border-[1.5px] border-slate-200 bg-slate-50 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={aceptaMarketing}
                      onChange={(e) => setAceptaMarketing(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Acepto recibir comunicaciones de marketing de Club Patio y sus aliados comerciales.
                  </span>
                </label>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold gap-2" disabled={loading}>
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

            <Button
              type="button"
              variant="ghost"
              className="text-primary font-semibold"
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
                  ¿No tienes cuenta? <strong className="ml-1">Regístrate aquí</strong>
                  <UserPlus className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta? <strong className="ml-1">Inicia sesión aquí</strong>
                  <LogIn className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

      <AvisoError
        mensaje={errorModal?.mensaje ?? null}
        titulo={isLogin ? "No pudimos iniciar sesión" : "No pudimos crear tu cuenta"}
        accion={errorModal?.accion}
        onCerrar={() => setErrorModal(null)}
      />
    </>
  );
}
