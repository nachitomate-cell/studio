# 📦 Respaldo Completo - Club Patio Curauma

Este archivo contiene la lógica core del sistema para recuperación en caso de errores críticos.

## 1. Configuración Firebase (`src/lib/firebase.ts`)
```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCGwNEBNmyrOl1mrpZhGNEktneNtxYgxj0",
  authDomain: "studio-7914495232-557f1.firebaseapp.com",
  projectId: "studio-7914495232-557f1",
  storageBucket: "studio-7914495232-557f1.firebasestorage.app",
  messagingSenderId: "120681935080",
  appId: "1:120681935080:web:d41757280ca888b46bd95d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
```

## 2. Lógica de Puntos y Sellos (`src/lib/puntos.ts`)
```ts
import { doc, getDoc, updateDoc, setDoc, Firestore, increment, collection, addDoc } from "firebase/firestore";
import { enviarNotificacionLocal } from "./notificaciones";

export async function registrarCompra(db: Firestore, userId: string, vendedorId?: string) {
  const userRef = doc(db, "usuarios", userId);
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, { comprasRealizadas: 1, puntos: 100, createdAt: new Date().toISOString() });
      return;
    }
    const data = userSnap.data();
    const nuevasCompras = (data.comprasRealizadas || 0) + 1;
    await updateDoc(userRef, {
      comprasRealizadas: increment(1),
      puntos: increment(50),
      lastUpdate: new Date().toISOString()
    });
    await enviarNotificacionLocal(userId, "¡Sello Recibido! ✨", "Has sumado un nuevo sello.");
  } catch (error) { console.error(error); }
}
```

## 3. Motor de Notificaciones e IA (`src/lib/notificaciones.ts`)
```ts
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

export async function enviarNotificacionLocal(userId: string, titulo: string, mensaje: string) {
  const notifRef = collection(db, "usuarios", userId, "notificaciones");
  await addDoc(notifRef, { titulo, mensaje, fecha: new Date().toISOString() });
}
```

## 4. Flujo Genkit IA (`src/ai/flows/generate-promo-message-flow.ts`)
```ts
'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PromoOutputSchema = z.object({
  title: z.string(),
  message: z.string(),
  callToAction: z.string(),
});

export async function generatePromoMessage(input: {userName: string, stampsCount: number}) {
  const { output } = await ai.generate({
    prompt: `Eres el CM del Club Patio. Anima a ${input.userName} que tiene ${input.stampsCount} sellos.`,
    output: { schema: PromoOutputSchema },
  });
  return output!;
}
```

## 5. Datos Base (`src/lib/data.ts`)
```ts
export const PATIO_INFO = {
  name: "Outlet Curauma",
  address: "Av. Lomas de la Luz 4650, Valparaíso.",
  coordinates: { lat: -33.1316449, lng: -71.5668639 }
};

export const PREMIOS = [
  { id: 'sorteo', nombre: 'Gran Sorteo', costo: 10, icono: '🏆', esSorteo: true },
  { id: 'cafe', nombre: 'Café', costo: 5, icono: '☕' },
];
```

## 6. Panel Master Admin (`src/app/moderador/page.tsx`) - Lógica de Pruebas
```ts
// Este archivo contiene los botones de simulación Geofence e IA
// que se encuentran en la sección "Zona de Pruebas".
```

---
*Fin del Respaldo Consolidado*
