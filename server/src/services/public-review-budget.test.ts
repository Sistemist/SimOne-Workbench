import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, expect, it } from "vitest";
import { publicReviewBudget, retainPublicReviewLedger } from "./public-review-budget.js";
const dirs: string[] = [], budgets: Awaited<ReturnType<typeof publicReviewBudget>>[] = [];
const limits = { authorizationId: "mock-only", monthlyCents: 300, runCents: 30, maxConcurrent: 10, timeoutMs: 120000 };
const receipt = { mode: "fresh", bodySha256: "a".repeat(64), dispatched: true, generationId: "gen-fictional", knownCostUsd: 0.01, status: "response_received", reconciliation: "provider_ledger_check_required", furtherRequestsAllowed: false } as const;
async function make(config = limits, now?: () => number, dir?: string) {
  const directory = dir ?? await mkdtemp(path.join(os.tmpdir(), "review-ledger-")); if (!dir) dirs.push(directory);
  const b = await publicReviewBudget(directory, config, now); budgets.push(b); return { b, directory };
}
afterEach(async () => { budgets.splice(0).forEach(b => b.close()); await Promise.all(dirs.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
it("atomically reserves ten requests across independent connections, settles actual costs, and releases unused amounts", async () => {
  const { b, directory } = await make(), { b: other } = await make(limits, undefined, directory);
  const runs = Array.from({ length: 11 }, (_, i) => (i % 2 ? other : b).controls());
  const claims = await Promise.allSettled(runs.map(r => r.claim(limits.authorizationId, "a".repeat(64))));
  expect(claims.filter(c => c.status === "fulfilled")).toHaveLength(10);
  expect(b.summary()).toMatchObject({ reserved: 3e9, active: 10, state: "busy" });
  await Promise.all(runs.slice(0, 10).map(r => r.receipt(receipt)));
  expect(b.summary()).toMatchObject({ spent: 1e8, reserved: 0, active: 0, state: "available" });
  await b.controls().claim(limits.authorizationId, "b".repeat(64)); // no arbitrary ten-run quota
  expect(other.summary().active).toBe(1);
});
it("retains full unknown reservations and stops only when the finite budget cannot cover another request", async () => {
  const { b } = await make({ ...limits, monthlyCents: 60 });
  for (let i = 0; i < 2; i++) {
    const r = b.controls(); await r.claim(limits.authorizationId, "a".repeat(64));
    await r.receipt({ ...receipt, status: "stopped", knownCostUsd: null });
    expect(b.summary().active).toBe(0);
  }
  expect(b.summary()).toMatchObject({ reserved: 6e8, spent: 0, state: "exhausted" });
});
it("keeps reservations across crashes and month boundaries while releasing only proven charges", async () => {
  let time = Date.parse("2026-10-31T23:59:00Z");
  const { b, directory } = await make(limits, () => time);
  const r = b.controls(); await r.claim(limits.authorizationId, "a".repeat(64));
  const { b: restarted } = await make(limits, () => time, directory);
  expect(restarted.summary().reserved).toBe(3e8);
  time += 180000; expect(restarted.summary()).toMatchObject({ active: 0, reserved: 3e8 });
  await r.receipt(receipt);
  expect(restarted.summary()).toMatchObject({ reserved: 0, spent: 1e7 });
  time = Date.parse("2026-12-01T00:00:00Z"); expect(restarted.summary().spent).toBe(0);
});
it("does not block on lagging totals but protects against actual unaccounted charges and changed limits", async () => {
  const { b, directory } = await make(); const r = b.controls(); await r.claim(limits.authorizationId, "a".repeat(64)); await r.receipt(receipt);
  expect(b.audit(0)).toBe("pending"); expect(await b.availability()).toBe("available");
  expect(b.audit(0.01)).toBe("matched");
  expect(b.audit(1)).toBe("fault"); expect(await b.availability()).toBe("paused");
  await expect(publicReviewBudget(directory, { ...limits, monthlyCents: 400 })).rejects.toThrow();
});
it("releases undispatched attempts and refuses duplicate settlements", async () => {
  const { b } = await make(); const r = b.controls(); await r.claim(limits.authorizationId, "a".repeat(64));
  await r.receipt({ ...receipt, dispatched: false, status: "stopped", knownCostUsd: null });
  expect(b.summary()).toMatchObject({ reserved: 0, spent: 0, state: "available" });
  await expect(r.receipt(receipt)).rejects.toThrow();
});

it("settles validated usage even when answer validation fails, and pauses on a reported overrun", async () => {
  const { b } = await make(); const first = b.controls(); await first.claim(limits.authorizationId, "a".repeat(64));
  await first.receipt({ ...receipt, status: "stopped", usageValidated: true, knownCostUsd: 0.02 });
  expect(b.summary()).toMatchObject({ spent: 2e7, reserved: 0, state: "available" });
  const second = b.controls(); await second.claim(limits.authorizationId, "a".repeat(64));
  await second.receipt({ ...receipt, status: "stopped", knownCostUsd: 0.4, httpStatus: 429 });
  expect(b.summary()).toMatchObject({ spent: 2e7, reserved: 3e8, state: "paused", attempts: { provider429: 1, providerErrors: 1 } });
});

it.each([true, false])("retains content-free outer timeout diagnostics when receipt is late: %s", async (late) => {
  const { b, directory } = await make(); const controls = b.controls(); await controls.claim(limits.authorizationId, "a".repeat(64));
  if (!late) await controls.receipt(receipt);
  controls.recordOutcome({ phase: "failed", failureStage: "timeout" });
  if (late) await controls.receipt(receipt);
  const db = new DatabaseSync(path.join(directory, "service-budget.sqlite"), { readOnly: true });
  const row = db.prepare("SELECT receipt FROM attempts").get() as { receipt: string }; db.close();
  expect(JSON.parse(row.receipt)).toMatchObject({ ...receipt, publicOutcome: { phase: "failed", failureStage: "timeout" } });
  expect(b.summary()).toMatchObject({ spent: 10000000, reserved: 0, active: 0 });
});

it("purges only reconciled old detail and preserves current charges and unresolved reservations", async () => {
  let time = Date.parse("2026-01-01T00:00:00Z");
  const { b, directory } = await make(limits, () => time);
  const old = b.controls(); await old.claim(limits.authorizationId, "a".repeat(64)); await old.receipt(receipt);
  expect(b.audit(0.01)).toBe("matched");
  const unknown = b.controls(); await unknown.claim(limits.authorizationId, "b".repeat(64));
  time = Date.parse("2026-10-09T00:00:00Z");
  const recent = b.controls(); await recent.claim(limits.authorizationId, "c".repeat(64)); await recent.receipt(receipt);
  const file = path.join(directory, "service-budget.sqlite");
  const before = b.summary();
  expect(retainPublicReviewLedger(file, false, time).ledger).toBe(1);
  expect(b.summary()).toEqual(before);
  expect(retainPublicReviewLedger(file, true, time).ledger).toBe(1);
  expect(b.summary()).toEqual(before);
  expect(retainPublicReviewLedger(file, true, time).ledger).toBe(0);
});
