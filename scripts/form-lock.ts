// Locks each receipt form version's title and sections once issued, so the controlled blank form
// in the EQMS and the app can't drift apart. controlledDoc is not locked (revision is set later).
//   npm run lock:forms    -> record fingerprints for versions not yet locked (never changes existing ones)
//   npm run check:forms   -> fail if any locked version changed or a version is unlocked (runs before build)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { receiptFormVersions } from "../src/forms/receipt.ts";
import type { FormDef } from "../src/forms/types.ts";

const LOCK_PATH = fileURLToPath(new URL("../src/forms/receipt.lock.json", import.meta.url));

const fingerprint = (f: FormDef) =>
  createHash("sha256").update(JSON.stringify({ title: f.title, sections: f.sections })).digest("hex");

const lock: Record<string, string> = existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, "utf8")) : {};
const problems: string[] = [];
let added = 0;

for (const [v, form] of Object.entries(receiptFormVersions)) {
  const fp = fingerprint(form);
  if (!(v in lock)) {
    if (process.argv.includes("--check")) problems.push(`Form v${v} is not locked. Run \`npm run lock:forms\`.`);
    else { lock[v] = fp; added++; }
  } else if (lock[v] !== fp) {
    problems.push(`Form v${v} changed after it was locked. Revert it and make the change as a new version (see src/forms/receipt.ts).`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log("Receipt form versions match their locks.");
} else {
  writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n");
  console.log(added ? `Locked ${added} form version(s).` : "No new form versions to lock.");
}
