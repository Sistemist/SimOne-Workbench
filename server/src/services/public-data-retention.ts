import { readFile, open, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { z } from "zod";

const record = z.object({ id: z.string().uuid(), at: z.string().datetime() }).strict();
export const retentionStateSchema = z.object({
  version: z.literal(1),
  contacts: z.array(record),
  holds: z.array(z.object({ id: z.string().uuid(), until: z.string().datetime(), owner: z.string().min(1), reason: z.string().min(1) }).strict()),
  deleted: z.array(record.extend({ table: z.enum(["early_access_requests", "early_access_grants", "scanner_runs"]) })),
}).strict();

async function writeState(fileName: string, state: z.infer<typeof retentionStateSchema>) {
  const temp = `${fileName}.tmp`, file = await open(temp, "w", 0o600);
  try { await file.writeFile(JSON.stringify(state)); await file.sync(); } finally { await file.close(); }
  await rename(temp, fileName);
  const directory = await open(dirname(fileName), "r");
  try { await directory.sync(); } finally { await directory.close(); }
}

export async function recordFounderContact(db: Db, stateFile: string, id: string, at: string) {
  record.parse({ id, at });
  if (Date.parse(at) > Date.now()) throw new Error("Contact cannot be in the future");
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(20261009, 30)`);
    if (!(await tx.execute(sql`SELECT id FROM early_access_requests WHERE id=${id}::uuid`)).length) throw new Error("Request not found");
    const state = retentionStateSchema.parse(JSON.parse(await readFile(stateFile, "utf8")));
    const previous = state.contacts.find(c => c.id === id);
    if (previous && Date.parse(previous.at) > Date.parse(at)) throw new Error("Contact date cannot move backwards");
    state.contacts = [...state.contacts.filter(c => c.id !== id), { id, at }];
    await writeState(stateFile, state);
  });
}

// This journal lives outside database backups. Never restore an older journal with a database.
export async function retainPublicData(db: Db, stateFile: string, apply = false, now = new Date()) {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(20261009, 30)`);
    const state = retentionStateSchema.parse(JSON.parse(await readFile(stateFile, "utf8")));
    const held = state.holds.filter(h => Date.parse(h.until) > now.getTime()).map(h => h.id);
    const heldJson = JSON.stringify(held);
    const contacts = JSON.stringify(state.contacts);
    const deleted = JSON.stringify(state.deleted);
    // Lock only the public intake tables: a grant activation cannot race a contact deletion.
    if (apply) await tx.execute(sql`LOCK TABLE early_access_requests, early_access_grants, scanner_runs IN SHARE ROW EXCLUSIVE MODE`);
    const requests = await tx.execute(sql`
      SELECT r.id FROM early_access_requests r
      WHERE r.status <> 'activated' AND COALESCE(r.source,'') NOT ILIKE '%newsletter%'
      AND NOT EXISTS (SELECT 1 FROM "user" u WHERE lower(trim(u.email))=r.email_normalized)
      AND NOT EXISTS (SELECT 1 FROM early_access_grants g WHERE g.email_normalized=r.email_normalized
        AND (g.activated_at IS NOT NULL OR g.activated_by_user_id IS NOT NULL OR (g.revoked_at IS NULL AND g.expires_at>${now.toISOString()})))
      AND NOT EXISTS (SELECT 1 FROM scanner_runs s WHERE s.access_request_id=r.id
        AND (s.owner_user_id IS NOT NULL OR s.company_id IS NOT NULL OR s.claimed_at IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${heldJson}::jsonb) h WHERE h.value=r.id::text)
      AND NOT EXISTS (SELECT 1 FROM early_access_grants g, jsonb_array_elements_text(${heldJson}::jsonb) h
        WHERE g.request_id=r.id AND h.value=g.id::text)
      AND NOT EXISTS (SELECT 1 FROM scanner_runs s, jsonb_array_elements_text(${heldJson}::jsonb) h
        WHERE s.access_request_id=r.id AND h.value=s.id::text)
      AND (EXISTS (SELECT 1 FROM jsonb_to_recordset(${deleted}::jsonb) AS d(id uuid, "table" text)
        WHERE d.id=r.id AND d."table"='early_access_requests') OR
        (SELECT max(greatest(other.created_at, c.at)) FROM early_access_requests other
          LEFT JOIN jsonb_to_recordset(${contacts}::jsonb) AS c(id uuid, at timestamptz) ON c.id=other.id
          WHERE other.email_normalized=r.email_normalized) <= ${now.toISOString()}::timestamptz - interval '12 months')`);
    const requestIds = JSON.stringify(requests.map(r => r.id));
    const grants = await tx.execute(sql`
      SELECT g.id FROM early_access_grants g WHERE g.activated_at IS NULL AND g.activated_by_user_id IS NULL
      AND (g.revoked_at IS NOT NULL OR g.expires_at<=${now.toISOString()})
      AND COALESCE(g.source,'') NOT ILIKE '%newsletter%'
      AND NOT EXISTS (SELECT 1 FROM "user" u WHERE lower(trim(u.email))=g.email_normalized)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${heldJson}::jsonb) h WHERE h.value=g.id::text)
      AND (g.request_id::text IN (SELECT value FROM jsonb_array_elements_text(${requestIds}::jsonb))
        OR EXISTS (SELECT 1 FROM jsonb_to_recordset(${deleted}::jsonb) AS d(id uuid, "table" text) WHERE d.id=g.id AND d."table"='early_access_grants')
        OR (g.request_id IS NULL AND g.created_at<=${now.toISOString()}::timestamptz-interval '12 months'
          AND NOT EXISTS (SELECT 1 FROM early_access_requests r WHERE r.email_normalized=g.email_normalized)))`);
    const scans = await tx.execute(sql`
      SELECT s.id FROM scanner_runs s WHERE s.owner_user_id IS NULL AND s.company_id IS NULL AND s.claimed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${heldJson}::jsonb) h WHERE h.value=s.id::text)
      AND (s.expires_at<=${now.toISOString()} OR s.access_request_id::text IN (SELECT value FROM jsonb_array_elements_text(${requestIds}::jsonb))
        OR EXISTS (SELECT 1 FROM jsonb_to_recordset(${deleted}::jsonb) AS d(id uuid, "table" text) WHERE d.id=s.id AND d."table"='scanner_runs'))`);
    const analytics = await tx.execute(sql`SELECT count(*)::int AS count FROM public_funnel_events WHERE created_at<=${now.toISOString()}::timestamptz-interval '90 days'`);
    const counts = { requests: requests.length, grants: grants.length, scans: scans.length, analytics: Number(analytics[0]?.count ?? 0), apply };
    if (!apply) return counts;
    const batches = [["scanner_runs", scans], ["early_access_grants", grants], ["early_access_requests", requests]] as const;
    // Durable write-ahead deletion intent makes a failed commit retryable, including after restore.
    const journal = new Map(state.deleted.map(d => [`${d.table}:${d.id}`, d]));
    for (const [table, rows] of batches) for (const r of rows) {
      const id = String(r.id); journal.set(`${table}:${id}`, { table, id, at: now.toISOString() });
    }
    state.deleted = [...journal.values()].filter(d => Date.parse(d.at) > now.getTime() - 32 * 86400000);
    state.contacts = state.contacts.filter(c => Date.parse(c.at) > now.getTime() - 398 * 86400000);
    state.holds = state.holds.filter(h => Date.parse(h.until) > now.getTime() - 32 * 86400000);
    await writeState(stateFile, state);
    for (const [table, rows] of batches) {
      if (rows.length) await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE id::text IN
        (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(rows.map(r => r.id))}::jsonb))`);
    }
    await tx.execute(sql`DELETE FROM public_funnel_events WHERE created_at<=${now.toISOString()}::timestamptz-interval '90 days'`);
    return counts;
  });
}
