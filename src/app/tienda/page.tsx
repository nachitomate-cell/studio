"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, Save, ImagePlus, Upload, HelpCircle, X,
  Sparkles, ExternalLink, Link2, Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/data";

import { ADMIN_EMAIL } from "@/lib/constants";

export default function TiendaPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Link in Bio (bioo.cl)
  const [biooInfo, setBiooInfo] = useState<{ handle?: string; claimUrl?: string; publicUrl?: string }>({});
  const [biooBusy, setBiooBusy] = useState(false);
  const [biooOpening, setBiooOpening] = useState(false);

  const [shopForm, setShopForm] = useState({
    nombreTienda: "",
    descripcion: "",
    categoria: "",
    mediosPago: [] as string[],
    otroMedio: "",
    whatsapp: "+56",
    instagram: "",
    ubicacion: "",
    horario: "",
    promoText: "",
    isPremium: false,
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      setIsAdmin((user.email || "").trim().toLowerCase() === ADMIN_EMAIL);
      setAuthReady(true);

      const profileRef = doc(db, "entrepreneur_profiles", user.uid);
      const unsubProfile = onSnapshot(profileRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const mp: string[] = data.mediosPago || [];
          const isOtro = mp.some(m => !["efectivo", "debito", "transferencia"].includes(m));
          const otroVal = isOtro
            ? mp.find(m => !["efectivo", "debito", "transferencia"].includes(m)) || ""
            : "";
          setShopForm({
            nombreTienda: data.businessName || data.nombre || "",
            descripcion: data.description || data.descripcion || "",
            categoria: data.category || data.rubro || "",
            mediosPago: isOtro
              ? [...mp.filter(m => ["efectivo", "debito", "transferencia"].includes(m)), "otro"]
              : mp,
            otroMedio: otroVal === "otro" ? "" : otroVal,
            whatsapp: data.whatsapp || data.contactPhone || "+56",
            instagram: data.instagram ? data.instagram.replace("@", "") : "",
            ubicacion: data.ubicacionTienda || data.address || "",
            horario: data.operatingHours || data.horario || "",
            promoText: data.promoText || "",
            isPremium: data.isPremium === true,
          });
          setPreviewUrl(data.imageUrl || data.imageUrls?.[0] || null);
          setBiooInfo({ handle: data.biooHandle, claimUrl: data.biooClaimUrl, publicUrl: data.biooPublicUrl });
        }
      });

      return () => unsubProfile();
    });
    return () => unsub();
  }, [router]);

  const toggleMedioPago = (key: string) => {
    setShopForm(prev => ({
      ...prev,
      mediosPago: prev.mediosPago.includes(key)
        ? prev.mediosPago.filter(m => m !== key)
        : [...prev.mediosPago, key],
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // ── Link in Bio (bioo.cl) — autoservicio del emprendedor ──────────────────
  const crearMiBioo = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({ variant: "destructive", title: "No autenticado", description: "Inicia sesión para crear tu página." });
      return;
    }
    if (!shopForm.nombreTienda.trim() || shopForm.nombreTienda.trim() === "—") {
      toast({ variant: "destructive", title: "Configura tu local primero", description: "Necesitas el nombre de tu local antes de crear tu Link in Bio." });
      return;
    }
    setBiooBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/bioo/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: user.uid, idToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ variant: "destructive", title: "No se pudo crear", description: json.error || "Intenta de nuevo." });
        return;
      }
      setBiooInfo({ handle: json.handle, claimUrl: json.claimUrl, publicUrl: json.publicUrl });
      toast({ title: "¡Tu Link in Bio está listo!", description: `bioo.cl/${json.handle} — actívala para personalizarla.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar. Intenta de nuevo." });
    } finally {
      setBiooBusy(false);
    }
  };

  const copiarBioo = (texto: string, msg: string) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast({ title: msg }),
      () => toast({ variant: "destructive", title: "No se pudo copiar" })
    );
  };

  // Abre el editor de bioo.cl con la sesión del emprendedor ya iniciada (SSO).
  const abrirEditorBioo = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setBiooOpening(true);
    const w = window.open("", "_blank");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/bioo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.editUrl) {
        if (w) w.close();
        toast({ variant: "destructive", title: "No se pudo abrir", description: json.error || "Intenta de nuevo." });
        return;
      }
      if (w) w.location.href = json.editUrl;
      else window.location.href = json.editUrl;
    } catch {
      if (w) w.close();
      toast({ variant: "destructive", title: "Error", description: "No se pudo conectar. Intenta de nuevo." });
    } finally {
      setBiooOpening(false);
    }
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const waRaw = shopForm.whatsapp.replace(/\s/g, "");
    const waClean = (waRaw === "+" || waRaw === "+56") ? "" : waRaw;
    if (waClean && !/^\+56\d{9}$/.test(waClean)) {
      toast({ variant: "destructive", title: "WhatsApp inválido", description: "Debe comenzar con +56 y tener 11 dígitos. Ej: +56912345678" });
      return;
    }

    const mediosFinal = shopForm.mediosPago.filter(m => m !== "otro");
    if (shopForm.mediosPago.includes("otro")) {
      mediosFinal.push(shopForm.otroMedio.trim() || "otro");
    }

    setLoading(true);
    try {
      let finalImageUrl = previewUrl;

      if (profileImage) {
        try {
          const storageRef = ref(storage, `entrepreneur_photos/${user.uid}/profile.jpg`);
          const uploadResult = await uploadBytes(storageRef, profileImage);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
        } catch {
          toast({ variant: "destructive", title: "Error de imagen", description: "No se pudo subir la foto. Se guardará solo el texto." });
        }
      }

      const profileRef = doc(db, "entrepreneur_profiles", user.uid);
      await setDoc(profileRef, {
        id: user.uid,
        userId: user.uid,
        businessName: shopForm.nombreTienda,
        description: shopForm.descripcion,
        category: shopForm.categoria || null,
        imageUrl: finalImageUrl || null,
        imageUrls: finalImageUrl ? [finalImageUrl] : [],
        mediosPago: mediosFinal,
        whatsapp: waClean || null,
        instagram: shopForm.instagram.replace("@", "").trim() || null,
        ubicacionTienda: shopForm.ubicacion.trim() || null,
        operatingHours: shopForm.horario.trim() || null,
        promoText: shopForm.promoText.trim() || null,
        isPremium: shopForm.isPremium,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await updateDoc(doc(db, "usuarios", user.uid), { nombreTienda: shopForm.nombreTienda });

      // Auto-crear su Link in Bio (bioo.cl) si aún no lo tiene. Idempotente y silencioso.
      if (!biooInfo.handle) {
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/bioo/provision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorId: user.uid, idToken }),
          });
        } catch { /* no bloquea el guardado */ }
      }

      toast({ title: "¡Perfil actualizado!", description: "La información de tu local se ha guardado correctamente." });
      router.push("/vendedor");
    } catch (error: any) {
      console.error("[tienda] Error al guardar:", error);
      toast({ variant: "destructive", title: "Error al guardar", description: "Hubo un problema al conectar con la base de datos." });
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 pb-20 font-sans animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-5 sticky top-0 z-10 flex items-center gap-4 shadow-sm">
        <Button variant="ghost" size="icon" onClick={() => router.push("/vendedor")} className="text-slate-400 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-black text-slate-800 truncate">Mi Tienda</h1>
          <p className="text-[11px] text-slate-400 font-medium">Configuración del local</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowConfigGuide(true)}
          className="text-slate-400 hover:text-primary shrink-0"
          aria-label="¿Cómo configurar mi tienda?"
        >
          <HelpCircle className="w-5 h-5" />
        </Button>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-5">
        <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
          <div className="h-1.5 bg-primary w-full" />
          <CardContent className="p-6 space-y-7">

            {/* Nombre */}
            <div className="space-y-2">
              <Label htmlFor="shopName" className="text-sm font-bold text-slate-700">Nombre de tu local</Label>
              <Input
                id="shopName"
                placeholder="Ej: Sabores del Patio"
                className="h-12 border-slate-200 focus:border-primary rounded-xl text-base"
                value={shopForm.nombreTienda}
                onChange={(e) => setShopForm({ ...shopForm, nombreTienda: e.target.value })}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="shopDesc" className="text-sm font-bold text-slate-700">¿De qué trata tu tienda?</Label>
              <Textarea
                id="shopDesc"
                placeholder="Describe tus productos o servicios..."
                className="min-h-[110px] border-slate-200 focus:border-primary rounded-xl text-base p-4"
                value={shopForm.descripcion}
                onChange={(e) => setShopForm({ ...shopForm, descripcion: e.target.value })}
              />
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Categoría</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.filter(c => c.id !== "all").map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setShopForm({ ...shopForm, categoria: cat.id })}
                    className={cn(
                      "h-11 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2",
                      shopForm.categoria === cat.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShopForm({ ...shopForm, categoria: "otra" })}
                  className={cn(
                    "h-11 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center",
                    shopForm.categoria === "otra" || (!CATEGORIES.some(c => c.id === shopForm.categoria) && shopForm.categoria !== "")
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                  )}
                >
                  Otra…
                </button>
              </div>
              {(shopForm.categoria === "otra" || (!CATEGORIES.some(c => c.id === shopForm.categoria) && shopForm.categoria !== "")) && (
                <Input
                  placeholder="Escribe tu categoría personalizada..."
                  className="h-11 border-slate-200 focus:border-primary rounded-xl text-sm"
                  value={shopForm.categoria === "otra" ? "" : shopForm.categoria}
                  onChange={(e) => setShopForm({ ...shopForm, categoria: e.target.value || "otra" })}
                  autoFocus
                />
              )}
            </div>

            {/* Foto */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Foto de tu local</Label>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group overflow-hidden relative aspect-video bg-slate-50/50 transition-all",
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

            {/* Medios de pago */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">¿Qué medios de pago aceptas?</Label>
              <div className="space-y-2">
                {[
                  { key: "efectivo", label: "Efectivo" },
                  { key: "debito", label: "Débito / Crédito" },
                  { key: "transferencia", label: "Transferencia" },
                  { key: "otro", label: "Otro" },
                ].map((medio) => (
                  <div key={medio.key} className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shopForm.mediosPago.includes(medio.key)}
                        onChange={() => toggleMedioPago(medio.key)}
                        className="w-4 h-4 accent-[#C9920A]"
                      />
                      <span className="text-sm text-slate-700">{medio.label}</span>
                    </label>
                    {medio.key === "otro" && shopForm.mediosPago.includes("otro") && (
                      <Input
                        placeholder="Ej: Pago en especie, criptomoneda..."
                        className="h-10 border-slate-200 focus:border-primary rounded-xl text-sm ml-7"
                        value={shopForm.otroMedio}
                        onChange={(e) => setShopForm({ ...shopForm, otroMedio: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-sm font-bold text-slate-700">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="+56 9 XXXX XXXX"
                className="h-12 border-slate-200 focus:border-primary rounded-xl text-base"
                value={shopForm.whatsapp}
                onChange={(e) => {
                  let val = e.target.value;
                  if (!val.startsWith("+")) val = "+" + val.replace(/^\++/, "");
                  setShopForm({ ...shopForm, whatsapp: val });
                }}
              />
            </div>

            {/* Instagram */}
            <div className="space-y-2">
              <Label htmlFor="instagram" className="text-sm font-bold text-slate-700">Instagram</Label>
              <Input
                id="instagram"
                placeholder="@tunegocio"
                className="h-12 border-slate-200 focus:border-primary rounded-xl text-base"
                value={shopForm.instagram}
                onChange={(e) => setShopForm({ ...shopForm, instagram: e.target.value })}
              />
            </div>

            {/* Ubicación */}
            <div className="space-y-2">
              <Label htmlFor="ubicacion" className="text-sm font-bold text-slate-700">Sector / Ubicación</Label>
              <Input
                id="ubicacion"
                list="ubicaciones-list"
                placeholder="Selecciona o escribe tu ubicación..."
                className="h-12 border-slate-200 focus:border-primary rounded-xl text-base"
                value={shopForm.ubicacion}
                onChange={(e) => setShopForm({ ...shopForm, ubicacion: e.target.value })}
              />
              <datalist id="ubicaciones-list">
                <option value="Outlet Curauma (Av. Lomas de la luz 4650, Curauma, Valparaíso)" />
                <option value="Tienda Patio Curauma (Avenida Universidad 134, Local 1)" />
                <option value="Patio Curauma Villa Alemana (Manuel Montt #1561, Villa Alemana)" />
              </datalist>
            </div>

            {/* Horario */}
            <div className="space-y-2">
              <Label htmlFor="horario" className="text-sm font-bold text-slate-700">Horario de atención</Label>
              <Input
                id="horario"
                placeholder="Ej: Lunes a Domingo 10:00 - 20:00"
                className="h-12 border-slate-200 focus:border-primary rounded-xl text-base"
                value={shopForm.horario}
                onChange={(e) => setShopForm({ ...shopForm, horario: e.target.value })}
              />
            </div>

            {/* Texto Promocional */}
            <div className="space-y-2">
              <Label htmlFor="promoText" className="text-sm font-bold text-slate-700">
                Texto Promocional{" "}
                <span className="font-normal text-slate-400">(Opcional)</span>
              </Label>
              <Textarea
                id="promoText"
                placeholder="Ej: Gana doble sello en compras sobre $15.000 este mes"
                className="min-h-[80px] border-slate-200 focus:border-primary rounded-xl text-sm p-4"
                value={shopForm.promoText}
                onChange={(e) => setShopForm({ ...shopForm, promoText: e.target.value })}
              />
              <p className="text-[10px] text-slate-400">
                Aparece en "Destacados del Patio" cuando tu local es Premium.
              </p>
            </div>

            {/* Toggle Premium — solo admin */}
            {isAdmin && (
              <div className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-amber-800">✦ Marca Ancla / Local Destacado</p>
                    <p className="text-[10px] text-amber-700/70 font-medium mt-0.5">
                      Aparece en el carrusel "Destacados del Patio" (solo admin)
                    </p>
                  </div>
                  <Switch
                    checked={shopForm.isPremium}
                    onCheckedChange={(val) => setShopForm({ ...shopForm, isPremium: val })}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
                {shopForm.isPremium && (
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    ✓ Este local aparecerá como PATROCINADO en el carrusel
                  </p>
                )}
              </div>
            )}

            {/* ── Mi Link in Bio (bioo.cl) ─────────────────────────────── */}
            <div className="mt-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50/60 p-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-black text-slate-800 flex items-center gap-2 flex-wrap">
                    Mi Link in Bio
                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-700 border border-violet-300">bioo.cl</span>
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                    Tu página de enlaces para la bio de Instagram, con tu WhatsApp, redes y web en un solo toque.
                  </p>
                </div>
              </div>

              {!biooInfo.handle ? (
                <div className="mt-4 space-y-3">
                  <Button
                    onClick={crearMiBioo}
                    disabled={biooBusy}
                    className="w-full h-12 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 gap-2"
                  >
                    {biooBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {biooBusy ? "Creando…" : "Crear mi Link in Bio"}
                  </Button>
                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Se crea con tus datos ya cargados.{" "}
                    {!shopForm.isPremium && (
                      <span className="text-violet-600 font-semibold">Con el plan Patrocinado desbloqueas temas, fondos y animaciones premium.</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-xl bg-white border border-violet-200 px-3 py-3">
                    <Link2 className="w-4 h-4 text-violet-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-800 truncate flex-1">bioo.cl/{biooInfo.handle}</span>
                    <button
                      type="button"
                      onClick={() => copiarBioo(biooInfo.publicUrl || `https://bioo.cl/${biooInfo.handle}`, "Enlace copiado")}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                      aria-label="Copiar enlace"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <a
                      href={biooInfo.publicUrl || `https://bioo.cl/${biooInfo.handle}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                      aria-label="Ver página"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={abrirEditorBioo}
                    disabled={biooOpening}
                    className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {biooOpening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {biooOpening ? "Abriendo editor…" : "Personalizar mi página →"}
                  </button>
                  <p className="text-[11px] text-slate-400 leading-relaxed text-center">
                    Entras directo al editor con tu sesión, sin volver a iniciar sesión.
                    {!shopForm.isPremium && <span className="text-violet-600 font-semibold"> Hazte Patrocinado para temas y fondos premium.</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Guardar */}
            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full h-14 bg-primary text-white font-black rounded-xl text-lg gap-3 shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Guardar Cambios
            </Button>

          </CardContent>
        </Card>
      </div>

      {/* ── Modal de Guía de Configuración ─────────────────────────────── */}
      {showConfigGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowConfigGuide(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
            style={{ maxHeight: "85dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="px-6 pt-5 pb-4 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Cómo configurar tu Tienda</h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Guía rápida para destacar en el Club</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowConfigGuide(false)} className="text-slate-400 shrink-0">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Contenido con scroll */}
            <div className="px-6 overflow-y-auto flex-1 space-y-5 pb-2">
              {[
                {
                  icon: "🏷️",
                  label: "Nombre del Local",
                  desc: "Usa el nombre comercial por el cual todos te conocen. ¡Es lo primero que verán los socios!",
                },
                {
                  icon: "📝",
                  label: "¿Qué ofrece tu tienda?",
                  desc: "Escribe una descripción breve y atractiva. Menciona tus productos estrella o lo que te hace único.",
                },
                {
                  icon: "📁",
                  label: "Categoría",
                  desc: "Elige la que mejor te represente. Esto permite que los clientes te encuentren filtrando por sus intereses.",
                },
                {
                  icon: "📸",
                  label: "Foto de Portada",
                  desc: "Usa una foto real de tu local o de tus mejores productos. Evita usar el logo aquí; para eso está el círculo de perfil. Una buena foto aumenta las visitas un 40%.",
                },
                {
                  icon: "📍",
                  label: "Ubicación y Horarios",
                  desc: "Asegúrate de que sean exactos. No hay nada peor para un cliente que llegar y encontrar el local cerrado.",
                },
                {
                  icon: "💳",
                  label: "Medios de Pago",
                  desc: "Marca todas las opciones que aceptes para evitar dudas en el momento de la compra.",
                },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-2xl shrink-0 leading-none mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer fijo */}
            <div className="px-6 pt-4 pb-8 shrink-0 border-t border-slate-100 mt-2">
              <Button
                className="w-full h-12 rounded-2xl font-bold"
                onClick={() => setShowConfigGuide(false)}
              >
                ¡Entendido, a configurar!
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
