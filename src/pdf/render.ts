// Node only (scripts and Cloud Functions). Excluded from the browser build in tsconfig.app.json.
import path from "node:path";
import pdfmake from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces.js";

// fontDir holds Arimo-Regular.ttf and Arimo-Bold.ttf (metric-compatible with Arial, SIL OFL 1.1)
export async function renderPdf(doc: TDocumentDefinitions, fontDir: string): Promise<Buffer> {
  const dir = path.resolve(fontDir);
  const regular = path.join(dir, "Arimo-Regular.ttf");
  const bold = path.join(dir, "Arimo-Bold.ttf");
  pdfmake.setFonts({ Arimo: { normal: regular, bold, italics: regular, bolditalics: bold } });
  // Documents never load images or files: only the fonts may be read
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p) => path.resolve(p).startsWith(dir + path.sep));
  return pdfmake.createPdf(doc).getBuffer();
}
