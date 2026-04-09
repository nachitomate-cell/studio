"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { query, collection, orderBy, limit, onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { registrarCompra } from "@/lib/puntos";
import { 
  ArrowLeft, QrCode, Camera, CheckCircle2, 
  Loader2, AlertCircle, TrendingUp, Users, 
  Gift, Clock, ChevronRight, LayoutDashboard,
  X, Store, Save, ImagePlus, UserCircle, Upload, Copy, Download
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import QRCode from "react-qr-code";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [view, setView] = useState<"dashboard" | "scanner" | "profile" | "myqr">("dashboard");
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const scannerInstance = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shopForm, setShopForm] = useState({
    nombreTienda: "",
    descripcion: ""
  });

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop && track.stop());
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    checkPermission();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("action") === "scan") {
        setTimeout(() => {
          startScanner();
        }, 300);
      }
    }

    let unsubscribeProfile: () => void = () => {};
    let unsubscribeUser: () => void = () => {};
    let unsubscribeVentas: () => void = () => {};

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const profileRef = doc(db, "entrepreneur_profiles", user.uid);
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setShopForm({
              nombreTienda: data.businessName || data.nombre || "",
              descripcion: data.description || data.descripcion || ""
            });
            setPreviewUrl(data.imageUrl || data.imageUrls?.[0] || null);
          }
        });

        const userRef = doc(db, "usuarios", user.uid);
        unsubscribeUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          }
        });

        const q = query(
          collection(db, "usuarios", user.uid, "ventas_registradas"),
          orderBy("fecha", "desc"),
          limit(5)
        );
        
        unsubscribeVentas = onSnapshot(q, (snapshot) => {
          setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }
    });

    return () => {
      authUnsubscribe();
      unsubscribeProfile();
      unsubscribeUser();
      unsubscribeVentas();
      stopScanner();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSaveShopInfo = async () => {
    if (!auth.currentUser) {
      toast({ variant: "destructive", title: "No autenticado", description: "Debes iniciar sesión para realizar cambios." });
      return;
    }
    
    setLoading(true);

    try {
      let finalImageUrl = previewUrl;

      if (profileImage) {
        try {
          const storageRef = ref(storage, `entrepreneur_photos/${auth.currentUser.uid}/profile.jpg`);
          const uploadResult = await uploadBytes(storageRef, profileImage);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch (storageError: any) {
          console.error("Storage Error:", storageError);
          toast({ 
            variant: "destructive", 
            title: "Error de Imagen", 
            description: "No se pudo subir la foto. Se guardará solo el texto." 
          });
        }
      }

      const profileRef = doc(db, "entrepreneur_profiles", auth.currentUser.uid);
      const updateData = {
        id: auth.currentUser.uid,
        userId: auth.currentUser.uid,
        businessName: shopForm.nombreTienda,
        description: shopForm.descripcion,
        imageUrl: finalImageUrl || null,
        imageUrls: finalImageUrl ? [finalImageUrl] : [],
        updatedAt: new Date().toISOString()
      };

      await setDoc(profileRef, updateData, { merge: true });

      const userRef = doc(db, "usuarios", auth.currentUser.uid);
      await updateDoc(userRef, { nombreTienda: shopForm.nombreTienda });

      toast({ title: "¡Perfil actualizado!", description: "La información de tu local se ha guardado correctamente." });
      setView("dashboard");
    } catch (error: any) {
      console.error("Error al guardar perfil:", error);
      toast({ 
        variant: "destructive", 
        title: "Error al guardar", 
        description: "Hubo un problema al conectar con la base de datos." 
      });
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setView("scanner");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader");
          scannerInstance.current = html5QrCode;
          const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
          await html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => onScanSuccess(decodedText), () => {});
        } catch (err) {
          setView("dashboard");
          toast({ variant: "destructive", title: "Error de Cámara", description: "No se pudo iniciar el escáner." });
        }
      }, 300);
    } catch (e) {
      setView("dashboard");
    }
  };

  const stopScanner = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try { await scannerInstance.current.stop(); } catch (err) {}
    }
    setView("dashboard");
    scannerInstance.current = null;
  };

  const onScanSuccess = async (decodedText: string) => {
    const clientUid = decodedText.trim();
    if (!clientUid) return;
    await stopScanner();
    handleProcessSale(clientUid);
  };

  const handleProcessSale = async (uid: string) => {
    setLoading(true);
    try {
      await registrarCompra(db, uid, auth.currentUser?.uid);
      toast({ title: "¡Sello Procesado!", description: "El cliente ha recibido su sello correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el sello." });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.querySelector("#qr-codigo-mostrador svg");
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        
        const nombre = userData?.nombreTienda || shopForm.nombreTienda || "mi_tienda";
        const nombreTiendaFiltrado = nombre.toLowerCase().replace(/[^a-z0-9]/g, "_");
        downloadLink.download = `codigo_qr_${nombreTiendaFiltrado}.png`;
        
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (view === "myqr") {
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">Mi Código QR</h1>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white text-center p-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Código de Mostrador</h2>
            <p className="text-sm text-slate-500 mb-8 max-w-[250px] mx-auto">
              Los clientes deben escanear este código desde su app para sumar un sello.
            </p>
            
            <div id="qr-codigo-mostrador" className="bg-white p-4 rounded-3xl inline-block shadow-lg border border-slate-100 mx-auto mb-6">
              <QRCode 
                value={auth.currentUser?.uid ? `https://club-patio-curauma.vercel.app/canje?localId=${auth.currentUser.uid}` : "cargando"} 
                size={250}
                className="rounded-xl"
              />
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <Button 
                className="w-full max-w-[250px] rounded-xl font-bold bg-primary text-white gap-2 shadow-md hover:scale-[1.02] transition-all"
                onClick={handleDownloadQR}
              >
                <Download className="w-5 h-5" />
                Descargar Código QR
              </Button>
              <Button 
                variant="outline" 
                className="w-full max-w-[250px] rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                onClick={() => {
                  if (auth.currentUser?.uid) {
                    navigator.clipboard.writeText(`https://club-patio-curauma.vercel.app/canje?localId=${auth.currentUser.uid}`);
                    toast({ title: "Enlace copiado", description: "¡Listo para compartir!" });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
                Copiar Enlace
              </Button>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                ID: {auth.currentUser?.uid?.substring(0, 8)}...
              </p>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (view === "profile") {
    return (
      <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in slide-in-from-right duration-300">
        <div className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")} className="text-slate-400">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-slate-800">Mi Perfil de Tienda</h1>
        </div>

        <div className="max-w-lg mx-auto p-6 space-y-6">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
            <div className="h-2 bg-primary w-full" />
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-2xl font-medium text-slate-900">Configuración del Local</h2>
                <p className="text-sm text-slate-500">Completa la información que verán los socios del club.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="shopName" className="text-sm font-bold text-slate-700">Nombre de tu local</Label>
                  <Input 
                    id="shopName" 
                    placeholder="Ej: Sabores del Patio" 
                    className="h-12 border-slate-200 focus:border-primary rounded-lg text-base"
                    value={shopForm.nombreTienda}
                    onChange={(e) => setShopForm({...shopForm, nombreTienda: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="shopDesc" className="text-sm font-bold text-slate-700">¿De qué trata tu tienda?</Label>
                  <Textarea 
                    id="shopDesc" 
                    placeholder="Describe tus productos o servicios..." 
                    className="min-h-[120px] border-slate-200 focus:border-primary rounded-lg text-base p-4"
                    value={shopForm.descripcion}
                    onChange={(e) => setShopForm({...shopForm, descripcion: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-700">Foto de tu local</Label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group overflow-hidden relative aspect-video bg-slate-50/50",
                      previewUrl && "border-solid border-primary/20"
                    )}
                  >
                    {previewUrl ? (
                      <>
                        <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload className="text-white w-8 h-8" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                          <ImagePlus className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subir foto de mi tienda</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={handleSaveShopInfo}
                  disabled={loading}
                  className="w-full h-14 bg-primary text-white font-black rounded-xl text-lg gap-3 shadow-lg shadow-primary/20"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">Panel del Emprendedor</h1>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
            Aliado Activo
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        <section className="space-y-4">
          {view === "scanner" ? (
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
              <CardHeader className="bg-slate-900 text-white pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-bold">Escáner de Sellos</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={stopScanner} className="text-slate-400 hover:text-white rounded-full h-8 w-8">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-black relative">
                <div id="reader" className="w-full aspect-square overflow-hidden"></div>
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                  <div className="w-full h-full border-2 border-primary/50 rounded-xl"></div>
                </div>
                <div className="p-6 bg-slate-900 text-center">
                  <p className="text-xs text-slate-300 font-medium">Enfoca el código QR del Socio</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => setView("myqr")}
                className="w-full h-20 rounded-2xl bg-slate-900 text-white font-bold text-xl gap-4 shadow-xl shadow-slate-900/20 hover:scale-[1.01] transition-all active:scale-95"
              >
                <QrCode className="w-8 h-8" />
                Mi Código QR (Mostrador)
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={startScanner} 
                  variant="outline"
                  className="w-full h-16 rounded-2xl border-primary text-primary font-bold gap-2 hover:bg-primary/5"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  Escanear Cliente
                </Button>
                <Button 
                  onClick={() => setView("profile")}
                  variant="outline"
                  className="w-full h-16 rounded-2xl border-slate-200 bg-white text-slate-600 font-bold gap-2 hover:bg-slate-50"
                >
                  <Store className="w-5 h-5 text-primary" />
                  Mi Tienda
                </Button>
              </div>
            </div>
          )}

          {hasCameraPermission === false && view === "scanner" && (
            <Alert variant="destructive" className="rounded-2xl border-none shadow-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin acceso a cámara</AlertTitle>
              <AlertDescription>Habilita los permisos para poder escanear socios.</AlertDescription>
            </Alert>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resumen de mi Local</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Fidelización (Mes)</p>
                  <p className="text-2xl font-black text-slate-800">{userData?.sellosEntregados || 0} Sellos</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Miembros</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{recentActivity.length}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tienda</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-800 truncate">{userData?.nombreTienda || "Sin Nombre"}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ventas Recientes</h2>
            </div>
          </div>

          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((sale, idx) => (
                <div 
                  key={sale.id} 
                  className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between animate-in slide-in-from-right duration-300"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                      <UserCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{sale.clienteNombre}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(sale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sello sumado
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-medium italic">Esperando primera venta del día...</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
