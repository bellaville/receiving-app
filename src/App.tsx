import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User,
} from "firebase/auth";
import { auth } from "./firebase";
import ReceiptsList from "./pages/ReceiptsList";
import NewReceipt from "./pages/NewReceipt";

// Company domain. Convenience check only: Firestore rules and the Internal
// OAuth audience are the actual access controls.
const ALLOWED_DOMAIN = "growtown.ca";

function isCompanyAccount(u: User) {
  return u.emailVerified && !!u.email && u.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);    // signed-in user, or null
  const [error, setError] = useState<string | null>(null);

  // Listen for sign-in / sign-out; sign out anyone outside the company domain
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (u && !isCompanyAccount(u)) {
      setError(`${u.email ?? "This account"} is not a @${ALLOWED_DOMAIN} account. Sign in with your company Google account.`);
      setUser(null);
      void signOut(auth);
      return;
    }
    setUser(u);
  }), []);

  async function signIn() {
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ALLOWED_DOMAIN, prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      setError("Sign-in failed. Use your company Google account and try again.");
    }
  }

  if (!user) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
        <button onClick={signIn}>Sign in with Google</button>
        {error && <p role="alert" style={{ color: "#b00020" }}>{error}</p>}
      </div>
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
