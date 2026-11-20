// Generates a PDF for each new cannabis receipt and files it in the shared drive under a
// YYYY-MM folder (from Date Received). Writes the result back to the receipt as `pdf`.
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { auth, drive as driveApi } from "@googleapis/drive";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { logger, setGlobalOptions } from "firebase-functions/v2";
import { defineString } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { receiptFormVersions } from "../../src/forms/receipt.ts";
import type { FormValues } from "../../src/forms/types.ts";
import { receiptDocDefinition } from "../../src/pdf/receiptLayout.ts";
import { renderPdf } from "../../src/pdf/render.ts";

const DATABASE = "web-app-database";
const FOLDER_ID = defineString("RECEIPTS_DRIVE_FOLDER_ID");
const FONT_DIR = fileURLToPath(new URL("./fonts/", import.meta.url));
const LEASE_MS = 5 * 60 * 1000; // a run that hasn't finished in this time is treated as dead
const DRIVE_ID_RE = /^[A-Za-z0-9_-]+$/;
const FOLDER_MIME = "application/vnd.google-apps.folder";

setGlobalOptions({
  region: "us-central1",
  serviceAccount: "receipt-pdf@", // receipt-pdf@<project>.iam.gserviceaccount.com
  memory: "512MiB",
  maxInstances: 5,
});

initializeApp();
const db = getFirestore(DATABASE);
const drive = driveApi({
  version: "v3",
  auth: new auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] }),
});

// Events can be delivered more than once and are retried on error, so every step checks
// whether it has already been done.
export const receiptPdf = onDocumentCreated(
  { document: "cannabis_receipts/{id}", database: DATABASE, retry: true, timeoutSeconds: 120 },
  async (event) => {
    if (event.data) await generate(event.data.ref);
  },
);

type PdfStatus =
  | { status: "pending"; lease_at: Timestamp }
  | { status: "failed"; error: string; failed_at: Timestamp }
  | { status: "done"; drive_file_id: string; drive_url: string; folder: string; sha256: string; generated_at: Timestamp };

async function generate(ref: DocumentReference) {
  // Take a lease so two deliveries of the same event don't both upload
  const data = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data();
    const pdf = d?.pdf as PdfStatus | undefined;
    if (!d || pdf?.status === "done") return null;
    if (pdf?.status === "pending" && Date.now() - pdf.lease_at.toMillis() < LEASE_MS) {
      throw new Error(`PDF for ${ref.id} is already being generated; will retry`);
    }
    tx.update(ref, { pdf: { status: "pending", lease_at: Timestamp.now() } satisfies PdfStatus });
    return d;
  });
  if (!data) return;

  const form = receiptFormVersions[data.form_version];
  if (!form) {
    // Retrying won't help: this build doesn't know the version
    await setStatus(ref, { status: "failed", error: `Unknown form version ${data.form_version}`, failed_at: Timestamp.now() });
    logger.error("Unknown form version", { id: ref.id, form_version: data.form_version });
    return;
  }

  try {
    const values = (data.values ?? {}) as FormValues;
    const folderId = FOLDER_ID.value();
    if (!DRIVE_ID_RE.test(folderId)) throw new Error("RECEIPTS_DRIVE_FOLDER_ID is missing or invalid");
    if (!DRIVE_ID_RE.test(ref.id)) throw new Error(`Unexpected receipt ID ${ref.id}`);

    const month = monthOf(values.date_received);
    const monthFolderId = await monthFolder(folderId, month);

    // A previous run may have uploaded the file but failed before recording it
    let file = await findReceiptFile(monthFolderId, ref.id);
    if (!file) {
      const generatedAt = new Date();
      const pdf = await renderPdf(
        receiptDocDefinition(form, {
          id: ref.id,
          createdBy: String(data.created_by),
          createdAt: (data.created_at as Timestamp).toDate(),
          generatedAt,
          values,
        }),
        FONT_DIR,
      );
      file = await upload(monthFolderId, fileName(values, ref.id), ref.id, pdf, generatedAt);
    }

    await setStatus(ref, {
      status: "done",
      drive_file_id: file.id,
      drive_url: file.url,
      folder: month,
      sha256: file.sha256,
      generated_at: Timestamp.fromDate(file.generatedAt),
    });
    logger.info("Receipt PDF filed", { id: ref.id, file: file.id, folder: month });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(ref, { status: "failed", error: msg, failed_at: Timestamp.now() }).catch(() => {});
    throw err; // retried by the event system
  }
}

