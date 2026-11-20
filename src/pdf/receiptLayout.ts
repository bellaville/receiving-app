// Receipt PDF layout, built from the form definition. Used for both the blank controlled form
// (scripts/gen-blank-pdf.ts) and filled receipts (functions/src/index.ts), so the two always match.
// Pure data only: rendering to bytes is in render.ts (Node).
import type { Content, CustomTableLayout, TableCell, TDocumentDefinitions } from "pdfmake/interfaces.js";
import type { FieldDef, FormDef, FormRow, FormValues, GroupField, ScalarField } from "../forms/types.ts";
import { formatValue } from "../forms/format.ts";

export type ReceiptRecord = {
  id: string;
  createdBy: string;
  createdAt: Date;
  generatedAt: Date;
  values: FormValues;
};

const CM = 72 / 2.54;
const HEADER_FILL = "#B6D7A8";
const BLANK_ROW_HEIGHT = 18; // pt, room to write by hand on the blank form
const TIME_ZONE = "America/Toronto";

// 1 pt black borders on every cell
const GRID: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => "#000000",
  vLineColor: () => "#000000",
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const header = (text: string): TableCell => ({ text, bold: true, alignment: "center", fillColor: HEADER_FILL });

// Units go in the label, so values are plain numbers
function label(f: ScalarField | GroupField): string {
  return f.type === "number" && f.unit ? `${f.label} (${f.unit})` : f.label;
}

function value(f: ScalarField, v: unknown): string {
  return formatValue(f.type === "number" ? { ...f, unit: undefined } : f, v);
}

// What a blank cell shows: the choices for select/checkbox, otherwise nothing
function blankValue(f: ScalarField): TableCell {
  const choices = f.type === "select" ? f.options : f.type === "checkbox" ? ["Yes", "No"] : null;
  return choices ? { text: choices.join("  /  "), color: "#555555" } : "";
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short",
  }).format(d);
}

function scalarTable(fields: ScalarField[], values: FormValues | null): Content {
  return {
    table: {
      widths: ["38%", "*"],
      heights: values ? undefined : BLANK_ROW_HEIGHT,
      body: fields.map((f) => [
        { text: label(f), bold: true },
        values ? value(f, values[f.key]) : blankValue(f),
      ]),
    },
    layout: GRID,
  };
}

function groupTable(g: GroupField, rows: FormRow[] | null): Content {
  const body: TableCell[][] = [[header("#"), ...g.fields.map((f) => header(label(f)))]];
  const count = rows ? rows.length : g.maxItems;
  for (let i = 0; i < count; i++) {
    const row = rows?.[i];
    body.push([
      { text: String(i + 1), alignment: "center" },
      ...g.fields.map((f): TableCell => (row ? value(f, row[f.key]) : blankValue(f))),
    ]);
  }
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [16, ...g.fields.map((f) => (f.type === "textarea" ? 110 : "*"))],
      heights: rows ? undefined : (i: number) => (i === 0 ? "auto" : BLANK_ROW_HEIGHT),
      body,
    },
    layout: GRID,
    fontSize: 8,
  };
}

function fieldsContent(fields: FieldDef[], values: FormValues | null): Content[] {
  const out: Content[] = [];
  let run: ScalarField[] = [];
  const flush = () => {
    if (run.length) out.push(scalarTable(run, values));
    run = [];
  };
  for (const f of fields) {
    if (f.type !== "group") {
      run.push(f);
      continue;
    }
    flush();
    if (fields.length > 1) out.push({ text: f.label, bold: true, margin: [0, 6, 0, 2] });
    const rows = values?.[f.key];
    out.push(groupTable(f, values ? (Array.isArray(rows) ? rows : []) : null));
  }
  flush();
  return out;
}

// Who/when block. Filled: from the record. Blank: lines to fill in by hand.
function recordTable(form: FormDef, record: ReceiptRecord | null): Content {
  const doc = form.controlledDoc;
  const rows: [string, string][] = record
    ? [
        ["Record ID", record.id],
        ["Controlled form", doc ? `${doc.number}, revision ${doc.revision || "[not yet issued]"}` : "[none]"],
        ["App form version", String(form.version)],
        ["Entered by", record.createdBy],
        ["Entered at", formatDateTime(record.createdAt)],
        ["PDF generated", formatDateTime(record.generatedAt)],
      ]
    : [
        ["Entered by", ""],
        ["Entered at", ""],
      ];
  return {
    table: {
      widths: ["38%", "*"],
      heights: record ? undefined : BLANK_ROW_HEIGHT,
      body: rows.map(([k, v]) => [{ text: k, bold: true }, v]),
    },
    layout: GRID,
  };
}

// record = null gives the blank form for the EQMS
export function receiptDocDefinition(form: FormDef, record: ReceiptRecord | null): TDocumentDefinitions {
  const content: Content[] = [{ text: form.title, fontSize: 14, bold: true, margin: [0, 0, 0, record ? 8 : 2] }];
  // Blank form: the EQMS adds the document number and control block itself; this ties it to the app.
  // Filled: the version is in the record table.
  if (!record) content.push({ text: `App form version ${form.version}`, fontSize: 8, color: "#555555", margin: [0, 0, 0, 8] });
  content.push(recordTable(form, record));

  for (const s of form.sections) {
    content.push({ text: s.title, fontSize: 11, bold: true, margin: [0, 12, 0, 4] });
    content.push(...fieldsContent(s.fields, record ? record.values : null));
  }

  return {
    pageSize: "LETTER",
    pageOrientation: "portrait",
    pageMargins: [1.91 * CM, 2.54 * CM, 1.91 * CM, 2.54 * CM],
    defaultStyle: { font: "Arimo", fontSize: 10 },
    info: {
      title: record ? `${form.title} ${record.id}` : `${form.title} (blank, form v${form.version})`,
      creator: "Growtown Receiving App",
    },
    content,
  };
}
