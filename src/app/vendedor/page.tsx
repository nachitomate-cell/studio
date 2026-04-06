
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, increment, collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, QrCode, Camera, CheckCircle2, 
  Loader2, AlertCircle, TrendingUp, Users, 
  Gift, Clock, ChevronRight, LayoutDashboard
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
  const scannerRef = useRef<any>(null);

  // Simulación de métricas (en una fase posterior vendrán de Firestore)
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
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
      }
    };
    checkPermission();

    // Cargar actividad reciente en tiempo real
    if (auth.currentUser) {
      const q = query(
        collection(db, "usuarios", auth.currentUser.uid, "ventas_registradas"),
        orderBy("fecha", "desc"),
        limit(3)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      
      return () => unsubscribe();
    }
  }, []);

  const startScanner = async () => {
    setScanning(true);

    const { Html5QrcodeScanner } = await import("html5-qrcode");

    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);
      scannerRef.current = scanner;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().then(() => {
        setScanning(false);
        scannerRef.current = null;
      }).catch((err: any) => console.error("Failed to stop scanner", err));
    } else {
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    stopScanner();
    await registrarSello(decodedText);
  };

  const onScanFailure = (error: any) => {};

  const registrarSello = async (uid: string) => {
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        toast({
          variant: "destructive",
          title: "Miembro no encontrado",
          description: "El código QR no corresponde a un miembro del Club Patio.",
        });
        return;
      }

      const userData = userSnap.data();
      const timestamp = new Date().toISOString();
      
      await updateDoc(userRef, {
        comprasRealizadas: increment(1),
        lastPurchaseAt: timestamp
      });

      const vendedorId = auth.currentUser?.uid;
      if (vendedorId) {
        const logRef = collection(db, "usuarios", vendedorId, "ventas_registradas");
        await addDoc(logRef, {
          vendedorId,
          clienteId: uid,
          clienteNombre: userData.nombre || "Miembro Anónimo",
          fecha: timestamp
        });
      }

      toast({
        title: "¡Sello Entregado!",
        description: `Se sumó un sello a ${userData.nombre || userData.correo}.`,
      });

    } catch (error) {
      console.error("Error al registrar sello:", error);
      toast({
        variant: "destructive",
        title: "Error de servidor",
        description: "No se pudo procesar el sello.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-6 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-slate-400">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-slate-800">Panel del Emprendedor</h1>
          </div>
          <Badge variant="outline" className="bg-[#8dc63f]/5 text-[#8dc63f] border-[#8dc63f]/20 font-bold">
            En línea
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        
        {/* Main Action: Scanner */}
        <section className="space-y-4">
          {!scanning ? (
            <Button 
              onClick={startScanner} 
              className="w-full h-20 rounded-2xl bg-[#8dc63f] text-white font-bold text-xl gap-4 shadow-xl shadow-[#8dc63f]/20 hover:scale-[1.01] transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <QrCode className="w-8 h-8" />}
              Abrir Escáner de Sellos
            </Button>
          ) : (
            <Card className="border-none shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
              <CardHeader className="bg-slate-900 text-white pb-6">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  Escanear Código QR
                  <Button variant="ghost" size="sm" onClick={stopScanner} className="text-slate-400 hover:text-white">
                    Cancelar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div id="reader" className="w-full"></div>
                <div className="p-6 bg-slate-50 text-center">
                  <p className="text-xs text-slate-500">Apunta la cámara al código del cliente</p>
                </div>
              </CardContent>
            </Card>
          )}

          {hasCameraPermission === false && (
            <Alert variant="destructive" className="rounded-2xl border-none shadow-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Cámara deshabilitada</AlertTitle>
              <AlertDescription>
                Debes permitir el acceso a la cámara en los ajustes de tu navegador.
              </AlertDescription>
            </Alert>
          )}
        </section>

        {/* Stats Dashboard */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Resumen de mi Local</h2>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            <Card className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#8dc63f]/10 rounded-xl flex items-center justify-center text-[#8dc63f]">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Sellos Entregados (Mes)</p>
                  <p className="text-2xl font-black text-slate-800">{stats.sellosMes}</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Clientes</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{stats.clientesFieles}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Premios</span>
                  </div>
                  <p className="text-xl font-black text-slate-800">{stats.premiosEntregados}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Actividad Reciente</h2>
            </div>
            <Button variant="link" className="text-xs text-[#8dc63f] font-bold p-0 h-auto">Ver todo</Button>
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
                        {new Date(sale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 1 Sello sumado
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 italic">No hay registros recientes hoy.</p>
              </div>
            )}
          </div>
        </section>

        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-400 font-medium">
            © 2024 Club Patio Curauma • Gestión de Fidelización
          </p>
        </div>
      </div>
    </main>
  );
}
