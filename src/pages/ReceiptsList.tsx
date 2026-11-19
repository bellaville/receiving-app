import { useEffect, useState } from "react";
import { Link } from "react-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { currentReceiptForm, receiptFormVersions } from "../forms/receipt.ts";
import { allFields, type FormValues } from "../forms/types.ts";
import { formatValue } from "../forms/validate.ts";

type Receipt = { id: string; form_version: number; values: FormValues };

export default function ReceiptsList() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [error, setError] = useState("");

  // Columns come from the current form's fields marked inList
  const columns = allFields(currentReceiptForm).filter((f) => f.inList);

  // Read every document in cannabis_receipts (runs each time this page opens)
  useEffect(() => {
    getDocs(collection(db, "cannabis_receipts"))
      .then((snap) =>
        setRows(snap.docs.map((d) => ({
          id: d.id,
          form_version: d.data().form_version,
          values: d.data().values ?? {},
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
        <thead>
          <tr><th>ID</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Form</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // Format each value using the field definition from the version it was saved with
            const savedFields = receiptFormVersions[r.form_version];
            return (
              <tr key={r.id}>
                <td>{r.id}</td>
                {columns.map((c) => {
                  const f = savedFields ? allFields(savedFields).find((x) => x.key === c.key) : undefined;
                  return <td key={c.key}>{formatValue(f ?? c, r.values[c.key])}</td>;
                })}
                <td>{savedFields ? `v${r.form_version}` : "unknown"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
