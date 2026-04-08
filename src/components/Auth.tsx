
"use client";

import { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogIn, UserPlus, AlertCircle, LogOut, Phone, Sparkles, Ban, User as UserIcon, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMAIL_MASTER_ADMIN = 'ignaciiio.mate@gmail.com';
const EMAILS_EMPRENDEDORES = [
  'aliado@clubpatio.cl',
];

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isBanned, setIsBanned] = useState(false);
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones para registro
    if (!isLogin) {
      if (!aceptaTerminos) {
        setError("Debes aceptar los términos de uso para continuar.");
        return;
      }
      if (!nombre.trim()) {
        setError("Por favor, ingresa tu nombre completo.");
        return;
      }
      if (!fechaNacimiento) {
        setError("Por favor, ingresa tu fecha de nacimiento.");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        const emailLimpio = email.toLowerCase().trim();
        
        // ASIGNACIÓN DE ROLES
        let rolAsignado = "cliente";
        if (emailLimpio === EMAIL_MASTER_ADMIN) {
          rolAsignado = "admin";
        } else if (EMAILS_EMPRENDEDORES.includes(emailLimpio)) {
          rolAsignado = "emprendedor";
        }

        const timestamp = new Date().toISOString();

        // Guardar en colección principal de usuarios
        await setDoc(doc(db, "usuarios", newUser.uid), {
          id: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          rol: rolAsignado,
          comprasRealizadas: 1, // Bono de bienvenida
          puntos: 100,
          totalCanjesHistoricos: 0,
          ticketsSorteo: 0,
          recompensaDisponible: false,
          avatarId: "User",
          baneado: false,
          // Consentimientos legales
          aceptaTerminos: true,
          aceptaMarketing: aceptaMarketing,
          fechaConsentimiento: timestamp,
          createdAt: timestamp
        });

        // También guardar en colección separada "leads_marketing" para acceso fácil
        await setDoc(doc(db, "leads_marketing", newUser.uid), {
          uid: newUser.uid,
          nombre: nombre.trim(),
          correo: emailLimpio,
          telefono: phone,
          fechaNacimiento: fechaNacimiento,
          aceptaMarketing: aceptaMarketing,
          aceptaTerminos: true,
          fechaRegistro: timestamp,
          fuente: "Club Patio App"
        });
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

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
            <Input 
              id="email" 
              type="email" 
              placeholder="tu@ejemplo.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              className="rounded-xl"
            />
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
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="rounded-xl"
            />
          </div>

          {/* Consentimientos — solo al registrarse */}
          {!isLogin && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Términos y Privacidad</p>

              {/* Checkbox 1: Términos de uso */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </div>
                <span className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                  He leído y acepto los{" "}
                  <a
                    href="#"
                    className="text-primary font-semibold underline underline-offset-2"
                    onClick={(e) => e.preventDefault()}
                  >
                    Términos de Uso
                  </a>{" "}
                  del Club Patio. <span className="text-red-500">*</span>
                </span>
              </label>

              {/* Checkbox 2: Marketing */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={aceptaMarketing}
                    onChange={(e) => setAceptaMarketing(e.target.checked)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer"
                  />
                </div>
                <span className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors">
                  Estoy de acuerdo en que mis datos personales (correo, teléfono) puedan ser utilizados y proporcionados para fines de marketing directo por parte de Club Patio y sus aliados comerciales.
                </span>
              </label>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full h-12 rounded-xl text-lg font-bold gap-2" disabled={loading}>
            {loading ? "Cargando..." : (isLogin ? "Entrar" : "¡Quiero mi sello de regalo!")}
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
            {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra aquí"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
