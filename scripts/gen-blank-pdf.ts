// Writes the blank receipt form as a PDF, for upload to Dot Compliance as the controlled form.
//   npm run gen:blank-pdf             -> current form version
//   npm run gen:blank-pdf -- 2        -> a specific version
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { currentCannabisReceiptForm, receiptFormVersions } from "../src/forms/receipt.ts";
import { receiptDocDefinition } from "../src/pdf/receiptLayout.ts";
import { renderPdf } from "../src/pdf/render.ts";

const FONT_DIR = fileURLToPath(new URL("../src/pdf/fonts/", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../blank-forms/", import.meta.url));

const arg = process.argv[2];
const form = arg ? receiptFormVersions[Number(arg)] : currentCannabisReceiptForm;
if (!form) {
  console.error(`No receipt form version ${arg}.`);
  process.exit(1);
}

const pdf = await renderPdf(receiptDocDefinition(form, null), FONT_DIR);
const prefix = form.controlledDoc ? `${form.controlledDoc.number} ` : "";
const file = `${OUT_DIR}${prefix}${form.title} - form v${form.version} (blank).pdf`;
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(file, pdf);
console.log(`Wrote ${file}`);
