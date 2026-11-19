import {
  allFields, type FieldDef, type FormDef, type FormRow, type FormValues,
  type RawRow, type RawScalar, type RawValues, type ScalarField, type Scalar,
} from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Error keys: "field" for top-level fields, "group.<row index>.field" for fields inside a group row
export const rowErrorKey = (group: string, i: number, field: string) => `${group}.${i}.${field}`;

// Check one value. Returns the value to save (undefined = leave out) or an error.
function validateScalar(f: ScalarField, input: RawScalar | undefined): { value?: Scalar; error?: string } {
  if (f.type === "checkbox") {
    const checked = input === true;
    return f.required && !checked ? { error: "Must be ticked." } : { value: checked };
  }

  const text = typeof input === "string" ? input.trim() : "";
  if (text === "") return f.required ? { error: "Required." } : {};   // empty optional fields are not saved

  switch (f.type) {
    case "text":
    case "textarea":
      return text.length > f.maxLength ? { error: `Max ${f.maxLength} characters.` } : { value: text };
    case "date":
      return DATE_RE.test(text) ? { value: text } : { error: "Use YYYY-MM-DD." };
    case "number": {
      const n = Number(text);
      if (!Number.isFinite(n)) return { error: "Must be a number." };
      if (f.integer && !Number.isInteger(n)) return { error: "Must be a whole number." };
      if (!f.integer && f.decimals !== undefined && !new RegExp(`^-?\\d*(\\.\\d{0,${f.decimals}})?$`).test(text))
        return { error: `Max ${f.decimals} decimal places.` };
      if (f.min !== undefined && n < f.min) return { error: `Minimum ${f.min}.` };
      if (f.max !== undefined && n > f.max) return { error: `Maximum ${f.max}.` };
      return { value: n };
    }
    case "select":
      return f.options.includes(text) ? { value: text } : { error: "Pick an option." };
  }
}

// Turn raw input into the values to save, checking each field against its definition.
// Mirrors the checks in the generated firestore.rules.
export function validateForm(form: FormDef, raw: RawValues): { values: FormValues; errors: Record<string, string> } {
  const values: FormValues = {};
  const errors: Record<string, string> = {};

  for (const f of allFields(form)) {
    const input = raw[f.key];

    if (f.type === "group") {
      const rows: RawRow[] = Array.isArray(input) ? input : [];
      if (rows.length < f.minItems) errors[f.key] = `At least ${f.minItems} ${f.itemLabel.toLowerCase()} required.`;
      if (rows.length > f.maxItems) errors[f.key] = `At most ${f.maxItems} ${f.itemLabel.toLowerCase()}s.`;
      values[f.key] = rows.map((row, i) => {
        const out: FormRow = {};
        for (const rf of f.fields) {
          const r = validateScalar(rf, row[rf.key]);
          if (r.error) errors[rowErrorKey(f.key, i, rf.key)] = r.error;
          else if (r.value !== undefined) out[rf.key] = r.value;
        }
        return out;
      });
      continue;
    }

    const r = validateScalar(f, Array.isArray(input) ? undefined : input);
    if (r.error) errors[f.key] = r.error;
    else if (r.value !== undefined) values[f.key] = r.value;
  }

  return { values, errors };
}

// Display a saved value in the table (and later the PDF)
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
