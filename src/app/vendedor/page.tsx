
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, QrCode, Camera, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [lastClient, setLastClient] = useState<any>(null);
  const scannerRef = useRef<any>(null);

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

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err: any) => console.error("Failed to clear scanner", err));
      }
    };
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setLastClient(null);

    // Importación dinámica para evitar errores de SSR en build estático
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

      setLastClient({
        nombre: userData.nombre || "Miembro Anónimo",
        email: userData.correo,
        sellos: (userData.comprasRealizadas || 0) + 1
      });

      toast({
        title: "¡Sello Entregado!",
        description: `Se sumó un sello a ${userData.nombre || userData.correo}.`,
      });

    } catch (error) {
      console.error("Error al registrar sello:", error);
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
    <main className="min-h-screen bg-background p-6 space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="text-primary">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-2xl font-bold text-primary">Terminal de Sellos</h1>
      </div>

      <Card className="border-primary/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Escanear Miembro
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {!scanning ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-32 h-32 bg-primary/10 rounded-3xl flex items-center justify-center text-primary">
                <Camera className="w-16 h-16" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-muted-foreground font-medium">
                  Escanea el código del miembro para entregar un sello.
                </p>
              </div>
              <Button 
                onClick={startScanner} 
                className="w-full h-14 rounded-2xl text-lg font-bold gap-3 shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : <QrCode className="w-6 h-6" />}
                Activar Escáner
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div id="reader" className="overflow-hidden rounded-2xl border-2 border-primary/20"></div>
              <Button 
                variant="outline" 
                onClick={stopScanner} 
                className="w-full h-12 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5"
              >
                Cancelar Escaneo
              </Button>
            </div>
          )}

          {hasCameraPermission === false && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Acceso a Cámara Denegado</AlertTitle>
              <AlertDescription>
                Por favor, permite el acceso a la cámara para usar el escáner del Club.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {lastClient && (
        <Card className="border-accent/40 bg-accent/5 animate-in slide-in-from-bottom-4 duration-500">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center text-accent-foreground">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-accent-foreground uppercase tracking-widest">Último Sello</p>
              <h3 className="font-bold text-lg text-primary">{lastClient.nombre}</h3>
              <p className="text-sm text-muted-foreground">Total: {lastClient.sellos} sellos acumulados</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <p className="text-xs text-muted-foreground italic">
          "Cada escaneo suma 1 sello al Club Patio del cliente."
        </p>
      </div>
    </main>
  );
}
