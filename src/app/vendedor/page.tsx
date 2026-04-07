
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { query, collection, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { registrarCompra } from "@/lib/puntos";
import { 
  ArrowLeft, QrCode, Camera, CheckCircle2, 
  Loader2, AlertCircle, TrendingUp, Users, 
  Gift, Clock, ChevronRight, LayoutDashboard,
  X
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const scannerInstance = useRef<any>(null);

  const stats = {
    sellosMes: 124,
    clientesFieles: 45,
    premiosEntregados: 12
  };

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    checkPermission();

    if (auth.currentUser) {
      const q = query(
        collection(db, "usuarios", auth.currentUser.uid, "ventas_registradas"),
        orderBy("fecha", "desc"),
        limit(3)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        // Error silencioso para el vendedor si falla el historial
      });
      
      return () => {
        unsubscribe();
        stopScanner();
      };
    }
  }, []);

  const startScanner = async () => {
    setScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      
      setTimeout(async () => {
        try {
          const html5QrCode = new Html5Qrcode("reader");
          scannerInstance.current = html5QrCode;

          const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
              onScanSuccess(decodedText);
            },
            (errorMessage) => {
              // No es necesario loguear cada frame fallido
            }
          );
        } catch (err) {
          setScanning(false);
          toast({
            variant: "destructive",
            title: "Error de Cámara",
            description: "No se pudo iniciar el escáner. Verifica los permisos.",
          });
        }
      }, 300);
    } catch (e) {
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerInstance.current && scannerInstance.current.isScanning) {
      try {
        await scannerInstance.current.stop();
      } catch (err) {
        // Fallo al detener
      }
    }
    setScanning(false);
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
      const vendedorId = auth.currentUser?.uid;
      
      // Usamos la función centralizada de puntos para asegurar consistencia
      await registrarCompra(db, uid, vendedorId);

      toast({
        title: "¡Sello Procesado!",
        description: "El cliente ha recibido su sello correctamente.",
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de servidor",
        description: "No se pudo procesar el sello. Inténtalo de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };

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
          {!scanning ? (
            <Button 
              onClick={startScanner} 
              className="w-full h-20 rounded-2xl bg-primary text-white font-bold text-xl gap-4 shadow-xl shadow-primary/20 hover:scale-[1.01] transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <QrCode className="w-8 h-8" />}
              Escanear Cliente
            </Button>
          ) : (
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
          )}

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="rounded-2xl border-none shadow-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sin acceso a cámara</AlertTitle>
              <AlertDescription>
                Habilita los permisos en tu navegador para poder escanear socios.
              </AlertDescription>
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
                  <p className="text-2xl font-black text-slate-800">{stats.sellosMes} Sellos</p>
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
                  <p className="text-xl font-black text-slate-800">{stats.clientesFieles}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Entregados</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{stats.premiosEntregados}</p>
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
            <Button variant="link" className="text-xs text-primary font-bold p-0 h-auto">Ver Historial</Button>
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
                      <Users className="w-5 h-5" />
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

        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-400 font-medium">
            © {new Date().getFullYear()} Patio Curauma • Sistema Aliados
          </p>
        </div>
      </div>
    </main>
  );
}
