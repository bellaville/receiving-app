import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";

// Max lengths must match firestore.rules
const MAX_TEXT = 200;

const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 12, maxWidth: 400 };

export default function NewReceipt({ user }: { user: User }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [dateReceived, setDateReceived] = useState("");   // "YYYY-MM-DD" from the date input
  const [supplierLot, setSupplierLot] = useState("");
  const [growtownLot, setGrowtownLot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = {
      name: name.trim(),
      date_received: dateReceived,
      supplier_lot: supplierLot.trim(),
      growtown_lot: growtownLot.trim(),
    };
    if (!data.name || !data.date_received || !data.supplier_lot || !data.growtown_lot) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "cannabis_receipts"), {
        ...data,
        created_by: user.email,
        created_at: serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Add receipt</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <label style={fieldStyle}>
          Shipping Operator
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_TEXT} required />
        </label>
        <label style={fieldStyle}>
          Date Received
          <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} required />
        </label>
        <label style={fieldStyle}>
          Supplier Lot
          <input value={supplierLot} onChange={(e) => setSupplierLot(e.target.value)} maxLength={MAX_TEXT} required />
        </label>
        <label style={fieldStyle}>
          Growtown Lot
          <input value={growtownLot} onChange={(e) => setGrowtownLot(e.target.value)} maxLength={MAX_TEXT} required />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => navigate("/")} disabled={saving}>Cancel</button>
        </div>
      </form>
    </>
  );
}
