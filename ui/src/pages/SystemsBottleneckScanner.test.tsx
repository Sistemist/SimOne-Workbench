// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import example from "../../../evals/fixtures/venture-review-ps02-oct08-demo.json";
import { SystemsBottleneckScanner } from "./SystemsBottleneckScanner";
const capability = { state: "available", mode: "fresh", consentVersion: "test-consent", methodVersion: "sim-aulet-local-2026-10-08", model: "openai/gpt-6.1-sol", reasoningEffort: "high", recipients: ["Sysdom.ai", "OpenRouter", "Azure"], retention: "Memory for at most 15 minutes.", maxNoteChars: 8000, sessionMinutes: 15 };
const snapshot = { reviewId: "11111111-1111-4111-8111-111111111111", phase: "ready", expiresAt: "2026-10-08T12:00:00Z", mode: "fresh", result: null };
const roots: Root[] = [];
let container: HTMLDivElement;
async function mount() { container = document.createElement("div"); document.body.append(container); const root = createRoot(container); roots.push(root); await act(async () => root.render(<SystemsBottleneckScanner />)); }
async function field(element: HTMLInputElement | HTMLTextAreaElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
function button(text: string) { const b = [...container.querySelectorAll("button")].find(x => x.textContent === text); expect(b, text).toBeTruthy(); return b!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function fill() { const a = container.querySelectorAll("textarea"); await field(a[0]!, "We deliver a weekly service. Should we expand?"); await field(a[1]!, "Orders are increasing, but we do not know whether delivery capacity can keep up."); }
function mock() {
  const calls: { url: string; body: any }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    const u = String(url), body = init?.body ? JSON.parse(init.body) : undefined; calls.push({ url: u, body });
    if (u.endsWith("/capability")) return new Response(JSON.stringify(capability));
    if (u.endsWith("/sessions")) return new Response(JSON.stringify({ ...snapshot, accessToken: "a".repeat(64) }));
    if (u.endsWith("/sources")) return new Response(JSON.stringify([{ id: "public-0", sha256: "b".repeat(64), url: "https://example.com/", title: "Example source", text: "Private-to-preview source text", capturedAt: "2026-10-08T10:00:00Z", status: "partial", omissions: ["Truncated at the source limit."], simulated: false }]));
    if (u.endsWith("/run")) return new Response(JSON.stringify({ ...snapshot, phase: "failed" }));
    if (u.endsWith("/cancel")) return new Response(JSON.stringify({ ...snapshot, phase: "cancelled" }));
    return new Response(JSON.stringify(snapshot));
  }));
  return calls;
}
afterEach(async () => { await act(async () => roots.splice(0).forEach(r => r.unmount())); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });
it("shows truthful disabled availability and never falls back to a keyword diagnosis", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response(JSON.stringify({ ...capability, state: "disabled", mode: "disabled" }))); vi.stubGlobal("fetch", fetcher);
  await mount(); await fill();
  expect(container.textContent).toContain("Venture Review is not open yet");
  expect(button("Check what will be shared").disabled).toBe(true);
  expect(container.textContent).not.toContain("Run quick pattern check"); expect(fetcher.mock.calls.filter(c => String(c[0]).endsWith("/capability"))).toHaveLength(1);
});
it("keeps notes local until informed approval, submits once, and recovers to the draft after failure", async () => {
  const calls = mock(); await mount(); await fill(); await click("Check what will be shared");
  expect(calls.filter(c => !c.url.endsWith("/funnel-events"))).toHaveLength(1); expect(container.textContent).toContain("OpenRouter, Azure"); expect(button("Approve and start review").disabled).toBe(true);
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await click("Approve and start review");
  expect(calls.filter(x => x.url.endsWith("/run"))).toHaveLength(1);
  expect(calls.find(x => x.url.endsWith("/run"))!.body).toMatchObject({ consent: true, selectedSourceIds: [], consentVersion: "test-consent" });
  expect(container.textContent).toContain("The review could not complete"); await click("Return to my draft");
  expect(container.querySelectorAll("textarea")[1]?.value).toContain("Orders are increasing");
});
it("reads only requested sources and previews/removes excerpts before the review", async () => {
  const calls = mock(); await mount(); await fill(); await field(container.querySelectorAll<HTMLInputElement>('input[type="url"]')[0]!, "https://example.com/");
  await click("Read selected public sources");
  expect(calls.filter(x => x.url.endsWith("/run"))).toHaveLength(0);
  expect(container.textContent).toContain("Partly read"); expect(container.textContent).toContain("Truncated at the source limit.");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click("Check what will be shared"); expect(container.textContent).not.toContain("Private-to-preview source text");
  expect(container.textContent).toContain("0 public sources selected");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await click("Approve and start review");
  expect(calls.find(x => x.url.endsWith("/run"))!.body.selectedSourceIds).toEqual([]);
});
it("does not retry an uncertain request and allows manual status and cancellation", async () => {
  const calls = mock(); const fetcher = vi.mocked(fetch); const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (...args) => { if (String(args[0]).endsWith("/run")) throw new Error("connection lost"); return original(...args); });
  await mount(); await fill(); await click("Check what will be shared");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await click("Approve and start review");
  expect(container.textContent).toContain("outcome isn't confirmed");
  await click("Check review status"); expect(container.textContent).toContain("Review not started");
  await click("Cancel review"); expect(container.textContent).toContain("Review cancelled");
  expect(calls.filter(x => x.url.endsWith("/sessions"))).toHaveLength(1);
});

