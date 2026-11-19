import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { currentReceiptForm, receiptFormVersions } from "../forms/receipt.ts";
import { allFields, type FieldDef, type FormRow, type FormValues, type GroupField } from "../forms/types.ts";
import { formatValue } from "../forms/format.ts";

type Receipt = { id: string; form_version: number; values: FormValues };

// Field definition for `key` in the version a receipt was saved under (undefined if that version lacks it)
function savedField(r: Receipt, key: string): FieldDef | undefined {
  const form = receiptFormVersions[r.form_version];
  return form ? allFields(form).find((x) => x.key === key) : undefined;
}

// Repeating groups (e.g. items) in this receipt that have at least one row
function savedGroups(r: Receipt): { field: GroupField; rows: FormRow[] }[] {
  const form = receiptFormVersions[r.form_version];
  if (!form) return [];
  return allFields(form).flatMap((f) => {
    const rows = r.values[f.key];
    return f.type === "group" && Array.isArray(rows) && rows.length > 0 ? [{ field: f, rows }] : [];
  });
}

export default function ReceiptsList() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [error, setError] = useState("");
  // IDs of receipts whose items are shown. Page state only: resets on reload.
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Columns come from the current form's fields marked inList
  const columns = allFields(currentReceiptForm).filter((f) => f.inList);
  const expandable = rows.filter((r) => savedGroups(r).length > 0);

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

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOpen = expandable.length > 0 && expandable.every((r) => open.has(r.id));

  return (
    <>
      <h1>Cannabis receipts</h1>
      <p style={{ display: "flex", gap: 8 }}>
        <Link to="/receipts/new"><button>Add receipt</button></Link>
        {expandable.length > 0 && (
          <button onClick={() => setOpen(allOpen ? new Set() : new Set(expandable.map((r) => r.id)))}>
            {allOpen ? "Hide all items" : "Show all items"}
          </button>
        )}
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <table border={1} cellPadding={6}>
        <thead>
          <tr><th>ID</th>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Form</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const groups = savedGroups(r);
            const isOpen = open.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr>
                  <td>{r.id}</td>
                  {columns.map((c) => {
                    // Format using the field definition from the version the receipt was saved with
                    const f = savedField(r, c.key);
                    const text = formatValue(f ?? c, r.values[c.key]);
                    const hasRows = groups.some((g) => g.field.key === c.key);
                    return (
                      <td key={c.key}>
                        {text}
                        {hasRows && (
                          <> <button onClick={() => toggle(r.id)}>{isOpen ? "Hide items" : "Show items"}</button></>
                        )}
                      </td>
                    );
                  })}
                  <td>{receiptFormVersions[r.form_version] ? `v${r.form_version}` : "unknown"}</td>
                </tr>
                {isOpen && groups.length > 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} style={{ paddingLeft: 32 }}>
                      {groups.map(({ field: g, rows: items }) => (
                        <table key={g.key} border={1} cellPadding={4} style={{ marginBottom: 8 }}>
                          <thead>
                            <tr><th>#</th>{g.fields.map((f) => <th key={f.key}>{f.label}</th>)}</tr>
                          </thead>
                          <tbody>
                            {items.map((item, i) => (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                {g.fields.map((f) => <td key={f.key}>{formatValue(f, item[f.key])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
