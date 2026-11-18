import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User,
} from "firebase/auth";
import { auth, db } from "./firebase";

type Receipt = { id: string; name: string; date: string };

// A Firestore date may be a Timestamp object or a plain string; display either
function formatDate(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toLocaleString("en-CA") : String(v ?? "");
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);    // signed-in user, or null
  const [rows, setRows] = useState<Receipt[]>([]);        // data from Firestore
  const [error, setError] = useState("");

  // Listen for sign-in / sign-out
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Once signed in, read every document in cannabis_receipts
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "cannabis_receipts"))
      .then((snap) =>
        setRows(snap.docs.map((d) => ({
          id: d.id,
          name: d.data().Name,
          date: formatDate(d.data().Date),
        })))
      )
      .catch((e) => setError(e.message));
  }, [user]);

  if (!user) {
    return (
      <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}>
        Sign in with Google
      </button>
    );
  }

  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
      <p>{user.email} <button onClick={() => signOut(auth)}>Sign out</button></p>
      <h1>Cannabis receipts</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <table border={1} cellPadding={6}>
        <thead><tr><th>ID</th><th>Name</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.date}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