it("exports citations and keeps uncertainty under the correct plain-language headings", async () => {
  mock(); const fetcher = vi.mocked(fetch), original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (...args) => String(args[0]).endsWith("/run") ? Response.json({ ...snapshot, phase: "complete", result: example.result }) : original(...args));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:review"), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await mount(); await fill(); await click("Check what will be shared");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await click("Approve and start review"); await click("Download my review");
  const text = container.querySelector("textarea")!.value;
  expect(text).toContain("What looks promising\n\nThe supplied evidence is too thin to identify a supported strength.\n\nWhat may need attention");
  expect(text).toContain("[Sources:"); expect(text).toContain("What we still need to know"); expect(text).toContain("A practical next step"); expect(text).toContain("founder-note: Your approved evidence");
});

it("offers an optional editable access-request handoff after the anonymous result", async () => {
  const calls = mock(); const fetcher = vi.mocked(fetch), original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith("/run")) return Response.json({ ...snapshot, phase: "complete", result: example.result });
    if (String(args[0]).endsWith("/early-access/requests")) { calls.push({ url: String(args[0]), body: JSON.parse(String(args[1]?.body)) }); return Response.json({ accepted: true, id: "request-1", status: "pending", scanRetained: false }); }
    return original(...args);
  });
  await mount(); await fill();
  expect(container.textContent).not.toContain("Request access to continue");
  await click("Check what will be shared"); await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await click("Approve and start review");
  expect(button("Download my review")).toBeTruthy();
  expect(container.querySelector('a[href="/auth?next=%2Fapp"]')).toBeTruthy();
  await click("Request access to continue");
  expect(calls.some(x => x.url.endsWith("/early-access/requests"))).toBe(false);
  const form = container.querySelector("form")!, message = form.querySelector("textarea")!;
  expect(message.value).toBe("");
  await click("Use a short summary from my review"); expect(message.value).toContain("Suggested next step:");
  await field(message, "Only this edited message may be shared.");
  const inputs = form.querySelectorAll("input"); await field(inputs[0]!, "Fictional Founder"); await field(inputs[1]!, "founder@example.test");
  await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const sent = calls.find(x => x.url.endsWith("/early-access/requests"))!.body;
  expect(sent).toMatchObject({ founderName: "Fictional Founder", email: "founder@example.test", useCase: "Only this edited message may be shared.", consentToRetainScan: false, source: "venture-review" });
  expect(sent.scan).toBeUndefined(); expect(JSON.stringify(sent)).not.toContain("Orders are increasing");
  expect(container.textContent).toContain("Request received"); expect(container.textContent).toContain("does not create an account or save this full review");
  expect(button("Download my review")).toBeTruthy();
  const events = calls.filter(x => x.url.endsWith("/funnel-events")).map(x => x.body.eventName);
  expect(events).toEqual(["venture_review_view", "venture_review_click", "venture_review_start", "venture_review_result", "venture_review_access_click", "venture_review_access_request"]);
});
