import type { FieldDef } from "./types.ts";

// Display a saved value as text, using the field definition from the version the record
// was saved under. Used by the receipts table (and later the PDF).
export function formatValue(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null) return "";
  switch (f.type) {
    case "group":
      return Array.isArray(v) ? String(v.length) : "";
    case "checkbox":
      return v ? "Yes" : "No";
    case "number": {
      const n = typeof v === "number" && f.decimals !== undefined && !f.integer ? v.toFixed(f.decimals) : String(v);
      return f.unit ? `${n} ${f.unit}` : n;
    }
    default:
      return String(v);
  }
}
