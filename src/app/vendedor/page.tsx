
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, QrCode, Camera, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VendedorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [lastClient, setLastClient] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Verificar permisos de cámara al cargar
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        // Detener el stream inmediatamente, solo queríamos verificar el permiso
        stream.getTracks().forEach(track => track.stop());
      } catch (error) {
        console.error("Error accessing camera:", error);
        setHasCameraPermission(false);
      }
    };
    checkPermission();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, []);

  const startScanner = () => {
    setScanning(true);
    setLastClient(null);

    // Pequeño delay para asegurar que el div "reader" esté en el DOM
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
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
      }).catch(err => console.error("Failed to stop scanner", err));
    } else {
      setScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // El decodedText debería ser el UID del cliente
    stopScanner();
    await registrarVenta(decodedText);
  };

  const onScanFailure = (error: any) => {
    // Errores comunes de escaneo (no se encuentra QR en el frame) se ignoran para no saturar la consola
  };

  const registrarVenta = async (uid: string) => {
    setLoading(true);
    try {
      const userRef = doc(db, "usuarios", uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        toast({
          variant: "destructive",
          title: "Usuario no encontrado",
          description: "El código QR no corresponde a un cliente registrado.",
        });
        return;
      }

      const userData = userSnap.data();
      
      // Actualizar en Firestore
      await updateDoc(userRef, {
        comprasRealizadas: increment(1),
        puntos: increment(50),
        lastPurchaseAt: new Date().toISOString()
      });

      setLastClient({
        nombre: userData.nombre || "Cliente Anónimo",
        email: userData.correo,
        compras: (userData.comprasRealizadas || 0) + 1
      });

      toast({
        title: "¡Venta Registrada!",
        description: `Se sumó una compra a ${userData.nombre || userData.correo}.`,
      });

    } catch (error) {
      console.error("Error al registrar venta:", error);
      toast({
        variant: "destructive",
        title: "Error de servidor",
        description: "No se pudo procesar la venta. Inténtalo de nuevo.",
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
        <h1 className="text-2xl font-bold text-primary">Terminal Vendedor</h1>
      </div>

      <Card className="border-primary/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            Escanear Cliente
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
                  Usa la cámara para escanear el código QR del cliente y sumar sus puntos.
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
                Por favor, permite el acceso a la cámara en los ajustes de tu navegador para usar el escáner.
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
              <p className="text-xs font-bold text-accent-foreground uppercase tracking-widest">Último Registro</p>
              <h3 className="font-bold text-lg text-primary">{lastClient.nombre}</h3>
              <p className="text-sm text-muted-foreground">Total: {lastClient.compras} compras acumuladas</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <p className="text-xs text-muted-foreground italic">
          "Recuerda que cada escaneo suma 50 puntos y 1 compra al historial del cliente."
        </p>
      </div>
    </main>
  );
}
