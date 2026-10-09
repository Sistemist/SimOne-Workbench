import { useEffect, useRef, useState } from "react";
import { publicReviewCapabilitySchema, publicReviewSnapshotSchema, publicReviewSourceSchema, type PublicReviewSource, type PublicReviewCapability, type PublicReviewSnapshot } from "@paperclipai/shared";
import { EarlyAccessRequestForm } from "../pages/EarlyAccessRequest";
import { trackPublicFunnelEvent } from "../lib/publicFunnel";
import { Button } from "./ui/button";

const base = "/api/public/venture-review";
const engineNames: Record<string, string> = { product_service: "Product/Service Engine", customer: "Customer Engine", cash: "Cash Engine", skills: "Skills Engine" };
const unavailable = { disabled: "Venture Review is not open yet. You can prepare your note here or request early access. Nothing is sent for analysis.", busy: "All review slots are currently occupied. Please check availability again shortly.", exhausted: "The current review budget is fully allocated. Your draft has not been sent for analysis.", paused: "Reviews are temporarily paused. Your draft has not been sent for analysis." };

export function PublicVentureReview({ example }: { example?: { question: string; notes: string } } = {}) {
  const [capability, setCapability] = useState<PublicReviewCapability | null>(null);
  const [question, setQuestion] = useState(""); const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); const [github, setGithub] = useState("");
  const [sources, setSources] = useState<PublicReviewSource[]>([]); const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ question: string; notes: string; consentVersion: string; selectedSourceIds: string[]; sourceHashes: Record<string, string> } | null>(null);
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<PublicReviewSnapshot | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const viewedResults = useRef(new Set<string>());
  const viewedPage = useRef(false);
  const [error, setError] = useState(""); const [exportText, setExportText] = useState("");
  const access = useRef<{ id: string; token: string } | null>(null);
  const controller = useRef<AbortController | null>(null); const epoch = useRef(0);
  async function request(suffix: string, body?: unknown, signal?: AbortSignal) {
    const response = await fetch(base + suffix, { method: body === undefined ? "GET" : "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(access.current ? { Authorization: `Bearer ${access.current.token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: signal ?? AbortSignal.timeout(10000) });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Review unavailable. Your draft is still here.");
    return value;
  }
  async function checkAvailability() {
    try { setCapability(publicReviewCapabilitySchema.parse(await request("/capability"))); setError(""); }
    catch { setError("We couldn't check availability. Your draft stays here; no review has started."); }
  }
  useEffect(() => { void checkAvailability(); return () => { epoch.current++; controller.current?.abort(); }; }, []);
  useEffect(() => {
    if (capability && !viewedPage.current) {
      viewedPage.current = true;
      trackPublicFunnelEvent("venture_review_view", { isTest: capability.mode === "recorded" });
    }
  }, [capability]);
  useEffect(() => {
    if (session?.result && !viewedResults.current.has(session.reviewId)) {
      viewedResults.current.add(session.reviewId);
      trackPublicFunnelEvent("venture_review_result", { isTest: session.mode === "recorded" });
    }
  }, [session]);
  async function ensureSession(signal?: AbortSignal) {
    if (access.current) return access.current;
    const created = await request("/sessions", {}, signal);
    if (!/^[a-f0-9]{64}$/.test(created.accessToken)) throw new Error("Review could not start safely.");
    const snapshot = publicReviewSnapshotSchema.parse({ reviewId: created.reviewId, phase: created.phase, expiresAt: created.expiresAt, mode: created.mode, result: created.result });
    access.current = { id: snapshot.reviewId, token: created.accessToken };
    return access.current;
  }
  async function inspect() {
    if (busy || (!website.trim() && !github.trim())) return;
    setBusy(true); setError("");
    try {
      const a = await ensureSession();
      const retrieved = publicReviewSourceSchema.array().max(2).parse(await request(`/sessions/${a.id}/sources`, { website, github }, AbortSignal.timeout(20000)));
      setSources(retrieved); setSelected(retrieved.filter(x => x.text && ["retrieved", "partial"].includes(x.status)).map(x => x.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Sources could not be read. You can continue with your note."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!preview || !consent || busy) return;
    const current = ++epoch.current; setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const a = await ensureSession(abort.signal);
      if (current !== epoch.current) return;
      const snapshot = publicReviewSnapshotSchema.parse(await request(`/sessions/${a.id}`, undefined, abort.signal));
      if (snapshot.phase !== "ready") { setSession(snapshot); return; }
      setSession({ ...snapshot, phase: "running" });
      trackPublicFunnelEvent("venture_review_start", { isTest: snapshot.mode === "recorded" });
      const result = await request(`/sessions/${a.id}/run`, { ...preview, consent: true, requestId: crypto.randomUUID() }, AbortSignal.any([abort.signal, AbortSignal.timeout(125000)]));
      if (current === epoch.current) setSession(publicReviewSnapshotSchema.parse(result));
    } catch (e) {
      if (current === epoch.current) {
        setError(access.current ? "The outcome isn't confirmed. Check this review's status or cancel it; it will not be submitted again." : e instanceof Error ? e.message : "Review unavailable. No model review was started.");
        if (access.current) setSession(s => s ?? { reviewId: access.current!.id, phase: "running", expiresAt: new Date().toISOString(), mode: capability?.mode === "recorded" ? "recorded" : "fresh", result: null });
      }
    } finally { if (current === epoch.current) setBusy(false); }
  }
  async function status() {
    if (!access.current) return;
    setBusy(true);
    try { setSession(publicReviewSnapshotSchema.parse(await request(`/sessions/${access.current.id}`))); setError(""); }
    catch { setError("Status is unavailable or the session expired. No new review was started."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!access.current) { setPreview(null); setConsent(false); return; }
    ++epoch.current; controller.current?.abort(); setBusy(true);
    try { setSession(publicReviewSnapshotSchema.parse(await request(`/sessions/${access.current.id}/cancel`, {}))); setExportText(""); setSources([]); setSelected([]); setError(""); }
    catch { setError("Cancellation wasn't confirmed. Check status or try cancelling again."); }
    finally { setBusy(false); }
  }
  function returnToDraft() {
    access.current = null; setShowAccess(false); setSession(null); setPreview(null); setConsent(false); setSources([]); setSelected([]); setExportText(""); void checkAvailability();
  }
  function citations(ids: string[]) {
    return <span className="block mt-1 text-sm text-muted-foreground">Sources: {ids.map((id, i) => <span key={id}>{i ? "; " : ""}<a className="underline" href={`#source-${id}`} onClick={() => { const detail = document.getElementById(`source-${id}`)?.closest("details"); if (detail) detail.open = true; }}>{id === "founder-note" ? "Your note" : sources.find(s => s.id === id)?.title ?? id}</a></span>)}</span>;
  }
  function sourceText(s: PublicReviewSource) {
    return <div className="space-y-2 break-words"><p className="font-medium">{s.title}</p><p className="text-sm">{s.url}</p><p className="text-sm text-muted-foreground">{s.simulated ? "Simulated source · " : ""}{s.status === "retrieved" ? "Read" : s.status === "partial" ? "Partly read" : s.status === "cancelled" ? "Cancelled" : "Unavailable"} · {s.capturedAt}</p><p className="whitespace-pre-wrap text-sm leading-relaxed">{s.text}</p>{s.omissions.map((x,i) => <p key={i} className="text-sm text-muted-foreground">{x}</p>)}</div>;
  }
  function exportReview() {
    if (!session?.result || !preview) return;
    const r = session.result;
    const cited = (x: { statement: string; evidenceSourceIds: string[] }) => `${x.statement} [Sources: ${x.evidenceSourceIds.join(", ")}]`;
    const text = ["Sysdom.ai — Venture Review", session.mode === "recorded" ? "RECORDED EXAMPLE WITH AUTHORED EDITS — NOT A NEW AI REVIEW" : "AI-assisted review — provisional, based only on your approved information",
      `Question: ${preview.question}`, "Our understanding of your business", r.businessUnderstanding ? cited(r.businessUnderstanding) : "Not established by this example.", "What looks promising", ...(r.strengths?.length ? r.strengths.map(cited) : ["The supplied evidence is too thin to identify a supported strength."]), "What may need attention", ...Object.entries(r.engineFindings).flatMap(([k, v]) => [engineNames[k], ...(v.length ? v.map(x => `${x.statement} [Sources: ${x.evidenceSourceIds.join(", ")}; ${x.basis}; ${x.confidence} confidence]`) : ["Unknown from the supplied evidence."])]),
      "Connections", ...r.interactions.map(cited), "Conflicting evidence", ...r.contradictions.map(cited), "What we still need to know", ...r.unknowns,
      "Other explanations", ...r.alternatives.map(x => `${x.explanation} [For: ${x.evidenceFor.join(", ")}; Against: ${x.evidenceAgainst.join(", ")}]`), "A practical next step", r.nextTest.question, r.nextTest.action, r.nextTest.successSignal,
      "Limitations", ...r.omissions, `Method: ${r.rubricVersion}`, "founder-note: Your approved evidence", preview.notes, ...sources.filter(x => preview.selectedSourceIds.includes(x.id)).map(x => `${x.id}: ${x.url}\nRetrieved: ${x.capturedAt}; ${x.status}\n${x.text}\n${x.omissions.join("; ")}`),
      "No action, spend, sharing or venture-record update is authorized by this review."].join("\n\n");
    setExportText(text);
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "sysdom-venture-review.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const r = session?.result;
  return <main className="h-dvh overflow-y-auto bg-background text-foreground"><div className="mx-auto max-w-3xl px-5 py-10 sm:py-16 space-y-8">
    <header className="space-y-4"><a href="https://sysdom.ai" className="text-sm font-semibold underline-offset-4 hover:underline">Sysdom.ai</a><h1 className="text-3xl sm:text-4xl font-semibold text-balance">Review your venture</h1><p className="text-lg leading-relaxed text-muted-foreground">Bring one decision and the evidence you have. Explore what it supports, what is still uncertain, and one practical next step.</p></header>
    <section aria-labelledby="review-privacy-heading" className="border-y border-border bg-muted/40 px-5 py-5 space-y-3">
      <h2 id="review-privacy-heading" className="text-lg font-semibold">Your idea stays out of public view.</h2>
      <p className="leading-relaxed">You choose what to share and review exactly what will be sent before approving AI processing. We do not publish your idea or review.</p>
      <p className="text-sm leading-relaxed">Leave out passwords, personal identifiers and sensitive details you are not ready to share.</p>
      <details className="text-sm leading-relaxed">
        <summary className="cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">How sharing and storage work</summary>
        <div className="mt-3 space-y-3">
          <p>Your note stays in this page until you approve the review. If you ask us to read public sources, their URLs go to Sysdom and those sites are contacted before the AI review. You can exclude their excerpts in the sharing preview.</p>
          <p>The sharing preview names the services that process your approved information and explains their current retention terms.</p>
          {capability?.retention ? <p>{capability.retention}</p> : null}
          <p>Downloading creates a copy you control. An optional access request separately saves the contact details and message you choose to send; it does not save this full review.</p>
        </div>
      </details>
    </section>
    {capability?.mode === "recorded" ? <p role="status" className="border border-border p-4">Example review—not an analysis of your business. This local replay includes authored refinements; no model is called.</p> : null}
    {error ? <p role="alert" className="border border-border p-4">{error}</p> : null}
    {!capability ? <section><p role="status">{error ? "Review availability is unknown." : "Checking review availability…"}</p>{error ? <Button variant="outline" onClick={() => void checkAvailability()}>Check availability</Button> : null}</section> : capability.state !== "available" && !session ? <section className="space-y-3" aria-label="Review availability"><p role="status">{unavailable[capability.state]}</p><Button variant="outline" onClick={() => void checkAvailability()}>Check availability</Button><a href="/request-access" className="ml-4 underline">Request early access</a></section> : null}
    {!preview && !session ? <form className="space-y-6" onSubmit={e => { e.preventDefault(); if (capability?.state === "available") { trackPublicFunnelEvent("venture_review_click", { isTest: capability.mode === "recorded" }); setPreview({ question: question.trim(), notes: notes.trim(), consentVersion: capability.consentVersion, selectedSourceIds: [...selected], sourceHashes: Object.fromEntries(sources.filter(s => selected.includes(s.id)).map(s => [s.id, s.sha256])) }); setConsent(false); } }}>
      {example ? <Button type="button" variant="outline" onClick={() => { setQuestion(example.question); setNotes(example.notes); }}>Try the fictional example</Button> : null}
      <label className="block space-y-2"><span className="font-medium">What are you building, and what decision are you facing?</span><textarea required minLength={5} maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} className="w-full min-h-24 rounded-md border border-input bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring" placeholder="Should we acquire more customers, or improve delivery first?" /></label>
      <label className="block space-y-2"><span className="font-medium">What do you know so far?</span><textarea required minLength={30} maxLength={8000} value={notes} onChange={e => setNotes(e.target.value)} className="w-full min-h-52 rounded-md border border-input bg-background p-3 focus-visible:outline-2 focus-visible:outline-ring" placeholder="Describe the venture, recent observations, dates, constraints and anything that contradicts your current explanation." /><span className="block text-sm text-muted-foreground">{notes.length.toLocaleString()} / 8,000 characters. Leave out names, customer identifiers, passwords and confidential material you cannot share.</span></label>
      <p className="text-sm text-muted-foreground">Your note stays in this page until you approve the review. Reading public sources sends their URLs to Sysdom and contacts those sites. No private files, repository clone or code execution. There is no automatic browser save.</p>
      <label className="block space-y-2"><span className="font-medium">Business website (optional)</span><input type="url" maxLength={2000} value={website} onChange={e => setWebsite(e.target.value)} className="w-full rounded-md border border-input bg-background p-3" placeholder="https://example.com" /><span className="block text-sm text-muted-foreground">No website yet? Continue with your note.</span></label>
      <label className="block space-y-2"><span className="font-medium">Public GitHub repository (optional)</span><input type="url" maxLength={2000} value={github} onChange={e => setGithub(e.target.value)} className="w-full rounded-md border border-input bg-background p-3" placeholder="https://github.com/owner/repository" /><span className="block text-sm text-muted-foreground">We read the public README for context. We do not run code or perform a security audit.</span></label>
      <Button type="button" variant="outline" disabled={busy || capability?.state !== "available" || (!website.trim() && !github.trim())} onClick={() => void inspect()}>{busy ? "Reading sources…" : "Read selected public sources"}</Button>
      {sources.length ? <section aria-label="Public sources" className="space-y-5"><p>Check these excerpts. Uncheck a source to exclude it from the AI review.</p>{sources.map(s => <div key={s.id} className="border-t border-border pt-4 space-y-3">{sourceText(s)}<label className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(s.id)} disabled={!s.text || !["retrieved", "partial"].includes(s.status)} onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))} />Include {s.title}</label></div>)}</section> : null}
      {(website || github) && !sources.length ? <p className="text-sm text-muted-foreground">Unread links will not be sent to the reviewer. Read them above or continue with your note.</p> : null}
      <Button type="submit" disabled={busy || capability?.state !== "available" || question.trim().length < 5 || notes.trim().length < 30}>Check what will be shared</Button>
    </form> : null}
    {preview && !session ? <section aria-label="Sharing preview" className="space-y-5"><h2 className="text-2xl font-semibold">Check before you share</h2><p className="font-medium whitespace-pre-wrap break-words">{preview.question}</p><p className="whitespace-pre-wrap break-words leading-relaxed">{preview.notes}</p>{sources.filter(s => preview.selectedSourceIds.includes(s.id)).map(s => <div key={s.id}>{sourceText(s)}</div>)}<p className="text-sm">{preview.selectedSourceIds.length} public sources selected. Excluded and unread source content will not be sent.</p><div className="border-y border-border py-5 space-y-3"><p>Recipients: {capability?.recipients.join(", ")}.</p><p className="text-sm leading-relaxed">{capability?.retention}</p><p className="text-sm">You control whether to act on the review. It may be incomplete or wrong. No automatic follow-up, publication, spending or account creation.</p></div><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>I approve sending this question, note and selected excerpts to the recipients above for this review.</span></label><div className="flex flex-wrap gap-3"><Button disabled={!consent || busy} onClick={() => void submit()}>{busy ? "Starting review…" : capability?.mode === "recorded" ? "Show the recorded example" : "Approve and start review"}</Button><Button variant="outline" disabled={busy} onClick={() => { setPreview(null); setConsent(false); }}>Edit my note</Button></div></section> : null}
    {session && !r ? <section aria-live="polite" className="space-y-4"><h2 className="text-2xl font-semibold">{session.phase === "running" ? "Reviewing your evidence" : session.phase === "failed" ? "The review could not complete" : session.phase === "cancelled" ? "Review cancelled" : "Review not started"}</h2><p>{session.phase === "running" ? "This can take up to two minutes. No additional request will be made automatically." : session.phase === "cancelled" ? "The service has cleared this review. A request already sent to the provider cannot be recalled." : "No substitute or keyword diagnosis was generated. Your original draft remains in this page."}</p>{access.current && session.phase !== "cancelled" ? <div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={() => void status()}>Check review status</Button><Button variant="outline" onClick={() => void cancel()}>Cancel review</Button></div> : null}{["failed", "cancelled"].includes(session.phase) ? <Button variant="outline" onClick={returnToDraft}>Return to my draft</Button> : null}</section> : null}
    {r ? <section aria-label="Your review" className="space-y-6"><div><h2 className="text-2xl font-semibold">Your review</h2><p className="mt-2 text-sm text-muted-foreground">{session.mode === "recorded" ? "Recorded example with authored edits. No fresh AI assessment." : "AI-assisted interpretation of your approved information. It is not independently verified."}</p></div>
      <section className="space-y-2"><h3 className="text-xl font-semibold">Our understanding of your business</h3>{r.businessUnderstanding ? <p className="leading-relaxed">{r.businessUnderstanding.statement}{citations(r.businessUnderstanding.evidenceSourceIds)}</p> : <p>This recorded example does not include a business summary.</p>}</section>
      <section className="space-y-2"><h3 className="text-xl font-semibold">What looks promising</h3>{r.strengths?.length ? r.strengths.map((f,i) => <p key={i}>{f.statement}{citations(f.evidenceSourceIds)}</p>) : <p>The supplied evidence is too thin to identify a supported strength.</p>}</section>
      <section className="space-y-3"><h3 className="text-xl font-semibold">What may need attention</h3>{r.interactions.length ? r.interactions.map((x,i) => <p key={i}>{x.statement}{citations(x.evidenceSourceIds)}</p>) : <p>No connection can be established from the supplied information.</p>}
      <details><summary className="cursor-pointer font-medium">How this connects across your business</summary><div className="mt-4 space-y-4">{Object.entries(r.engineFindings).map(([k, findings]) => <section key={k} className="space-y-2"><h4 className="font-semibold">{engineNames[k]}</h4>{findings.length ? findings.map((f,i) => <p key={i}>{f.statement}{citations(f.evidenceSourceIds)}<span className="block text-sm text-muted-foreground">{f.basis === "hypothesis" ? "Possible explanation" : f.basis === "observed_text" ? "Observed in the supplied text" : "Source claim"} · {f.confidence} confidence</span></p>) : <p>Unknown from the evidence you shared.</p>}</section>)}</div></details></section>
      {r.contradictions.length ? <section><h3 className="font-semibold">Conflicting evidence</h3><ul className="list-disc pl-5">{r.contradictions.map((x,i) => <li key={i}>{x.statement}{citations(x.evidenceSourceIds)}</li>)}</ul></section> : null}
      <section><h3 className="font-semibold">What we still need to know</h3><ul className="list-disc pl-5 space-y-2 mt-2">{r.unknowns.map((x,i) => <li key={i}>{x}</li>)}</ul></section>
      <section><h3 className="font-semibold">Other explanations</h3><ul className="list-disc pl-5 space-y-2 mt-2">{r.alternatives.map((x,i) => <li key={i}>{x.explanation}{x.evidenceFor.length || x.evidenceAgainst.length ? citations([...new Set([...x.evidenceFor, ...x.evidenceAgainst])]) : null}</li>)}</ul></section>
      <section className="border-y border-border py-6 space-y-3"><h3 className="text-xl font-semibold">A practical next step</h3><p className="font-medium">{r.nextTest.question}</p><p>{r.nextTest.action}</p><p>{r.nextTest.successSignal}</p></section>
      <details className="space-y-3"><summary className="cursor-pointer font-medium">Evidence, limitations and review details</summary><div id="source-founder-note"><h4 className="font-medium">Your approved note</h4><p className="whitespace-pre-wrap break-words">{preview?.notes}</p></div>{sources.filter(s => preview?.selectedSourceIds.includes(s.id)).map(s => <div key={s.id} id={`source-${s.id}`}>{sourceText(s)}</div>)}{r.omissions.map((x,i) => <p key={i} className="text-sm">{x}</p>)}<p className="text-sm">Method: {r.rubricVersion}. Processing services: {capability?.recipients.join(", ")}. {session.mode === "recorded" ? "Historical source only; this replay did not call it." : "One bounded request; no fallback model."}</p></details>
      <div className="flex flex-wrap gap-3"><Button onClick={exportReview}>Download my review</Button><Button variant="outline" onClick={() => void cancel()}>Clear this review</Button></div>
      <section aria-label="Continue after your review" className="border-t border-border pt-6 space-y-3">
        <h3 className="text-xl font-semibold">Continue with Sysdom.ai</h3>
        <p>Your review is available without an account. Access to the business workspace is currently by invitation. An access request does not create an account or save this full review.</p>
        <div className="flex flex-wrap items-center gap-4"><Button variant="outline" onClick={() => { if (!showAccess) trackPublicFunnelEvent("venture_review_access_click", { isTest: session.mode === "recorded" }); setShowAccess(v => !v); }}>{showAccess ? "Close access request" : "Request access to continue"}</Button><a className="underline" href="/auth?next=%2Fapp">Already have access? Sign in</a></div>
        {showAccess ? <EarlyAccessRequestForm embedded source="venture-review" isTest={session.mode === "recorded"} reviewSummary={["Review context (AI interpretation, not independently verified):", r.businessUnderstanding?.statement, "Suggested next step:", r.nextTest.question, r.nextTest.action].filter(Boolean).join("\n\n")} /> : null}
      </section>
      {exportText ? <label className="block space-y-2"><span>Or copy your review</span><textarea readOnly value={exportText} className="w-full min-h-40 border border-input rounded-md p-3" /></label> : null}
      <p className="text-sm text-muted-foreground">The export includes your approved note and selected source excerpts. Save or share it only where you intend.</p>
    </section> : null}
    <footer className="border-t border-border pt-5 text-sm text-muted-foreground">Sysdom.ai · The agentic venture builder. Founder judgment stays in control.</footer>
  </div></main>;
}
