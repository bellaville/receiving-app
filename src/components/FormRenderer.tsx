import type { FormDef, GroupField, RawRow, RawScalar, RawValues, ScalarField } from "../forms/types.ts";
import { rowErrorKey } from "../forms/validate.ts";

type Props = {
  form: FormDef;
  raw: RawValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: RawScalar | RawRow[]) => void;
};

const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 12, maxWidth: 400 };
const errorStyle = { color: "red" };

// Draws every section and field of a form definition
export default function FormRenderer({ form, raw, errors, disabled, onChange }: Props) {
  return (
    <>
      {form.sections.map((section) => (
        <fieldset key={section.title} disabled={disabled} style={{ marginBottom: 16 }}>
          <legend>{section.title}</legend>
          {section.fields.map((f) =>
            f.type === "group" ? (
              <Group
                key={f.key}
                group={f}
                rows={Array.isArray(raw[f.key]) ? (raw[f.key] as RawRow[]) : []}
                errors={errors}
                onChange={(rows) => onChange(f.key, rows)}
              />
            ) : (
              <FieldBlock
                key={f.key}
                field={f}
                value={raw[f.key] as RawScalar | undefined}
                error={errors[f.key]}
                onChange={(v) => onChange(f.key, v)}
              />
            )
          )}
        </fieldset>
      ))}
    </>
  );
}

// Repeating rows with Add / Remove, kept between minItems and maxItems
function Group({ group: g, rows, errors, onChange }: {
  group: GroupField; rows: RawRow[]; errors: Record<string, string>; onChange: (rows: RawRow[]) => void;
}) {
  const setCell = (i: number, key: string, v: RawScalar) =>
    onChange(rows.map((row, j) => (j === i ? { ...row, [key]: v } : row)));

  return (
    <div>
      {errors[g.key] && <p style={errorStyle}>{errors[g.key]}</p>}
      {rows.map((row, i) => (
        <fieldset key={i} style={{ marginBottom: 12 }}>
          <legend>{g.itemLabel} {i + 1}</legend>
          {g.fields.map((f) => (
            <FieldBlock
              key={f.key}
              field={f}
              value={row[f.key]}
              error={errors[rowErrorKey(g.key, i, f.key)]}
              onChange={(v) => setCell(i, f.key, v)}
            />
          ))}
          {rows.length > g.minItems && (
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              Remove {g.itemLabel.toLowerCase()} {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      <button type="button" disabled={rows.length >= g.maxItems} onClick={() => onChange([...rows, {}])}>
        Add Another {g.itemLabel.toLowerCase()}
      </button>
      {rows.length >= g.maxItems && <small> Maximum of {g.maxItems} reached.</small>}
    </div>
  );
}

function FieldBlock({ field, value, error, onChange }: {
  field: ScalarField; value: RawScalar | undefined; error?: string; onChange: (v: RawScalar) => void;
}) {
  return (
    <div style={fieldStyle}>
      <Field field={field} value={value} onChange={onChange} />
      {field.help && <small>{field.help}</small>}
      {error && <small style={errorStyle}>{error}</small>}
    </div>
  );
}

function Field({ field: f, value, onChange }: { field: ScalarField; value: RawScalar | undefined; onChange: (v: RawScalar) => void }) {
  const text = typeof value === "string" ? value : "";
  const label = <>{f.label}{f.required && " *"}</>;

  switch (f.type) {
    case "checkbox":
      return (
        <label>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {label}
        </label>
      );
    case "textarea":
      return <label style={fieldStyle}>{label}<textarea value={text} maxLength={f.maxLength} rows={4} onChange={(e) => onChange(e.target.value)} /></label>;
    case "select":
      return (
        <label style={fieldStyle}>{label}
          <select value={text} onChange={(e) => onChange(e.target.value)}>
            <option value="">— Select —</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    case "number": {
      const step = f.integer ? 1 : f.decimals !== undefined ? 10 ** -f.decimals : "any";
      return (
        <label style={fieldStyle}>{label}{f.unit && ` (${f.unit})`}
          <input type="number" value={text} min={f.min} max={f.max} step={step} onChange={(e) => onChange(e.target.value)} />
        </label>
      );
    }
    case "date":
      return <label style={fieldStyle}>{label}<input type="date" value={text} onChange={(e) => onChange(e.target.value)} /></label>;
    case "text":
      return <label style={fieldStyle}>{label}<input value={text} maxLength={f.maxLength} onChange={(e) => onChange(e.target.value)} /></label>;
  }
}
