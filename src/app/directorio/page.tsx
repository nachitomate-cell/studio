"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection, onSnapshot, doc, updateDoc, addDoc, getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth, storage } from "@/lib/firebase";
import { CATEGORIES } from "@/lib/data";
import { DIAS_SEMANA, DIAS_SHORT, DIAS_LABEL, HorariosEstructurados, HorarioDia } from "@/lib/horarios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Edit3, Trash2, Loader2,
  Search, ImagePlus, X, Check, Crown,
} from "lucide-react";
import { getSafeImageUrl } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorProfile {
  id: string;
  businessName: string;
  category: string;
  description: string;
  imageUrl: string;
  imagenTarjeta?: string;
  whatsapp: string;
  instagram: string;
  website: string;
  ubicacionTienda: string;
  operatingHours: string;
  mediosPago: string[];
  active: boolean;
  isPremium: boolean;
  promoText: string;
}

interface VendorForm {
  businessName: string;
  category: string;
  description: string;
  imageUrl: string;
  whatsapp: string;
  instagram: string;
  website: string;
  ubicacionTienda: string;
  operatingHours: string;
  mediosPago: string[];
  active: boolean;
  isPremium: boolean;
  promoText: string;
  horariosEstructurados: HorariosEstructurados;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_FORM: VendorForm = {
  businessName: "",
  category: "",
  description: "",
  imageUrl: "",
  whatsapp: "",
  instagram: "",
  website: "",
  ubicacionTienda: "",
  operatingHours: "",
  mediosPago: [],
  active: false,
  isPremium: false,
  promoText: "",
  horariosEstructurados: {},
};

const VENDOR_CATEGORIES = [
  ...CATEGORIES.filter((c) => c.id !== "all"),
  { id: "PORTAL", name: "Portal / Directorio", icon: "" },
];

const PAYMENT_OPTIONS = [
  { key: "efectivo",      label: "Efectivo" },
  { key: "debito",        label: "Débito / Crédito" },
  { key: "transferencia", label: "Transferencia" },
];

const ADMIN_ROLES = ["admin", "director", "director_patio", "moderador"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DirectorioPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Auth
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Data
  const [vendors, setVendors]       = useState<VendorProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Form modal state
  const [showForm, setShowForm]               = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [form, setForm]                       = useState<VendorForm>(DEFAULT_FORM);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview]       = useState<string | null>(null);
  const [savingForm, setSavingForm]           = useState(false);
  const [uploadingImage, setUploadingImage]   = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Auth guard ───────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.replace("/"); return; }

      const masterEmail = (
        process.env.NEXT_PUBLIC_ADMIN_EMAIL || "ignaciiio.mate@gmail.com"
      ).trim().toLowerCase();

      if ((user.email ?? "").trim().toLowerCase() === masterEmail) {
        setIsAuthorized(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        const data = snap.data();
        const rol: string            = data?.rol ?? "";
        const roles: string[]        = Array.isArray(data?.roles) ? data.roles : [];
        const ok = ADMIN_ROLES.includes(rol) || roles.some((r) => ADMIN_ROLES.includes(r));
        if (ok) {
          setIsAuthorized(true);
        } else {
          toast({ variant: "destructive", title: "Acceso denegado" });
          router.replace("/");
        }
      } catch {
        router.replace("/");
      }
    });
    return () => unsub();
  }, [router, toast]);

  // ── Firestore listener ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthorized) return;

    const unsub = onSnapshot(collection(db, "entrepreneur_profiles"), (snap) => {
      const data: VendorProfile[] = snap.docs.map((d) => {
        const v = d.data();
        return {
          id:              d.id,
          businessName:    v.businessName  || v.nombre       || "",
          category:        v.category      || v.rubro        || "",
          description:     v.description   || v.descripcion  || "",
          imageUrl:        v.imageUrls?.[0] || v.imageUrl    || v.imagenUrl || "",
          imagenTarjeta:   v.imagenTarjeta  || undefined,
          whatsapp:        v.whatsapp       || "",
          instagram:       v.instagram      || "",
          website:         v.website        || "",
          ubicacionTienda: v.ubicacionTienda || v.address    || "",
          operatingHours:  v.operatingHours  || v.horario    || "",
          mediosPago:      Array.isArray(v.mediosPago) ? v.mediosPago : [],
          active:          v.active !== false,
          isPremium:       v.isPremium === true,
          promoText:       v.promoText      || "",
        };
      });
      data.sort((a, b) => a.businessName.localeCompare(b.businessName));
      setVendors(data);
    });

    return () => unsub();
  }, [isAuthorized]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  const openEdit = (vendor: VendorProfile) => {
    setEditingVendorId(vendor.id);
    setForm({
      businessName:    vendor.businessName,
      category:        vendor.category,
      description:     vendor.description,
      imageUrl:        vendor.imageUrl,
      whatsapp:        vendor.whatsapp,
      instagram:       vendor.instagram,
      website:         vendor.website,
      ubicacionTienda: vendor.ubicacionTienda,
      operatingHours:  vendor.operatingHours,
      mediosPago:      vendor.mediosPago,
      active:          vendor.active,
      isPremium:       vendor.isPremium,
      promoText:       vendor.promoText,
      horariosEstructurados: (vendor as any).horariosEstructurados || {},
    });
    setPendingImageFile(null);
    setImagePreview(
      getSafeImageUrl(vendor.imagenTarjeta || vendor.imageUrl, "") || null
    );
    setShowForm(true);
  };

  const openCreate = () => {
    setEditingVendorId(null);
    setForm(DEFAULT_FORM);
    setPendingImageFile(null);
    setImagePreview(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (savingForm) return;
    setShowForm(false);
  };

  const handleImageFileChange = (file: File) => {
    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const togglePago = (key: string) => {
    setForm((f) => ({
      ...f,
      mediosPago: f.mediosPago.includes(key)
        ? f.mediosPago.filter((m) => m !== key)
        : [...f.mediosPago, key],
    }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      toast({ variant: "destructive", title: "El nombre del local es obligatorio" });
      return;
    }

    setSavingForm(true);
    try {
      let vendorId = editingVendorId;

      // ── 1. Crear documento nuevo si es alta ──────────────────────────
      if (!vendorId) {
        const newRef = await addDoc(collection(db, "entrepreneur_profiles"), {
          businessName:    form.businessName.trim(),
          nombre:          form.businessName.trim(),
          category:        form.category,
          rubro:           form.category,
          description:     form.description.trim(),
          descripcion:     form.description.trim(),
          imageUrl:        "",
          imageUrls:       [],
          whatsapp:        form.whatsapp.trim(),
          instagram:       form.instagram.trim(),
          website:         form.website.trim(),
          ubicacionTienda: form.ubicacionTienda.trim(),
          address:         form.ubicacionTienda.trim(),
          operatingHours:  form.operatingHours.trim(),
          horario:         form.operatingHours.trim(),
          mediosPago:           form.mediosPago,
          horariosEstructurados: form.horariosEstructurados,
          active:               false, // siempre inactivo al crear
          isPremium:            false,
          promoText:            form.promoText.trim(),
          createdAt:            new Date().toISOString(),
          updatedAt:            new Date().toISOString(),
        });
        vendorId = newRef.id;
      }

      // ── 2. Subir imagen si se seleccionó una ─────────────────────────
      let imageUrl = form.imageUrl;
      if (pendingImageFile) {
        setUploadingImage(true);
        const storageRef = ref(
          storage,
          `entrepreneur_photos/${vendorId}/profile_${Date.now()}`
        );
        await uploadBytes(storageRef, pendingImageFile);
        imageUrl = await getDownloadURL(storageRef);
        setUploadingImage(false);
      }

      // ── 3. Actualizar todos los campos ───────────────────────────────
      const payload: Record<string, any> = {
        businessName:    form.businessName.trim(),
        nombre:          form.businessName.trim(),
        category:        form.category,
        rubro:           form.category,
        description:     form.description.trim(),
        descripcion:     form.description.trim(),
        whatsapp:        form.whatsapp.trim(),
        instagram:       form.instagram.trim(),
        website:         form.website.trim(),
        ubicacionTienda: form.ubicacionTienda.trim(),
        address:         form.ubicacionTienda.trim(),
        operatingHours:  form.operatingHours.trim(),
        horario:         form.operatingHours.trim(),
        mediosPago:           form.mediosPago,
        horariosEstructurados: form.horariosEstructurados,
        // En edición respetamos el toggle activo; en creación es siempre false
        active:               editingVendorId ? form.active : false,
        isPremium:       form.isPremium,
        promoText:       form.promoText.trim(),
        updatedAt:       new Date().toISOString(),
      };

      if (imageUrl) {
        payload.imageUrl      = imageUrl;
        payload.imageUrls     = [imageUrl];
        payload.imagenTarjeta = imageUrl;
        payload.imagenPerfil  = imageUrl;
      }

      await updateDoc(doc(db, "entrepreneur_profiles", vendorId), payload);

      toast({
        title: editingVendorId ? "✓ Cambios guardados" : "✓ Local creado",
        description: editingVendorId
          ? undefined
          : "El local está inactivo por defecto. Actívalo cuando esté listo.",
      });
      setShowForm(false);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err.message ?? "Intenta de nuevo.",
      });
    } finally {
      setSavingForm(false);
      setUploadingImage(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget || !auth.currentUser) return;
    setDeleting(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res  = await fetch("/api/delete-vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: deleteTarget.id, idToken }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Local eliminado" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: err.message ?? "Intenta de nuevo.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────

  const filteredVendors = vendors.filter(
    (v) =>
      v.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Loading state ────────────────────────────────────────────────────────

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50/50 pb-32">

      {/* ── Header sticky ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => router.push("/director")}
            className="text-slate-400 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-slate-800 truncate">Directorio de Locales</h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {vendors.length} locales registrados
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-4">

        {/* ── Botón alta ─────────────────────────────────────────────── */}
        <Button
          onClick={openCreate}
          className="w-full h-12 rounded-2xl font-black gap-2 bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" /> Agregar emprendedor
        </Button>

        {/* ── Buscador ───────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre o categoría..."
            className="pl-11 h-11 rounded-xl bg-white border-slate-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* ── Lista ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {filteredVendors.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-400 italic">
              {searchQuery
                ? "Sin resultados para esa búsqueda."
                : "No hay locales registrados aún."}
            </div>
          ) : (
            filteredVendors.map((vendor) => (
              <Card key={vendor.id} className="border-none shadow-sm bg-white rounded-2xl">
                <CardContent className="p-3 flex items-center gap-3">

                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                    <img
                      src={getSafeImageUrl(
                        vendor.imagenTarjeta || vendor.imageUrl,
                        "/Logo2.png"
                      )}
                      alt={vendor.businessName || "Local"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/Logo2.png";
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {vendor.businessName || (
                          <span className="text-slate-400 italic font-normal">Sin nombre</span>
                        )}
                      </p>
                      {vendor.isPremium && (
                        <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {vendor.category && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          {vendor.category}
                        </span>
                      )}
                      {vendor.category && <span className="text-slate-200">·</span>}
                      <span
                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: vendor.active ? "#DCFCE7" : "#F1F5F9",
                          color:      vendor.active ? "#15803D" : "#94A3B8",
                        }}
                      >
                        {vendor.active ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(vendor)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          id:   vendor.id,
                          name: vendor.businessName || "Sin nombre",
                        })
                      }
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* ── Modal: formulario de edición / creación ─────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeForm}
        >
          <div
            className="w-full bg-white rounded-t-[28px] animate-in slide-in-from-bottom-4 duration-300 max-h-[93vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + título */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-800">
                {editingVendorId ? "Editar local" : "Nuevo local"}
              </h2>
              <button
                onClick={closeForm}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

              {/* ── FOTO ───────────────────────────────────────────── */}
              <section className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Foto del local
                </p>
                <label className="block cursor-pointer group">
                  <div
                    className="relative w-full rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center"
                    style={{ minHeight: "140px" }}
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full object-cover"
                        style={{ maxHeight: "200px" }}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <ImagePlus className="w-8 h-8 text-slate-300" />
                        <span className="text-xs text-slate-400 font-medium">
                          Toca para subir foto
                        </span>
                      </div>
                    )}
                    {imagePreview && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full transition-opacity">
                          Cambiar foto
                        </span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFileChange(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>

              {/* ── INFORMACIÓN BÁSICA ─────────────────────────────── */}
              <section className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Información básica
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Nombre del local <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Ej: Fronza Gourmet"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Sin categoría —</option>
                    {VENDOR_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Descripción</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe el local y sus productos..."
                    className="rounded-xl min-h-[80px] resize-none"
                  />
                </div>
              </section>

              {/* ── CONTACTO ───────────────────────────────────────── */}
              <section className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Contacto
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">WhatsApp</label>
                  <Input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="+56912345678"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Instagram</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                      @
                    </span>
                    <Input
                      value={form.instagram}
                      onChange={(e) =>
                        setForm({ ...form, instagram: e.target.value.replace("@", "") })
                      }
                      placeholder="nombre_sin_arroba"
                      className="h-11 rounded-xl pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Sitio web
                    <span className="text-slate-400 font-normal ml-1">(opcional)</span>
                  </label>
                  <Input
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://..."
                    className="h-11 rounded-xl"
                  />
                </div>
              </section>

              {/* ── INFORMACIÓN OPERATIVA ──────────────────────────── */}
              <section className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Información operativa
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">
                    Sector / Ubicación
                  </label>
                  <Input
                    list="ubicaciones-admin-list"
                    value={form.ubicacionTienda}
                    onChange={(e) => setForm({ ...form, ubicacionTienda: e.target.value })}
                    placeholder="Selecciona o escribe una ubicación..."
                    maxLength={100}
                    className="h-11 rounded-xl"
                  />
                  <datalist id="ubicaciones-admin-list">
                    <option value="Outlet Curauma (Av. Lomas de la luz 4650, Curauma, Valparaíso)" />
                    <option value="Tienda Patio Curauma (Avenida Universidad 134, Local 1)" />
                    <option value="Patio Curauma Villa Alemana (Manuel Montt #1561, Villa Alemana)" />
                  </datalist>
                  <div className="flex items-center justify-between px-0.5 mt-1">
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Elige una opción sugerida o escribe una personalizada.
                    </p>
                    <span className="text-[11px] text-slate-300 shrink-0 ml-2">
                      {form.ubicacionTienda.length}/100
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Horario de atención</label>
                  <Input
                    value={form.operatingHours}
                    onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
                    placeholder="Ej: Lun–Dom 10:00 – 20:00"
                    className="h-11 rounded-xl"
                  />
                </div>

                {/* ── Horario por día ──────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">Horario por día</p>
                  {DIAS_SEMANA.map((dia) => {
                    const h: HorarioDia = form.horariosEstructurados[dia] ?? { open: "10:00", close: "20:00", cerrado: false };
                    return (
                      <div key={dia} className="flex items-center gap-2 text-sm">
                        <span className="w-10 text-[11px] font-bold text-slate-500 uppercase">{DIAS_SHORT[dia]}</span>
                        <Switch
                          checked={!h.cerrado}
                          onCheckedChange={(v) => setForm(f => ({
                            ...f,
                            horariosEstructurados: { ...f.horariosEstructurados, [dia]: { ...h, cerrado: !v } }
                          }))}
                          className="scale-75"
                        />
                        {!h.cerrado && (
                          <>
                            <input type="time" value={h.open} onChange={(e) => setForm(f => ({
                              ...f,
                              horariosEstructurados: { ...f.horariosEstructurados, [dia]: { ...h, open: e.target.value } }
                            }))} className="border rounded px-2 py-1 text-xs w-24" />
                            <span className="text-slate-400 text-xs">–</span>
                            <input type="time" value={h.close} onChange={(e) => setForm(f => ({
                              ...f,
                              horariosEstructurados: { ...f.horariosEstructurados, [dia]: { ...h, close: e.target.value } }
                            }))} className="border rounded px-2 py-1 text-xs w-24" />
                          </>
                        )}
                        {h.cerrado && <span className="text-xs text-slate-400 italic">Cerrado</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600">Métodos de pago</label>
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_OPTIONS.map((p) => {
                      const checked = form.mediosPago.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => togglePago(p.key)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{
                            background: checked ? "#EFF6FF" : "#F8FAFC",
                            color:      checked ? "#1D4ED8" : "#94A3B8",
                            border:     checked ? "1.5px solid #BFDBFE" : "1.5px solid #E2E8F0",
                          }}
                        >
                          {checked
                            ? <Check className="w-3 h-3 shrink-0" />
                            : <span className="w-3 h-3 shrink-0" />}
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── VISIBILIDAD ────────────────────────────────────── */}
              <section className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Visibilidad
                </p>

                {/* Toggle activo — solo en edición (al crear siempre es false) */}
                {editingVendorId && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Local activo</p>
                      <p className="text-[11px] text-slate-400">Visible en el directorio público</p>
                    </div>
                    <Switch
                      checked={form.active}
                      onCheckedChange={(v) => setForm({ ...form, active: v })}
                    />
                  </div>
                )}

                {/* Toggle patrocinado */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      Patrocinado
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Aparece en "Destacados del Patio"
                    </p>
                  </div>
                  <Switch
                    checked={form.isPremium}
                    onCheckedChange={(v) => setForm({ ...form, isPremium: v })}
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>

                {/* Texto del banner (solo si es premium) */}
                {form.isPremium && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">
                      Texto del banner patrocinado
                    </label>
                    <Textarea
                      value={form.promoText}
                      onChange={(e) => setForm({ ...form, promoText: e.target.value })}
                      placeholder="Ej: Gana doble sello en compras sobre $15.000 🍷"
                      className="rounded-xl min-h-[64px] resize-none border-amber-200 focus:border-amber-400"
                    />
                  </div>
                )}

                {/* Aviso al crear */}
                {!editingVendorId && (
                  <p className="text-[11px] text-slate-400 leading-relaxed px-1">
                    ℹ️ El local se creará como{" "}
                    <span className="font-bold">inactivo</span>. Actívalo desde el
                    directorio cuando esté listo para aparecer en el feed público.
                  </p>
                )}
              </section>

              <div className="h-2" />
            </div>

            {/* Footer con botones */}
            <div className="px-6 py-4 border-t border-slate-100 shrink-0 bg-white flex gap-3">
              <Button
                variant="outline"
                onClick={closeForm}
                disabled={savingForm}
                className="flex-1 h-12 rounded-2xl font-bold border-slate-200"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={savingForm}
                className="flex-1 h-12 rounded-2xl font-black bg-primary text-white hover:bg-primary/90 gap-2"
              >
                {savingForm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadingImage ? "Subiendo foto…" : "Guardando…"}
                  </>
                ) : editingVendorId ? (
                  "Guardar cambios"
                ) : (
                  "Crear local"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: confirmación de eliminación ──────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm rounded-[2rem] border-none shadow-2xl animate-in zoom-in-95 duration-300">
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-500" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-800">¿Eliminar local?</h2>
                  <p className="text-sm font-bold text-primary">"{deleteTarget.name}"</p>
                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    Se eliminarán el perfil y todos sus datos asociados.
                    <br />Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 h-12 rounded-xl font-bold border-slate-200"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-12 rounded-xl font-black bg-red-500 hover:bg-red-600 text-white gap-2"
                >
                  {deleting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
