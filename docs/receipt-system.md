# Receipt system: how it works

This covers the whole receipt flow: the form definition, the web app, the Firestore rules, PDF generation, the Cloud Function, and where each piece lives in Firebase and Google Cloud. The last part covers what has to change to add another receipt type (e.g. non-cannabis).

Project: `web-app-project-515019` · Firestore database: `web-app-database` (location `nam5`) · Function region: `us-central1`

---

## 1. The big picture

```
                         src/forms/receipt.ts  (form definition: the single source of truth)
                                   │
       ┌───────────────┬───────────┼──────────────────┬──────────────────────┐
       ▼               ▼           ▼                  ▼                      ▼
  Web app form    Receipts list   firestore.rules    Blank PDF              Cloud Function
  (NewReceipt)    (ReceiptsList)  (gen-rules.ts)     (gen-blank-pdf.ts)     (functions/)
       │                               ▲                  │                      │
       │  addDoc                       │ checks every     ▼                      │
       └──────────► Firestore ─────────┘ write            Dot Compliance          │
                    cannabis_receipts/{id}                (controlled form        │
                           │                               TMP.9.1.2)             │
                           │ "document created" event                            │
                           ▼                                                     │
                    Eventarc trigger ──────────────────────────────────────────►─┘
                                                                                 │
                                                       renders PDF, uploads      ▼
                                                       Shared drive / YYYY-MM / <lot>_<date>_<id>.pdf
                                                       writes pdf.status back to the receipt
```

Every piece reads its field list from the form definition. Adding or changing a field changes the form, the validation, the rules, the list columns, the blank PDF and the generated PDFs together.

---

## 2. The form definition (`src/forms/`)

| File | What it does |
|---|---|
| `types.ts` | The shape of a form: `FormDef` → `sections` → `fields`. Field types: `text`, `textarea`, `date`, `number`, `select`, `checkbox`, `group` (repeating rows such as Items). Also `title` and the optional `controlledDoc` (EQMS number + revision). |
| `receipt.ts` | The cannabis receipt form. Every version is kept (`receiptFormV1`, `V2`, `V3`) in `receiptFormVersions`, and `currentCannabisReceiptForm` points at the one new receipts use. |
| `validate.ts` | Turns what the user typed into clean values and error messages, in the browser. |
| `format.ts` | Turns a saved value into display text (`Yes`/`No`, `12.00 g`, …). Used by the list and the PDF. |
| `receipt.lock.json` | Fingerprints of each released form version (see §6). Generated, committed. |

**Why old versions are kept:** each receipt stores `form_version`. When an old receipt is displayed or printed, it uses the field list from *its* version, so a field added in v4 doesn't show as blank on a v2 receipt, and a removed field still shows on old receipts.

**Field keys are permanent.** `key` is the name stored in Firestore. Labels can change (as a new version); keys can't be renamed or reused for a different meaning.

---

## 3. The web app (`src/`)

Vite + React app, hosted on Firebase Hosting, sign-in with Google restricted to `@growtown.ca`.

- **`pages/NewReceipt.tsx`**: renders `currentCannabisReceiptForm` via `components/FormRenderer.tsx`, validates, and writes one document:

  ```
  cannabis_receipts/{auto id}
    form_version: 3
    values:       { name, date_received, returned_product, supplier_lot, growtown_lot, items: [ {...}, ... ] }
    created_by:   "person@growtown.ca"
    created_at:   server timestamp
  ```

- **`pages/ReceiptsList.tsx`**: reads every receipt and shows the fields marked `inList: true`, an expandable items table and the **PDF** column (`Open` / `Generating…` / `Failed (retrying)` / `—`).

The browser can't be trusted on its own, so the same rules are enforced again on the server by `firestore.rules` (§4).

---

## 4. Firestore rules (`firestore.rules`, generated)

`scripts/gen-rules.ts` writes `firestore.rules` from the current form version. The rules:

- allow **read** to verified `@growtown.ca` accounts;
- allow **create** only with exactly the current version's fields, types, lengths, number precision and select options, with `created_by` = the signed-in user and `created_at` = server time;
- grant **no update or delete**. Once saved, a receipt can't be changed from the app.

