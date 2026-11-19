// Field-list types shared by the form renderer, the receipts table and scripts/gen-rules.ts.
// Field keys are permanent: once a key has been used in a saved record, never rename it
// or reuse it for a different meaning. Labels may be reworded freely.

type BaseField = {
  key: string;          // stored name in Firestore: lowercase letters, digits, underscores
  label: string;        // shown on the form, table and (later) PDF
  required?: boolean;   // checkbox: required means it must be ticked
  help?: string;        // small hint under the input
  inList?: boolean;     // show as a column in the receipts table
};

// A single-value field
export type ScalarField =
  | (BaseField & { type: "text" | "textarea"; maxLength: number })
  | (BaseField & { type: "date" })                                   // stored as "YYYY-MM-DD"
  | (BaseField & {
      type: "number"; min?: number; max?: number; unit?: string;
      integer?: boolean;    // whole numbers only
      decimals?: number;    // max decimal places (ignored when integer)
    })
  | (BaseField & { type: "select"; options: string[] })              // required: an option must be picked
  | (BaseField & { type: "checkbox" });

// A repeating set of fields, stored as a list of rows. In the table it shows as a row count.
export type GroupField = BaseField & {
  type: "group";
  itemLabel: string;      // name of one row, e.g. "Item" -> "Item 1", "Add item"
  minItems: number;
  maxItems: number;       // keep small: rules check each row position individually
  fields: ScalarField[];
};

export type FieldDef = ScalarField | GroupField;

export type FormSection = { title: string; fields: FieldDef[] };

export type FormDef = { version: number; sections: FormSection[] };

// Validated values as saved under `values` in Firestore. Empty optional fields are left out.
export type Scalar = string | number | boolean;
export type FormRow = Record<string, Scalar>;
export type FormValues = Record<string, Scalar | FormRow[]>;

// Raw input state while the user is typing (numbers are still strings here)
export type RawScalar = string | boolean;
export type RawRow = Record<string, RawScalar>;
export type RawValues = Record<string, RawScalar | RawRow[]>;

export function allFields(form: FormDef): FieldDef[] {
  return form.sections.flatMap((s) => s.fields);
}

// Starting state for a new entry: each group gets its minimum number of empty rows
export function initialRaw(form: FormDef): RawValues {
  const raw: RawValues = {};
  for (const f of allFields(form)) {
    if (f.type === "group") raw[f.key] = Array.from({ length: f.minItems }, () => ({}));
  }
  return raw;
}
