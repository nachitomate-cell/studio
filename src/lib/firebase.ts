
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
