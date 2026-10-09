import { mkdir, readdir, chmod } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { ReviewOutcome } from "./venture-review.js";
import type { ReviewProviderReceipt } from "./venture-review-provider.js";

type Limits = { authorizationId: string; monthlyCents: number; runCents: number; maxConcurrent: number; timeoutMs: number };
const nanosPerCent = 10_000_000;
const nanos = (usd: number) => Math.ceil(usd * 1_000_000_000);
const month = (time: number) => new Date(time).toISOString().slice(0, 7);

/** Transactions hold a write lock only while reserving/settling, never during provider IO.
 * ponytail: anonymous sessions are process-local; horizontal serving needs shared session storage. */
export async function publicReviewBudget(directory: string, limits: Limits, now = Date.now) {
  if (!path.isAbsolute(directory) || !limits.authorizationId || ![limits.monthlyCents, limits.runCents, limits.maxConcurrent, limits.timeoutMs].every(n => Number.isSafeInteger(n) && n > 0) ||
      !Number.isSafeInteger(limits.monthlyCents * nanosPerCent) || limits.runCents > limits.monthlyCents) throw new Error("Explicit finite service limits required");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await readdir(directory)).some(f => f === "authorization.json" || f === "active.lock")) throw new Error("Pilot ledger requires explicit reconciliation; do not reuse it");
  const file = path.join(directory, "service-budget.sqlite");
  const db = new DatabaseSync(file);
  await chmod(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;
    CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, fault TEXT, audit TEXT);
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, body_sha256 TEXT NOT NULL, started INTEGER NOT NULL,
      lease_until INTEGER NOT NULL, state TEXT NOT NULL, cost_nanos INTEGER, charge_month TEXT, receipt TEXT);`);
  const config = JSON.stringify(limits);
  const transact = <T>(fn: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  try {
    transact(() => {
      db.prepare("INSERT OR IGNORE INTO config(id,value) VALUES(1,?)").run(config);
      if ((db.prepare("SELECT value FROM config WHERE id=1").get() as { value: string }).value !== config) throw new Error("Service authorization mismatch");
    });
  } catch (e) { db.close(); throw e; }
  function totals() {
    db.prepare("UPDATE attempts SET state='unknown' WHERE state='active' AND lease_until <= ?").run(now());
    const row = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN state='settled' AND charge_month=? THEN cost_nanos ELSE 0 END),0) AS spent,
      SUM(CASE WHEN state IN ('active','unknown') THEN 1 ELSE 0 END) AS reserved,
      SUM(CASE WHEN state='active' THEN 1 ELSE 0 END) AS active
      FROM attempts`).get(month(now())) as { spent: number; reserved: number | null; active: number | null };
    return { spent: row.spent, reserved: (row.reserved ?? 0) * limits.runCents * nanosPerCent, active: row.active ?? 0 };
  }
  function state() {
    const t = totals();
    const fault = (db.prepare("SELECT fault FROM config WHERE id=1").get() as { fault: string | null }).fault;
    return { ...t, state: fault ? "paused" as const : t.active >= limits.maxConcurrent ? "busy" as const :
      t.spent + t.reserved + limits.runCents * nanosPerCent > limits.monthlyCents * nanosPerCent ? "exhausted" as const : "available" as const };
  }
  return {
    availability: async () => transact(() => state().state),
    summary: () => transact(() => ({ ...state(), month: month(now()), monthlyCents: limits.monthlyCents, runCents: limits.runCents,
      audit: (db.prepare("SELECT audit FROM config WHERE id=1").get() as { audit: string | null }).audit,
      attempts: db.prepare(`SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN json_extract(receipt,'$.dispatched')=1 THEN 1 ELSE 0 END),0) AS dispatched,
        COALESCE(SUM(CASE WHEN json_extract(receipt,'$.httpStatus')=429 THEN 1 ELSE 0 END),0) AS provider429,
        COALESCE(SUM(CASE WHEN json_extract(receipt,'$.httpStatus')>=400 THEN 1 ELSE 0 END),0) AS providerErrors
        FROM attempts WHERE started>=?`).get(Date.parse(month(now()) + "-01T00:00:00Z")) as { total: number; dispatched: number; provider429: number; providerErrors: number },
    })),
    // Lagging provider totals are pending audit, not a second visitor approval gate.
    audit: (usageUsd: number | null, observedMonth = month(now())) => transact(() => {
      const t = totals();
      let status = "unavailable";
      if (usageUsd !== null && Number.isFinite(usageUsd) && usageUsd >= 0 && observedMonth === month(now())) {
        const observed = nanos(usageUsd);
        status = observed > t.spent + t.reserved + 1 ? "fault" : Math.abs(observed - t.spent) <= 1 && !t.reserved ? "matched" : "pending";
        if (status === "fault") db.prepare("UPDATE config SET fault=? WHERE id=1").run("Provider usage exceeds all accounted charges and reservations");
      }
      db.prepare("UPDATE config SET audit=? WHERE id=1").run(JSON.stringify({ status, at: new Date(now()).toISOString(), month: observedMonth, usageUsd }));
      return status;
    }),
    controls() {
      let id: string | undefined;
      let publicOutcome: ReviewOutcome | undefined;
      return {
        recordOutcome: (outcome: ReviewOutcome) => {
          publicOutcome = { phase: outcome.phase, ...(outcome.failureStage ? { failureStage: outcome.failureStage } : {}) };
          if (id) transact(() => {
            db.prepare("UPDATE attempts SET receipt=json_set(COALESCE(receipt,'{}'),'$.publicOutcome',json(?)) WHERE id=?")
              .run(JSON.stringify(publicOutcome), id!);
          });
        },
        claim: async (authorizationId: string, bodySha256: string) => {
          if (id || authorizationId !== limits.authorizationId || !/^[a-f0-9]{64}$/.test(bodySha256)) throw new Error("Invalid reservation");
          transact(() => {
            if (state().state !== "available") throw new Error("Service capacity or budget unavailable");
            const nextId = randomUUID();
            db.prepare("INSERT INTO attempts(id,body_sha256,started,lease_until,state) VALUES(?,?,?,?, 'active')")
              .run(nextId, bodySha256, now(), now() + limits.timeoutMs + 5000);
            id = nextId;
          });
        },
        receipt: async (receipt: ReviewProviderReceipt) => {
          if (!id) return;
          transact(() => {
            const row = db.prepare("SELECT state FROM attempts WHERE id=?").get(id!) as { state: string };
            if (!["active", "unknown"].includes(row.state)) throw new Error("Attempt already settled");
            const known = (receipt.status === "response_received" || receipt.usageValidated === true) && Number.isFinite(receipt.knownCostUsd) && (receipt.knownCostUsd ?? 0) > 0;
            const cost = known ? nanos(receipt.knownCostUsd!) : null;
            const next = !receipt.dispatched ? "not_dispatched" : known ? "settled" : "unknown";
            db.prepare("UPDATE attempts SET state=?,cost_nanos=?,charge_month=?,receipt=? WHERE id=?")
              .run(next, cost, next === "settled" ? month(now()) : null, JSON.stringify({ ...receipt, ...(publicOutcome ? { publicOutcome } : {}) }), id!);
            if (receipt.dispatched && Number.isFinite(receipt.knownCostUsd) && receipt.knownCostUsd! * 100 > limits.runCents) db.prepare("UPDATE config SET fault=? WHERE id=1").run("Reported cost exceeded the verified per-request bound");
          });
        },
      };
    },
    close: () => db.close(),
  };
}
