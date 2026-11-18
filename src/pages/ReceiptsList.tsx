import { useEffect, useState } from "react";
import { Link } from "react-router";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

type Receipt = { id: string; name: string; date: string; supplier_lot: string; growtown_lot: string };

// date_received is a "YYYY-MM-DD" string on new records; older records may hold a Timestamp
function formatDate(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toLocaleString("en-CA") : String(v ?? "");
}

export default function ReceiptsList() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [error, setError] = useState("");

  // Read every document in cannabis_receipts (runs each time this page opens)
  useEffect(() => {
    getDocs(collection(db, "cannabis_receipts"))
      .then((snap) =>
        setRows(snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          date: formatDate(d.data().date_received),
          supplier_lot: d.data().supplier_lot,
          growtown_lot: d.data().growtown_lot,
        })))
      )
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <h1>Cannabis receipts</h1>
      <p><Link to="/receipts/new"><button>Add receipt</button></Link></p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <table border={1} cellPadding={6}>
        <thead><tr><th>ID</th><th>Shipping Operator</th><th>Date Received</th><th>Supplier Lot</th><th>Growtown Lot</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.date}</td><td>{r.supplier_lot}</td><td>{r.growtown_lot}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