The Cloud Function writes `pdf` onto receipts and uses the `drive_folders` collection. It runs with admin credentials, which bypass rules, so neither needs a rule. Clients can't touch `drive_folders` at all, because no rule grants it.

`npm run build` runs `check:rules` first and fails if `firestore.rules` is out of date. Rules deploy with `firebase deploy --only firestore:rules`.

---

## 5. PDF generation (`src/pdf/`)

| File | What it does |
|---|---|
| `receiptLayout.ts` | Builds the PDF layout (a pdfmake "document definition") from a `FormDef`. With a record → filled receipt. With `null` → blank controlled form. Pure data, no Node APIs. |
| `render.ts` | Node-only: turns the layout into PDF bytes with pdfmake. Only the bundled fonts can be read; URLs and other files are refused. Excluded from the browser build (`tsconfig.app.json`). |
| `fonts/` | Arimo Regular/Bold (same letter widths as Arial; SIL Open Font License, `OFL.txt`). |

Layout: US Letter portrait, 2.54 cm top/bottom margins, 1.91 cm sides, headers `#B6D7A8` bold centred, 1 pt black borders. Section titles come from the form sections; `group` fields become tables (blank form: `maxItems` empty rows); units go in the column label.

| | Blank (EQMS) | Filled (Drive) |
|---|---|---|
| Header | Title + "App form version N". Dot Compliance adds the document control block. | Title + record table: Record ID, controlled form number/revision, app form version, entered by/at, PDF generated time (Toronto) |
| Values | Empty; select/checkbox print their options (`Pass / Fail`) | Saved values, formatted with the record's own form version |

**Blank form:** `npm run gen:blank-pdf` (current version) or `npm run gen:blank-pdf -- 2` (a specific version). Output goes to `blank-forms/` (git-ignored).

**Arimo vs Arial:** the document standard says Arial. Arimo has the same letter widths, but it is a different font. QA needs to accept the substitution, or the site needs an Arial licence that allows embedding on a server.

---

## 6. Changing the form (controlled-document workflow)

Each form version is issued as a controlled form, so **any** change to `title` or `sections`, wording included, needs a new version:

1. In `src/forms/receipt.ts`, copy the current version to a new constant, bump `version`, make the change, add it to `receiptFormVersions`, and point `currentCannabisReceiptForm` at it. Leave `controlledDoc.revision` blank until it's approved.
2. `npm run gen:rules` → updates `firestore.rules`.
3. `npm run lock:forms` → records the new version's fingerprint in `receipt.lock.json`. It never overwrites an existing fingerprint.
4. `npm run gen:blank-pdf` → upload to Dot Compliance as the new revision of TMP.9.1.2.
5. Once approved, set `controlledDoc.revision` (not locked, so no new version needed).
6. Deploy everything: `firebase deploy` (rules + hosting + function, which bundles the form code).

**The lock (`scripts/form-lock.ts`):** `npm run build` runs `check:forms`, which fails if any released version's title or sections no longer match its fingerprint, or a version hasn't been locked. This stops a released form from silently drifting away from the controlled copy in Dot Compliance. Changes to the *layout code* (`receiptLayout.ts`) are not caught by the lock. If you change the layout, regenerate the blank form and re-issue it.

**Deploy order matters:** rules and the web app must go out together. If the new rules deploy before the new app (or the reverse), saves fail with a permission error until both match.

---

## 7. The `functions/` folder: why it's a separate project

Firebase deploys a function by uploading **only the `functions/` folder**. Google then runs `npm install` on it in the cloud. It never sees the rest of the repo. So `functions/` has to be a complete Node project of its own:

| File | Why |
|---|---|
| `package.json` | The function's own dependencies (`firebase-functions`, `firebase-admin`, `@googleapis/drive`, `pdfmake`). The root `package.json` is for the browser app (React, Vite) and isn't uploaded. `"engines": {"node": "22"}` picks the runtime. |
| `src/index.ts` | The function's code. |
| `build.mjs` | Bundles `src/index.ts` **together with `../src/forms` and `../src/pdf`** into one file, `lib/index.js`, and copies the fonts to `lib/fonts`. This is how the function uses the same form definition and layout as the web app without copying them: they're compiled in at build time. npm packages are left out of the bundle and installed in the cloud from `package.json`. |
| `tsconfig.json` | Type checking for the function (Node, not browser). |
| `.env` | Deploy-time settings. Currently only `RECEIPTS_DRIVE_FOLDER_ID`, read in code via `defineString(...)`. The folder ID isn't a secret, so the file is committed. **Passwords/API keys must not go here**; they belong in Secret Manager (`defineSecret`). |
| `.gitignore` | `node_modules/`, `lib/` (build output). |
| `lib/` | Build output: what actually gets deployed. |

