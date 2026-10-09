import { createDb } from "@paperclipai/db";
import { recordFounderContact, retainPublicData } from "../src/services/public-data-retention.js";
import { retainPublicReviewLedger } from "../src/services/public-review-budget.js";

const apply = process.argv.includes("--apply");
const args = process.argv.slice(2), contact = args[0] === "--record-contact";
if (contact ? args.length !== 3 : args.some(a => a !== "--apply")) throw new Error("Use --apply, or --record-contact REQUEST_UUID ISO_TIMESTAMP; default is dry-run");
const url = process.env.DATABASE_URL, state = process.env.SYSDOM_PUBLIC_RETENTION_STATE;
if (!url || !state) throw new Error("Explicit database and independent retention-state path required");
const db = createDb(url);
try {
  if (contact) {
    await recordFounderContact(db, state, args[1]!, args[2]!);
    console.log(JSON.stringify({ contactRecorded: true }));
  } else {
  const counts = await retainPublicData(db, state, apply);
  const ledger = process.env.SYSDOM_PUBLIC_RETENTION_LEDGER;
  console.log(JSON.stringify({ ...counts, ...(ledger ? retainPublicReviewLedger(ledger, apply) : {}) }));
  }
} finally { await db.$client.end(); }
