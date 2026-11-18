import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPQLyvd_k08OJYUVOTJpzknKAydETEHgY",
  authDomain: "web-app-project-515019.firebaseapp.com",
  projectId: "web-app-project-515019",
  storageBucket: "web-app-project-515019.firebasestorage.app",
  messagingSenderId: "1066409550302",
  appId: "1:1066409550302:web:99d5fb9370d98cd1bf7d4f",
  measurementId: "G-PQ9L6ZWFF5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "web-app-database");