`firebase.json` ties it together: `"functions": [{ "source": "functions", "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"], ... }]`. Every `firebase deploy` that includes functions type-checks and rebuilds first, so the deployed function always has the current form versions.

**Consequence:** the function only knows the form versions it was built with. Deploy the function whenever the form changes (step 6 above), or receipts on the new version will be marked `failed: Unknown form version`.

---

## 8. What the function does (`functions/src/index.ts`)

`receiptPdf` runs once for every new document in `cannabis_receipts`:

1. **Lease.** In a Firestore transaction, sets `pdf = {status: "pending", lease_at}` so a duplicate delivery of the same event doesn't run in parallel. If another run holds a lease less than 5 minutes old, it throws (and is retried later). If `pdf.status` is already `done`, it stops.
2. **Form version.** Looks up `receiptFormVersions[form_version]`. If unknown → `failed`, **not retried** (retrying can't fix it).
3. **Month folder.** `YYYY-MM` from Date Received. The folder's Drive ID is cached in `drive_folders/{parentFolderId}_{YYYY-MM}`. Creating that cache document doubles as a lock, so two receipts for a new month can't create two folders. If the folder already exists in Drive (e.g. made by hand), it's reused.
4. **Already uploaded?** Searches the month folder for a file tagged `receipt_id = <id>` (a hidden Drive "appProperty"). This covers a run that uploaded but crashed before recording it.
5. **Render + upload.** Builds the PDF, computes its SHA-256, uploads `<GrowtownLot>_<date>_<id>.pdf` with the tags `receipt_id`, `sha256`, `generated_at`, then sets Drive's read-only content restriction (a guard against accidental edits, not a security control: content managers can lift it).
6. **Record.** Writes back to the receipt:

   ```
   pdf: { status: "done", drive_file_id, drive_url, folder: "2026-11", sha256, generated_at }
   ```

On any other error: `pdf = {status: "failed", error, failed_at}` and the error is re-thrown so the event is **retried** with increasing delays (for up to 7 days, per the deploy warning). Each step above checks whether it's already done, so retries are safe.

The `sha256` lets you show later that the PDF in Drive matches what the system generated: download it, hash it, compare to Firestore.

**Settings** (`setGlobalOptions` + trigger options): region `us-central1`, runs as `receipt-pdf@web-app-project-515019.iam.gserviceaccount.com`, 512 MiB memory, max 5 instances, 120 s timeout, retries on.

---

## 9. Where it all lives in the cloud

A 2nd-gen Cloud Function is several Google Cloud products working together. What happens on `firebase deploy`:

```
functions/ (zipped) ──► Cloud Storage bucket (gcf-v2-sources-…)
                            │
                            ▼
                      Cloud Build: npm install, build container image
                            │
                            ▼
                      Artifact Registry (gcf-artifacts, us-central1): the image
                            │                (kept 1 day, per the cleanup policy you set)
                            ▼
                      Cloud Run service "receiptpdf": what actually runs
                            ▲
                      Eventarc trigger (location nam5): listens to Firestore and calls it
```

### Where to look

| What you want | Where |
|---|---|
| Quick status, invocation count, logs | **Firebase console → Build → Functions** → `receiptPdf`. Tabs for Dashboard, Health/Usage, Logs. <https://console.firebase.google.com/project/web-app-project-515019/functions> |
| Detailed metrics (invocations, errors, execution time, memory, instances), trigger, deployed source, variables | **Google Cloud console → Cloud Run functions** → `receiptPdf`. Tabs: Metrics, Details, Source, Variables, **Trigger**, Logs. <https://console.cloud.google.com/functions/list?project=web-app-project-515019> |
| The running service (revisions, request metrics, the service account it runs as) | **Cloud Run → Services → `receiptpdf`**. <https://console.cloud.google.com/run?project=web-app-project-515019> |
| **The database trigger** | **Eventarc → Triggers** (location `nam5`), named `receiptpdf-…`. Shows event type `google.cloud.firestore.document.v1.created`, filters `database = web-app-database`, document path `cannabis_receipts/{id}`, destination Cloud Run `receiptpdf`, and the trigger's service account. <https://console.cloud.google.com/eventarc/triggers?project=web-app-project-515019>. The trigger is **not** shown in the Firestore console; Firestore only emits events. |
| Full logs with search | **Logs Explorer**, filter on resource "Cloud Run Revision" → `receiptpdf`, or from the terminal: `npm --prefix functions run logs`. The function logs `Receipt PDF filed` on success and the error message on failure. |
| Build history (failed deploys) | **Cloud Build → History**. |
| Container images | **Artifact Registry → gcf-artifacts**. |
| Service accounts and roles | **IAM & Admin → IAM** and **Service Accounts** (§10). |
| The data | **Firebase console → Firestore → database `web-app-database`**: `cannabis_receipts` (each with its `pdf` field), `drive_folders` (month folder cache). |
| Costs | **Billing → Reports**, filter by service (Cloud Run, Cloud Build, Artifact Registry, Eventarc). |

### Settings to know about

- **`functions/.env`** → shown under the function's Variables tab after deploy. Change the file and redeploy; editing in the console gets overwritten on the next deploy.
- **Retries** are an Eventarc setting on the trigger, set by `retry: true` in code.
- **Region/location:** the function runs in `us-central1`. The trigger sits in `nam5` because that's where the database is.

---

## 10. Permissions (what was set up and why)

| Who | Role | Why |
|---|---|---|
| `receipt-pdf@…` (the function's identity) | Cloud Datastore User (project) | Read receipts, write `pdf`, use `drive_folders` |
| `receipt-pdf@…` | Eventarc Event Receiver (project) | The trigger delivers Firestore events as this account |
| `receipt-pdf@…` | Cloud Run Invoker (project) | Eventarc calls the Cloud Run service as this account. Project-wide is broad; can be narrowed to the `receiptpdf` service only |
| `receipt-pdf@…` | **Content manager on the shared drive** (set in Google Drive, not IAM) | Create month folders and upload PDFs. This is the only Drive access it has |
| You (deployer) | Service Account User on `receipt-pdf@…` | Allowed to deploy a function that runs as it |
| `service-<project number>@gcp-sa-eventarc…` | Eventarc Service Agent | Google-managed. Was slow to appear on the first deploy |

No key file exists for `receipt-pdf`. The function gets credentials from the environment it runs in. Keep it that way.

---

## 11. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local web app |
| `npm run build` | check rules → check form locks → type-check → build web app |
| `npm run gen:rules` | Regenerate `firestore.rules` from the current form |
| `npm run lock:forms` | Lock new form versions |
| `npm run gen:blank-pdf [-- N]` | Blank controlled form PDF |
| `npm --prefix functions run build` | Type-check and bundle the function (runs automatically on deploy) |
| `npm --prefix functions run logs` | Function logs |
| `firebase deploy` | Everything: rules, hosting, function |
| `firebase deploy --only functions` / `hosting` / `firestore:rules` | One piece |

---

## 12. Troubleshooting

| Symptom | Likely cause |
|---|---|
| PDF column `—` | Receipt created before the function was deployed (the function only fires on new documents), or the event never reached it: check Eventarc trigger + Cloud Run Invoker role |
| Stuck on `Generating…` > 5 min | Run died mid-way; the next retry takes over after the lease expires. Check logs |
| `Failed (retrying)`, error mentions Drive 403/404 | `receipt-pdf` not a member of the shared drive, or wrong `RECEIPTS_DRIVE_FOLDER_ID` |
| `Unknown form version N` | Function not redeployed after a form change. Redeploy; it won't retry by itself, so these receipts need a backfill |
| Save fails with "Missing or insufficient permissions" | Rules and app are on different form versions. Deploy both |
| Build fails on `check:forms` | A released form version was edited. Revert and make the change as a new version |

---

## 13. Open items

- **Backfill.** Receipts saved before the function was deployed have no PDF, and receipts marked `Unknown form version` aren't retried. Needs a one-off script that runs the same generation for receipts without `pdf.status = done`.
- **Manual regenerate.** No button yet; would be a staff-only callable function.
- **Electronic signatures** (operator + QA, replacing wet signature). When added, PDF generation should move from "on create" to "after the last signature". That is a validation/change-control item, not just code.
- **Retention.** Confirm the required record-retention period under the current Cannabis Regulations and that the shared drive's retention/deletion settings meet it: [retention period: verify].
- **Official record.** Decide and document whether the Firestore record or the Drive PDF is the record of receipt. The `sha256` on each receipt supports either.
- **Drive access.** Content managers on the shared drive can delete or replace PDFs. Limit write access to the people who need it.
- **Arimo vs Arial** acceptance (§5).

---

## 14. Adding another receipt type (e.g. non-cannabis)

The **form machinery is general**: `types.ts`, `validate.ts`, `format.ts`, `FormRenderer`, `receiptLayout.ts` and `render.ts` work for any `FormDef`. A non-cannabis form is just another set of `FormDef` versions.

The **wiring around it is not general yet**. These places name cannabis receipts directly:

| Place | Hard-coded |
|---|---|
| `src/forms/receipt.ts` | One set of versions (`receiptFormVersions`, `currentCannabisReceiptForm`) |
| `scripts/gen-rules.ts` | Writes rules for one collection (`cannabis_receipts`) from one form |
| `scripts/form-lock.ts`, `src/forms/receipt.lock.json` | Locks one form's versions |
| `scripts/gen-blank-pdf.ts` | Prints one form |
| `pages/NewReceipt.tsx`, `pages/ReceiptsList.tsx`, routes in `App.tsx` | One collection, one form |
| `functions/src/index.ts` | Trigger on `cannabis_receipts/{id}`; file name uses `growtown_lot` |
| `functions/.env` | One Drive folder |

### Proposed design: a receipt-type registry

One file lists every receipt type; everything else loops over it.

```ts
// src/forms/registry.ts (proposed)
export type ReceiptType = {
  key: "cannabis" | "non_cannabis";   // used in URLs, lock file, function names
  collection: string;                 // "cannabis_receipts", "non_cannabis_receipts"
  versions: Record<number, FormDef>;
  current: FormDef;
  fileNameField?: string;             // field used in the PDF file name, e.g. "growtown_lot"
};
export const receiptTypes: ReceiptType[] = [cannabis, nonCannabis];
```

Then:

- **Forms:** one file per type (`forms/cannabis.ts`, `forms/nonCannabis.ts`), each with its own versions and `controlledDoc` (each is its own controlled form in Dot Compliance with its own TMP number).
- **Rules:** `gen-rules.ts` writes a validation function and a `match /<collection>/{id}` block per type.
- **Lock:** `receipt.lock.json` keyed by type then version: `{ "cannabis": { "3": "…" }, "non_cannabis": { "1": "…" } }`.
- **Blank PDF:** `npm run gen:blank-pdf -- non_cannabis [version]`.
- **Web app:** routes `/:type` and `/:type/new`; the pages take the type from the URL and look it up in the registry.
- **Function:** one trigger per type, generated from the registry (`receiptPdfCannabis`, `receiptPdfNonCannabis`), all calling the same `generate()` with the type's versions. Each type gets its own Drive folder setting (`CANNABIS_DRIVE_FOLDER_ID`, `NON_CANNABIS_DRIVE_FOLDER_ID`), or one shared folder with a subfolder per type.

**Separate collections per type** is recommended over one collection with a `type` field. Rules stay simple per type, the existing `cannabis_receipts` data doesn't move, and access can differ per type later (e.g. who may read cannabis records).

### Regulatory note

Cannabis receipts feed cannabis inventory and tracking records. Non-cannabis receipts (packaging, chemicals, consumables) usually sit under different SOPs. Each type should map to its own controlled form and SOP/WI reference, and the PDFs should probably go to separate Drive folders with their own access lists.
