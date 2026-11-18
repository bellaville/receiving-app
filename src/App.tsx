import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User,
} from "firebase/auth";
import { auth } from "./firebase";
import ReceiptsList from "./pages/ReceiptsList";
import NewReceipt from "./pages/NewReceipt";

export default function App() {
  const [user, setUser] = useState<User | null>(null);    // signed-in user, or null

  // Listen for sign-in / sign-out
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (!user) {
    return (
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
        Sign in with Google
      </button>
    );
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
      <header style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Link to="/">Receipts</Link>
        <span style={{ marginLeft: "auto" }}>{user.email}</span>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </header>
      <Routes>
        <Route path="/" element={<ReceiptsList />} />
        <Route path="/receipts/new" element={<NewReceipt user={user} />} />
        <Route path="*" element={<p>Page not found. <Link to="/">Back to receipts</Link></p>} />
      </Routes>
    </main>
  );
}
