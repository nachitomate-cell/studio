import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

const DEMO_STORES = [
  {
    id: "demo_1",
    businessName: "Eco Hogar 🌿",
    category: "deco",
    description: "Transforma tus espacios con nuestra decoración sustentable y productos amigables con el medio ambiente.",
    contactPhone: "+56 9 1111 2222",
    operatingHours: "Lun - Sáb 10:00 - 20:00",
    ubicacionTienda: "loc-1",
    imageUrl: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=500&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=500&q=80"]
  },
  {
    id: "demo_2",
    businessName: "Gourmet Paradise 🍷",
    category: "gourmet",
    description: "Una selección curada de los mejores vinos, quesos artesanales y productos gourmet locales de la región de Valparaíso.",
    contactPhone: "+56 9 3333 4444",
    operatingHours: "Mar - Dom 11:00 - 21:00",
    ubicacionTienda: "loc-2",
    imageUrl: "https://images.unsplash.com/photo-1563514787941-8c46522f77c3?w=500&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1563514787941-8c46522f77c3?w=500&q=80"]
  },
  {
    id: "demo_3",
    businessName: "Aurea Joyas ✨",
    category: "joyeria",
    description: "Joyería hecha a mano con metales nobles y diseños exclusivos para destacar tu belleza natural. Piezas únicas.",
    contactPhone: "+56 9 5555 6666",
    operatingHours: "Lun - Sab 10:00 - 19:00",
    ubicacionTienda: "loc-3",
    imageUrl: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80"]
  },
  {
    id: "demo_4",
    businessName: "Lumia Cosmética 🌸",
    category: "belleza",
    description: "Todo lo que necesitas para tu rutina de skincare y maquillaje profesional cruelty-free. Cuidamos tu piel.",
    contactPhone: "+56 9 7777 8888",
    operatingHours: "Lun - Vie 09:00 - 20:00",
    ubicacionTienda: "loc-4",
    imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80",
    imageUrls: ["https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80"]
  }
];

export async function GET() {
  try {
    for (const store of DEMO_STORES) {
      await setDoc(doc(db, "entrepreneur_profiles", store.id), store);
    }
    return NextResponse.json({ success: true, message: "Locales de demostración inyectados correctamente." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