function setStatus(ref: DocumentReference, pdf: PdfStatus) {
  return ref.update({ pdf });
}

function monthOf(dateReceived: unknown): string {
  return typeof dateReceived === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateReceived)
    ? dateReceived.slice(0, 7)
    : "undated";
}

// e.g. "GT-24-001_2026-11-20_AbC123.pdf"; characters Drive/Windows dislike become "-"
function fileName(values: FormValues, id: string): string {
  const lot = [...String(values.growtown_lot ?? "no-lot")]
    .map((c) => (c < " " || '\\/:*?"<>|'.includes(c) ? "-" : c))
    .join("").trim().slice(0, 100);
  return `${lot}_${values.date_received ?? "undated"}_${id}.pdf`;
}

// Month folder ID, cached in Firestore. The cache doc doubles as a lock so two receipts for a
// new month don't create two folders. Clients have no access to drive_folders (no rule grants it).
async function monthFolder(parentId: string, month: string): Promise<string> {
  const lockRef = db.collection("drive_folders").doc(`${parentId}_${month}`);
  const cached = (await lockRef.get()).data();
  if (cached?.folder_id) return cached.folder_id;
  if (cached && Date.now() - (cached.started_at as Timestamp).toMillis() > LEASE_MS) await lockRef.delete();

  try {
    await lockRef.create({ started_at: Timestamp.now() });
  } catch {
    throw new Error(`Folder ${month} is being created by another run; will retry`);
  }
  try {
    const existing = await drive.files.list({
      q: `'${parentId}' in parents and name = '${month}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
    });
    let id = existing.data.files?.[0]?.id;
    if (!id) {
      const created = await drive.files.create({
        requestBody: { name: month, mimeType: FOLDER_MIME, parents: [parentId] },
        fields: "id",
        supportsAllDrives: true,
      });
      id = created.data.id!;
    }
    await lockRef.set({ folder_id: id, month });
    return id;
  } catch (err) {
    await lockRef.delete().catch(() => {});
    throw err;
  }
}

type FiledPdf = { id: string; url: string; sha256: string; generatedAt: Date };

async function findReceiptFile(folderId: string, receiptId: string): Promise<FiledPdf | null> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and appProperties has { key='receipt_id' and value='${receiptId}' } and trashed = false`,
    fields: "files(id, webViewLink, appProperties)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  const f = res.data.files?.[0];
  if (!f?.id) return null;
  return {
    id: f.id,
    url: f.webViewLink ?? "",
    sha256: f.appProperties?.sha256 ?? "",
    generatedAt: new Date(f.appProperties?.generated_at ?? Date.now()),
  };
}

async function upload(folderId: string, name: string, receiptId: string, pdf: Buffer, generatedAt: Date): Promise<FiledPdf> {
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      mimeType: "application/pdf",
      appProperties: { receipt_id: receiptId, sha256, generated_at: generatedAt.toISOString() },
    },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  const id = res.data.id!;

  // Guard against accidental edits in Drive. Not a hard control: content managers can lift it.
  try {
    await drive.files.update({
      fileId: id,
      requestBody: { contentRestrictions: [{ readOnly: true, reason: "Generated receipt record" }] },
      supportsAllDrives: true,
    });
  } catch (err) {
    logger.warn("Could not set read-only restriction", { id, err: String(err) });
  }
  return { id, url: res.data.webViewLink ?? "", sha256, generatedAt };
}
