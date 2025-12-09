import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0gPPt5_am4dIsxaAnvJoNzlV5TaHM0sI",
  authDomain: "equitycompass-6bc83.firebaseapp.com",
  projectId: "equitycompass-6bc83",
  storageBucket: "equitycompass-6bc83.firebasestorage.app",
  messagingSenderId: "28907585032",
  appId: "1:28907585032:web:d2810c79341b098f309bbd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);