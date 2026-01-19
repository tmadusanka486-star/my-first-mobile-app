import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuBEBDHv7ysqr3qAy7hQwUrcdFRhGVLlk",
  authDomain: "tnspowertechdb.firebaseapp.com",
  projectId: "tnspowertechdb",
  storageBucket: "tnspowertechdb.firebasestorage.app",
  messagingSenderId: "1077756319006",
  appId: "1:1077756319006:web:37be8246d261257192e50f",
  measurementId: "G-YHE5Z65RFF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);