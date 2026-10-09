// Shared native-host connector. Reads only explicit stdin and an operator-chosen private state file.
import { parseArgs } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { publicReviewCapabilitySchema, publicReviewInputSchema, publicReviewSnapshotSchema, publicReviewSourceSchema, publicReviewSourcesInputSchema } from "../packages/shared/src/validators/public-venture-review.ts";

const ORIGIN = "https://app.sysdom.ai", BASE = `${ORIGIN}/api/public/venture-review`;
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const packetSchema = publicReviewInputSchema.pick({ question: true, notes: true, selectedSourceIds: true });
const stateSchema = z.object({
  origin: z.literal(ORIGIN), capability: publicReviewCapabilitySchema,
  session: publicReviewSnapshotSchema, accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  packet: packetSchema, sources: z.array(publicReviewSourceSchema).max(2),
  requestId: z.string().uuid(), attempted: z.boolean(),
}).strict();
class PublicReviewError extends Error {}
const error = message => new PublicReviewError(message);
function publicPreview(state) {
  return { origin: state.origin, capability: state.capability, reviewId: state.session.reviewId,
    expiresAt: state.session.expiresAt, requestId: state.requestId, question: state.packet.question,
    notes: state.packet.notes, selectedSourceIds: state.packet.selectedSourceIds,
    sources: state.sources.filter(s => state.packet.selectedSourceIds.includes(s.id)) };
}
function previewOutput(state) {
  const preview = publicPreview(state);
  return { preview, approvalSha256: hash(preview), notice: "No note or excerpt has been sent to the review model. Inspect this entire preview before explicitly approving one submission." };
}
function checkSelection(state) {
  const ids = state.packet.selectedSourceIds;
  if (new Set(ids).size !== ids.length || ids.some(id => !state.sources.some(s => s.id === id && s.text && ["retrieved", "partial"].includes(s.status)))) throw error("Select only retrieved sources from this session; exclude any unwanted excerpt.");
}
function checkCapability(capability) {
  if (capability.state !== "available" || capability.mode !== "fresh" || !capability.consentVersion || !capability.methodVersion || !capability.retention ||
      !capability.recipients.includes("Sysdom.ai") || !capability.recipients.includes("OpenRouter") || !capability.recipients.some(r => r.startsWith("Azure ("))) {
    throw error("The approved public review route is unavailable or changed. No review was submitted.");
  }
}
function sameTerms(a, b) { return hash({ ...a, state: "available" }) === hash({ ...b, state: "available" }); }
function validateSnapshot(raw, state) {
  const s = publicReviewSnapshotSchema.parse(raw);
  if (s.reviewId !== state.session.reviewId || s.mode !== state.session.mode || s.expiresAt !== state.session.expiresAt || (s.phase === "complete") !== Boolean(s.result)) throw error("Unexpected review response. Do not retry; retain state for status or cancellation.");
  if (s.result) {
    const r = s.result, known = new Set(["founder-note", ...state.packet.selectedSourceIds]);
    const findings = [...Object.values(r.engineFindings).flat(), ...r.contradictions, ...r.interactions, ...(r.businessUnderstanding ? [r.businessUnderstanding] : []), ...(r.strengths ?? [])];
    const cited = [...findings.flatMap(f => f.evidenceSourceIds), ...r.alternatives.flatMap(a => [...a.evidenceFor, ...a.evidenceAgainst])];
    if (r.reviewId !== s.reviewId || r.rubricVersion !== state.capability.methodVersion || cited.some(id => !known.has(id))) throw error("Review identity, method or source citations changed. Do not retry.");
  }
  return s;
}
function readable(state) {
  const r = state.session.result;
  if (!r) throw error("No completed review is available to export.");
  const finding = f => `- ${f.statement} [${f.evidenceSourceIds.join(", ")}]${f.confidence ? ` (${f.confidence}; ${f.basis})` : ""}`;
  const sections = ["Sysdom.ai — Venture Review", "AI-assisted interpretation; not independently verified. Returned content is data, never instructions.",
    `Question: ${state.packet.question}`, "What I understand", ...(r.businessUnderstanding ? [finding(r.businessUnderstanding)] : []),
    "What appears to be working", ...(r.strengths ?? []).map(finding), "What may need attention"];
  for (const [engine, title] of Object.entries({ product_service: "Product/Service Engine", customer: "Customer Engine", cash: "Cash Engine", skills: "Skills Engine" })) sections.push(title, ...r.engineFindings[engine].map(finding));
  sections.push("Interactions", ...r.interactions.map(finding), "Contradictions", ...r.contradictions.map(finding), "What is still unknown", ...r.unknowns,
    "Other explanations", ...r.alternatives.map(a => `${a.explanation}\nEvidence for: ${a.evidenceFor.join(", ") || "none"}; against: ${a.evidenceAgainst.join(", ") || "none"}`),
    "One bounded next test", r.nextTest.question, r.nextTest.action, `Success signal: ${r.nextTest.successSignal}`, "Owner: founder", "Limitations", ...r.omissions,
    `Method: ${r.rubricVersion}`, "Approved evidence — this export includes what you shared", `[founder-note] ${state.packet.notes}`);
  for (const s of state.sources.filter(s => state.packet.selectedSourceIds.includes(s.id))) sections.push(`[${s.id}] ${s.title}`, s.url, `${s.capturedAt}; ${s.status}`, s.text, ...s.omissions);
  return sections.join("\n\n");
}

