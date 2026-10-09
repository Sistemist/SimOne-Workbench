import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { mkdtemp, readFile, writeFile, stat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runPublicCommand } from "../integrations/codex-plugins/sysdom-venture-review/scripts/public-review.mjs";
const dirs = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });
const ORIGIN = "https://app.sysdom.ai", id = "11111111-1111-4111-8111-111111111111", token = "d".repeat(64);
const packet = { question: "What should we test next?", notes: "Fictional founder note with selected evidence and acknowledged uncertainty." };
async function harness() {
  const dir = await mkdtemp(path.join(tmpdir(), "sysdom-public-plugin-")); dirs.push(dir);
  const state = path.join(dir, "session.json"), calls = [];
  let cap = { state: "available", mode: "fresh", consentVersion: "test-consent", methodVersion: "test-method", model: "openai/gpt-6.1-sol", reasoningEffort: "high", recipients: ["Sysdom.ai", "OpenRouter", "Azure (OpenAI Sol 6.1 High)"], retention: "Fictional service disclosure; mock IO only.", maxNoteChars: 8000, sessionMinutes: 15 };
  let snapshot = { reviewId: id, phase: "ready", expiresAt: new Date(Date.now() + 900000).toISOString(), mode: "fresh", result: null };
  const fixture = JSON.parse(await readFile(new URL("../evals/fixtures/venture-review-ps02-oct08-demo.json", import.meta.url), "utf8"));
  const result = { ...fixture.result, reviewId: id, rubricVersion: cap.methodVersion };
  for (const f of [...Object.values(result.engineFindings).flat(), ...result.contradictions, ...result.interactions, ...(result.businessUnderstanding ? [result.businessUnderstanding] : []), ...(result.strengths ?? [])]) f.evidenceSourceIds = ["founder-note"];
  for (const a of result.alternatives) { a.evidenceFor = ["founder-note"]; a.evidenceAgainst = []; }
  let runError = false, redirect = false, invalidCitation = false;
  const source = { id: "public-0", sha256: "e".repeat(64), url: "https://example.com/", title: "Public example", text: "Fictional public excerpt", capturedAt: new Date().toISOString(), status: "retrieved", omissions: ["No linked pages read"], simulated: false };
  const fetcher = async (url, init) => {
    assert(url.startsWith(`${ORIGIN}/api/public/venture-review/`)); assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.referrerPolicy, "no-referrer");
    assert(!url.includes(token)); const body = init.body ? JSON.parse(init.body) : undefined;
    if (body) assert.equal(init.headers.Origin, ORIGIN);
    calls.push({ url, body, headers: init.headers });
    if (redirect) return new Response("", { status: 302, headers: { Location: "https://evil.example" } });
    if (url.endsWith("/capability")) return Response.json(cap);
    if (url.endsWith("/sessions")) { assert.deepEqual(body, {}); return Response.json({ ...snapshot, accessToken: token }); }
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    if (url.endsWith("/sources")) return Response.json([source]);
    if (url.endsWith("/run")) {
      snapshot = { ...snapshot, phase: "complete", result: structuredClone(result) };
      if (invalidCitation) snapshot.result.engineFindings.product_service[0].evidenceSourceIds = ["not-shared"];
      if (runError) throw new Error(`untrusted response ${token}`);
      return Response.json(snapshot);
    }
    if (url.endsWith("/cancel")) snapshot = { ...snapshot, phase: "cancelled", result: null };
    return Response.json(snapshot);
  };
  const command = (name, input, extras = []) => runPublicCommand([name, "--state", state, ...extras], input === undefined ? "" : JSON.stringify(input), fetcher);
  return { dir, state, calls, command, fetcher, source, setCap: changes => { cap = { ...cap, ...changes }; }, failRun: () => { runError = true; }, redirect: () => { redirect = true; }, invalidCitation: () => { invalidCitation = true; } };
}
test("portable public command previews locally, explicitly selects sources, submits once, exports citations and cancels", async () => {
  const h = await harness(), preview = await h.command("preview", packet);
  assert(!JSON.stringify(preview).includes(token)); assert.equal((await stat(h.state)).mode & 0o777, 0o600);
  assert(h.calls.every(c => !JSON.stringify(c.body ?? {}).includes(packet.notes)));
  await assert.rejects(h.command("sources", { website: "https://example.com" }), /Approve the exact/);
  const inspected = await h.command("sources", { website: "https://example.com" }, ["--approve-public-sources"]);
  assert.deepEqual(inspected.sources, [h.source]);
  const approved = await h.command("preview", { ...packet, selectedSourceIds: ["public-0"] });
  assert.equal(approved.preview.sources[0].text, h.source.text);
  const review = await h.command("submit", undefined, ["--approve", approved.approvalSha256]);
  assert.equal(review.session.phase, "complete"); assert(review.readable.includes("[founder-note]")); assert(review.readable.includes("[public-0]")); assert(!JSON.stringify(review).includes(token));
  const run = h.calls.find(c => c.url.endsWith("/run")); assert.equal(run.body.notes, packet.notes); assert.equal(run.body.sourceHashes["public-0"], h.source.sha256); assert.equal(run.body.consent, true);
  await assert.rejects(h.command("submit", undefined, ["--approve", approved.approvalSha256]), /submitted or expired/);
  const count = h.calls.length, exported = await h.command("export"); assert.equal(h.calls.length, count); assert.equal(exported.readable, review.readable);
  assert.equal((await h.command("status")).session.phase, "complete");
  assert.equal((await h.command("cancel")).phase, "cancelled"); await assert.rejects(stat(h.state), { code: "ENOENT" });
  assert.equal(h.calls.filter(c => c.url.endsWith("/run")).length, 1);
});
test("redaction invalidates old approval; changed recipients/retention fail before dispatch", async () => {
  const h = await harness(), old = await h.command("preview", packet);
  await h.command("preview", { ...packet, notes: "This is the revised and redacted fictional note for sharing." });
  await assert.rejects(h.command("submit", undefined, ["--approve", old.approvalSha256]), /exact current preview/);
  const next = await h.command("preview", packet); h.setCap({ retention: "Changed retention" });
  await assert.rejects(h.command("submit", undefined, ["--approve", next.approvalSha256]), /terms changed/);
  assert(!h.calls.some(c => c.url.endsWith("/run")));
});
test("ambiguous submission consumes one local attempt; status can recover result without another paid request", async () => {
  const h = await harness(), preview = await h.command("preview", packet); h.failRun();
  await assert.rejects(h.command("submit", undefined, ["--approve", preview.approvalSha256]), e => !e.message.includes(token) && /No automatic retry/.test(e.message));
  assert.equal(JSON.parse(await readFile(h.state)).attempted, true);
  await assert.rejects(h.command("submit", undefined, ["--approve", preview.approvalSha256]), /submitted or expired/);
  assert.equal((await h.command("status")).session.phase, "complete");
  assert.equal(h.calls.filter(c => c.url.endsWith("/run")).length, 1);
});
test("route drift, redirects, invented citations and stale sessions fail closed", async () => {
  const h = await harness(); h.setCap({ model: "another-model" }); await assert.rejects(h.command("preview", packet));
  h.setCap({ model: "openai/gpt-6.1-sol" }); h.redirect(); await assert.rejects(h.command("preview", packet));
  const other = await harness(), p = await other.command("preview", packet); other.invalidCitation();
  await assert.rejects(other.command("submit", undefined, ["--approve", p.approvalSha256]), /source citations/);
  assert.equal(JSON.parse(await readFile(other.state)).attempted, true);
  const stale = await harness(), s = await stale.command("preview", packet), saved = JSON.parse(await readFile(stale.state)); saved.session.expiresAt = new Date(0).toISOString(); await writeFile(stale.state, JSON.stringify(saved));
  await assert.rejects(stale.command("submit", undefined, ["--approve", s.approvalSha256]), /expired/);
  assert(!stale.calls.some(c => c.url.endsWith("/run")));
});
test("private state locking refuses concurrent commands, symlinks and readable-by-others files", async () => {
  const h = await harness(); await h.command("preview", packet);
  await writeFile(`${h.state}.lock`, ""); await assert.rejects(h.command("status"), /in use/); await rm(`${h.state}.lock`);
  const linked = path.join(h.dir, "linked.json"); await symlink(h.state, linked);
  await assert.rejects(runPublicCommand(["status", "--state", linked], "", h.fetcher));
  const { chmod } = await import("node:fs/promises"); await chmod(h.state, 0o644); await assert.rejects(h.command("status"), /private regular file/);
});
test("packaged CLI rejects arbitrary origins and invalid input without printing private contents", async () => {
  const h = await harness(), helper = new URL("../integrations/codex-plugins/sysdom-venture-review/scripts/public-review.mjs", import.meta.url);
  for (const args of [["preview", "--origin", "https://evil.example", "--state", h.state], ["preview", "--state", h.state]]) {
    const run = spawnSync(process.execPath, [helper.pathname, ...args], { cwd: h.dir, env: { PATH: path.dirname(process.execPath) }, input: `not-json-${token}`, encoding: "utf8", timeout: 5000 });
    assert.equal(run.status, 1); assert.equal(run.stdout, ""); assert(!run.stderr.includes(token));
  }
});
test("concurrent approved submits dispatch once, and oversized notes fail before any network request", async () => {
  const h = await harness();
  await assert.rejects(h.command("preview", { ...packet, notes: "x".repeat(8001) })); assert.equal(h.calls.length, 0);
  const preview = await h.command("preview", packet);
  const results = await Promise.allSettled([h.command("submit", undefined, ["--approve", preview.approvalSha256]), h.command("submit", undefined, ["--approve", preview.approvalSha256])]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(h.calls.filter(c => c.url.endsWith("/run")).length, 1);
});
