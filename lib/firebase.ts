// Firebase init for NOVA OS
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBsPCSCT1_3yHR2tS36gMc0nU38mkRmH7w",
  authDomain: "nova-os-f1e54.firebaseapp.com",
  projectId: "nova-os-f1e54",
  storageBucket: "nova-os-f1e54.firebasestorage.app",
  messagingSenderId: "44422993216",
  appId: "1:44422993216:web:e377c16273b0b47b0d56a5",
  measurementId: "G-F1P5GM2DNC",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