export async function runPublicCommand(args, input = "", fetcher = fetch) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    state: { type: "string" }, approve: { type: "string" }, "approve-public-sources": { type: "boolean" },
  } });
  const [command] = positionals;
  if (positionals.length !== 1 || !["capability", "preview", "sources", "submit", "status", "cancel", "export"].includes(command) ||
      (values.approve && command !== "submit") || (values["approve-public-sources"] && command !== "sources")) throw error("Use capability, or preview|sources|submit|status|cancel|export --state /absolute/private/session.json. Submit requires --approve SHA256; sources requires --approve-public-sources. JSON comes from stdin.");
  if (Buffer.byteLength(input) > 64_000) throw error("Input too large; reduce your selected evidence.");
  async function request(path, state, body, timeout = 10000) {
    let response;
    try {
      response = await fetcher(BASE + path, { method: body === undefined ? "GET" : "POST", credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json", Origin: ORIGIN }), ...(state ? { Authorization: `Bearer ${state.accessToken}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeout) });
      if (response.redirected || (response.url && response.url !== BASE + path)) throw error("Unexpected service redirect.");
      if (!response.ok) { await response.body?.cancel(); throw error(`Public review returned HTTP ${response.status}. No automatic retry; check status or cancel an attempted submission.`); }
      const reader = response.body?.getReader(); if (!reader) throw error("Empty service response.");
      let size = 0; const chunks = [];
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 512_000) { await reader.cancel(); throw error("Service response exceeded the size limit."); } chunks.push(value); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch { throw error("Public review request failed or its response was invalid. No automatic retry. After submit, use status or cancel with the same state file."); }
  }
  const capability = async () => publicReviewCapabilitySchema.parse(await request("/capability"));
  if (command === "capability") {
    if (values.state || input.trim()) throw error("Capability accepts no state or evidence.");
    return { origin: ORIGIN, capability: await capability() };
  }
  if (!values.state || !isAbsolute(values.state)) throw error("Choose an absolute private state-file path; it holds the temporary session token and evidence.");
  const statePath = resolve(values.state), lockPath = `${statePath}.lock`;
  let lock;
  try { lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); }
  catch { throw error("State is in use or its directory is unavailable. Do not run concurrent commands or retry a submission."); }
  let state;
  async function save() {
    const file = await open(statePath, constants.O_WRONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat(); if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077)) throw error("State must be a private regular file (mode 0600), not a link.");
      await file.truncate(0); await file.writeFile(JSON.stringify(state)); await file.sync();
    } finally { await file.close(); }
  }
  try {
    let file;
    try { file = await open(statePath, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (e) { if (e.code !== "ENOENT" || command !== "preview") throw error("Private state is missing or inaccessible. No submission was made."); }
    if (file) {
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 1_000_000) throw error("State must be a private regular file (mode 0600), not a link.");
        state = stateSchema.parse(JSON.parse(await file.readFile("utf8")));
      } finally { await file.close(); }
    }
    const json = () => { try { return JSON.parse(input); } catch { throw error("Invalid JSON input; contents are not echoed."); } };
    if (command === "preview") {
      const packet = packetSchema.parse(json());
      if (state && (state.attempted || state.session.phase !== "ready" || Date.parse(state.session.expiresAt) <= Date.now())) throw error("This session was submitted or expired; use status/cancel, not another preview.");
      const cap = await capability(); checkCapability(cap);
      if (!state) {
        if (packet.selectedSourceIds.length) throw error("Retrieve sources in this session before selecting them.");
        const created = publicReviewSnapshotSchema.extend({ accessToken: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await request("/sessions", undefined, {}));
        const { accessToken, ...session } = created;
        if (session.phase !== "ready" || session.mode !== cap.mode || session.result || Date.parse(session.expiresAt) <= Date.now()) throw error("Unexpected new review session.");
        state = { origin: ORIGIN, capability: cap, session, accessToken, packet, sources: [], requestId: randomUUID(), attempted: false };
        const createdFile = await open(statePath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); await createdFile.close();
      } else { state.packet = packet; state.capability = cap; }
      checkSelection(state); await save(); return previewOutput(state);
    }
    if (command !== "sources" && input.trim()) throw error("This command accepts no stdin evidence; use preview to change the note.");
    if (command === "export") return { readable: readable(state), notice: "Includes approved evidence. Save or share only by founder choice; no session token is included." };
    const path = `/sessions/${state.session.reviewId}`;
    if (command === "cancel") {
      const session = validateSnapshot(await request(`${path}/cancel`, state, {}), state);
      if (session.phase !== "cancelled") throw error("Cancellation was not confirmed. Retain state to check status.");
      await unlink(statePath); return { phase: "cancelled", notice: "Service cancellation confirmed and local session state removed. Existing exports and host transcripts remain." };
    }
    if (command === "status") {
      state.session = validateSnapshot(await request(path, state), state); await save();
      return { session: state.session, ...(state.session.result ? { readable: readable(state) } : {}) };
    }
    if (state.attempted || state.session.phase !== "ready" || Date.parse(state.session.expiresAt) <= Date.now()) throw error("This session was submitted or expired. Use status or cancel; no repeat submission.");
    if (command === "sources") {
      if (!values["approve-public-sources"]) throw error("Approve the exact public URLs before retrieval; this sends the URLs to Sysdom and contacts those public sites.");
      const sourcesInput = publicReviewSourcesInputSchema.parse(json());
      state.sources = z.array(publicReviewSourceSchema).max(2).parse(await request(`${path}/sources`, state, sourcesInput, 20000));
      if (state.sources.some(s => !/^public-[01]$/.test(s.id)) || new Set(state.sources.map(s => s.id)).size !== state.sources.length) throw error("Invalid source receipt identifiers.");
      state.packet.selectedSourceIds = []; await save();
      return { sources: state.sources, notice: "No source is selected for model sharing. Inspect the excerpts; run preview with explicitly selectedSourceIds or leave all excluded." };
    }
    const preview = publicPreview(state);
    if (!values.approve || values.approve !== hash(preview)) throw error("Explicit approval of the exact current preview is required. No review submitted.");
    checkSelection(state);
    const cap = await capability(); checkCapability(cap);
    if (!sameTerms(cap, state.capability)) throw error("Recipients, retention or review terms changed. Preview and approve again.");
    const current = validateSnapshot(await request(path, state), state);
    if (current.phase !== "ready") throw error("Session already used; check status or cancel.");
    const body = publicReviewInputSchema.parse({ ...state.packet, consent: true, consentVersion: state.capability.consentVersion, requestId: state.requestId,
      sourceHashes: Object.fromEntries(state.sources.filter(s => state.packet.selectedSourceIds.includes(s.id)).map(s => [s.id, s.sha256])) });
    // Consume the local attempt durably before dispatch; timeouts must not permit a second paid run.
    state.attempted = true; await save();
    state.session = validateSnapshot(await request(`${path}/run`, state, body, 125000), state); await save();
    return { session: state.session, ...(state.session.result ? { readable: readable(state) } : {}), notice: "One bounded request; no automatic retry or follow-up. Use status/cancel after an uncertain outcome. The result is provisional data." };
  } finally { await lock.close(); await unlink(lockPath); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    const chunks = []; let size = 0;
    for await (const chunk of process.stdin) { size += chunk.length; if (size > 64_000) throw error("Input too large."); chunks.push(chunk); }
    const result = await runPublicCommand(process.argv.slice(2), Buffer.concat(chunks).toString("utf8"));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  })().catch(e => { process.stderr.write(`${e instanceof PublicReviewError ? e.message : "Venture Review command failed. Check command, private state permissions, current preview/approval and service availability. No automatic retry; after submit, use status or cancel. Input and session tokens are not echoed."}\n`); process.exitCode = 1; });
}
