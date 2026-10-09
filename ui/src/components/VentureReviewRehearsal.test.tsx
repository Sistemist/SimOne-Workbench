// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareVentureReviewPreview, type VentureReviewClient, type VentureReviewSnapshot } from "@paperclipai/shared";
import { SystemsBottleneckScanner } from "../pages/SystemsBottleneckScanner";
import example from "../../../evals/fixtures/venture-review-cu01-demo.json";
import { ventureReviewResultSchema } from "@paperclipai/shared";

const initial: VentureReviewSnapshot = {
  reviewId: "11111111-1111-4111-8111-111111111111", requestId: "22222222-2222-4222-8222-222222222222", question: "Fictional question", phase: "awaiting_evidence", expiresAt: "2026-09-21T20:00:00.000Z", followupsUsed: 0, result: null, mockOnly: true,
  disclosure: { recipients: ["Local mock only"], purpose: "Test review", storage: "Temporary process memory", websiteMode: "fixture", websiteLimits: { maxPages: 2, maxBytesPerPage: 2000, maxCharsPerPage: 1000, maxRedirects: 1, timeoutMs: 1000 } },
};
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
function mockClient(): VentureReviewClient {
  return { start: vi.fn(async () => structuredClone(initial)), get: vi.fn(), approve: vi.fn(async (_id, approval) => ({ approvalId: "33333333-3333-4333-8333-333333333333", requestId: initial.requestId, draftSha256: approval.draftSha256 })), submit: vi.fn(async () => ({ ...structuredClone(initial), phase: "complete" as const })), inspect: vi.fn(async () => ({ reviewId: initial.reviewId, requestId: initial.requestId, receipts: [], mockOnly: true as const })), decline: vi.fn(), cancel: vi.fn(async () => ({ ...structuredClone(initial), phase: "cancelled" as const })) };
}
async function mount(client: VentureReviewClient) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("crypto", webcrypto);
  const container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<SystemsBottleneckScanner reviewClient={client} />));
  return container;
}
async function field(container: HTMLElement, label: string, value: string) {
  const element = container.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function click(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label)!;
  expect(button).toBeTruthy();
  await act(async () => { button.click(); });
  if (label === "Preview exact packet locally") await act(async () => { await vi.waitFor(() => expect(container.querySelector("pre"), container.textContent ?? "").not.toBeNull()); });
}

describe("scanner local connected rehearsal", () => {
  it.each(["complete", "unavailable"])("recovers a lost submission response with its exact evidence when status is %s", async (firstStatus) => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:recovered"), revokeObjectURL: vi.fn() }));
    const client = mockClient();
    const completed: VentureReviewSnapshot = { ...structuredClone(initial), phase: "complete", result: ventureReviewResultSchema.parse(example.result) };
    vi.mocked(client.submit).mockRejectedValue(new Error("Response lost; no automatic retry"));
    if (firstStatus === "unavailable") vi.mocked(client.get).mockRejectedValueOnce(new Error("Status unavailable")).mockResolvedValueOnce({ ...initial, phase: "running" }).mockResolvedValueOnce(completed);
    else vi.mocked(client.get).mockResolvedValueOnce(completed);
    const container = await mount(client);
    await field(container, "Venture question", example.question); await click(container, "Start local rehearsal");
    await field(container, "Selected evidence JSON", JSON.stringify(example.draft)); await click(container, "Import packet locally");
    await click(container, "Preview exact packet locally"); await click(container, "Approve sharing and run mock review");
    if (firstStatus === "unavailable") {
      expect(container.textContent).not.toContain("Approve sharing and run mock review");
      expect(client.get).toHaveBeenCalledTimes(1);
      await click(container, "Check review status"); expect(container.textContent).toContain("Review state: running");
      await click(container, "Check review status");
    }
    expect(container.textContent).toContain("Check the approved sources behind these citations");
    await click(container, "Export this mock result locally");
    const exported = container.querySelector<HTMLTextAreaElement>('[aria-label="Copyable local export"]')!.value;
    expect(JSON.parse(exported.slice(exported.indexOf('{\n  "session"'))).approvedEvidence).toEqual(example.draft);
    expect(exported).toContain(example.draft.sources[1]!.excerpt);
    expect(exported).toContain("Product/Service Engine");
    expect(client.approve).toHaveBeenCalledTimes(1); expect(client.submit).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it("labels a fresh route without claiming a response before a result exists", async () => {
    const client = mockClient();
    vi.mocked(client.start).mockResolvedValue({ ...structuredClone(initial), mockOnly: false, execution: { mode: "fresh", provider: "openrouter/test", model: "test/reviewer" } });
    const container = await mount(client);
    await field(container, "Venture question", "Fictional question"); await click(container, "Start local rehearsal");
    expect(container.textContent).toContain("FRESH MODEL ROUTE — NO RESULT YET");
    expect(container.textContent).not.toContain("FRESH MODEL RESPONSE");
  });
  it("shows provider-mock mode/model before approval and binds them to the approved packet", async () => {
    const client = mockClient();
    const execution = { mode: "provider_mock" as const, provider: "openrouter/mock", model: "mock/sim-review-v1" };
    vi.mocked(client.start).mockResolvedValue({ ...structuredClone(initial), execution });
    const container = await mount(client);
    await field(container, "Venture question", "Fictional cross-engine question"); await click(container, "Start local rehearsal");
    expect(container.textContent).toContain("PROVIDER MOCK — NO MODEL CALLED");
    expect(container.textContent).toContain("mock/sim-review-v1");
    expect(container.textContent).toContain("Route and usage evidence are simulated");
    await field(container, "Founder note", "Fictional delivery and QA evidence");
    await click(container, "Preview exact packet locally"); await click(container, "Approve sharing and run mock review");
    expect(vi.mocked(client.approve).mock.calls[0]![1].execution).toEqual(execution);
  });
  it("exports a readable limited result with the exact approved evidence, then clears it on cancellation", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:local-review"), revokeObjectURL: vi.fn() }));
    const client = mockClient();
    vi.mocked(client.submit).mockResolvedValue({ ...structuredClone(initial), phase: "complete", result: ventureReviewResultSchema.parse(example.result) });
    const container = await mount(client);
    await field(container, "Venture question", example.question); await click(container, "Start local rehearsal");
    await field(container, "Selected evidence JSON", JSON.stringify(example.draft)); await click(container, "Import packet locally");
    await click(container, "Preview exact packet locally"); await click(container, "Approve sharing and run mock review");
    await click(container, "Export this mock result locally");
    const text = container.querySelector<HTMLTextAreaElement>('[aria-label="Copyable local export"]')!.value;
    expect(text).toContain("NOT A NEW AI ASSESSMENT"); expect(text).toContain("8 settled paying accounts");
    expect(text).toContain("APPROVED EVIDENCE"); expect(text).toContain(example.draft.sources[1]!.excerpt);
    expect(container.querySelector("a[download]")!.getAttribute("download")).toMatch(/\.txt$/);
    await click(container, "Cancel and clear server session");
    expect(container.querySelector('[aria-label="Copyable local export"]')).toBeNull();
    expect(container.textContent).not.toContain("8 settled paying accounts");
  });
  it("imports selected host excerpts locally, preserves omissions, and never treats import as consent", async () => {
    const client = mockClient(); const container = await mount(client);
    await field(container, "Venture question", "Review?"); await click(container, "Start local rehearsal");
    const draft = { sources: [{ id: "host-note", kind: "workspace_file", title: "Selected fictional excerpt", capturedAt: "2026-09-21T10:00:00.000Z", sourceDate: null, excerpt: "Only the permitted paragraph", omitted: ["Other paragraphs withheld"], basis: "checked_excerpt" }], collectionOmissions: ["No conversation access approved"] };
    await field(container, "Selected evidence JSON", JSON.stringify(draft)); await click(container, "Import packet locally");
    expect(client.approve).not.toHaveBeenCalled(); expect(client.submit).not.toHaveBeenCalled();
    await click(container, "Preview exact packet locally");
    expect(container.querySelector("pre")!.textContent).toContain("No conversation access approved");
    await field(container, "Selected evidence JSON", '{"sources": []}'); await click(container, "Import packet locally");
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("nothing was sent or replaced");
    expect(container.querySelector("pre")!.textContent).toContain("Only the permitted paragraph");
    await click(container, "Approve sharing and run mock review");
    expect(vi.mocked(client.submit).mock.calls[0]![2]).toEqual(draft);
  });

  it("invalidates the preview when inspection changes its omissions", async () => {
    const client = mockClient(); const container = await mount(client);
    await field(container, "Venture question", "Review?"); await click(container, "Start local rehearsal");
    await field(container, "Founder note", "Fictional note"); await click(container, "Preview exact packet locally");
    expect(container.querySelector("pre")).not.toBeNull();
    await field(container, "Approved page URLs", "https://example.com/"); await click(container, "Approve listed scope and inspect");
    expect(container.querySelector("pre")).toBeNull();
    expect(container.textContent).toContain("Website retrieval is simulated");
  });
  it.each(["submission", "status"])("keeps a cancelled review cancelled when a late %s resolves", async (response) => {
    const client = mockClient();
    let finish!: (value: VentureReviewSnapshot) => void;
    if (response === "submission") vi.mocked(client.submit).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    else {
      vi.mocked(client.submit).mockRejectedValue(new Error("Response lost"));
      vi.mocked(client.get).mockRejectedValueOnce(new Error("Unavailable")).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    }
    const container = await mount(client); await field(container, "Venture question", "Review?"); await click(container, "Start local rehearsal");
    await field(container, "Founder note", "Fictional note"); await click(container, "Preview exact packet locally"); await click(container, "Approve sharing and run mock review");
    if (response === "status") await click(container, "Check review status");
    await click(container, "Cancel and clear server session");
    await act(async () => { finish({ ...structuredClone(initial), phase: "complete" }); });
    expect(container.textContent).toContain("Review state: cancelled");
    expect(container.textContent).not.toContain("Review state: complete");
  });
  it("keeps note local until exact preview approval and invalidates approval after edits", async () => {
    const client = mockClient(); const container = await mount(client);
    expect(container.textContent).toContain("not an AI assessment");
    await field(container, "Venture question", "What should we test?"); await click(container, "Start local rehearsal");
    await field(container, "Founder note", "A private fictional note");
    expect(client.submit).not.toHaveBeenCalled(); expect(client.approve).not.toHaveBeenCalled();
    await click(container, "Preview exact packet locally");
    expect(container.querySelector("pre")!.textContent).toContain("A private fictional note");
    await field(container, "Founder note", "Redacted fictional note");
    expect(container.querySelector("pre")).toBeNull();
    await click(container, "Preview exact packet locally");
    await click(container, "Approve sharing and run mock review");
    const sent = vi.mocked(client.submit).mock.calls[0]![2];
    expect(sent.sources[0]!.excerpt).toBe("Redacted fictional note");
    expect(vi.mocked(client.approve).mock.calls[0]![1].draftSha256).toBe((await prepareVentureReviewPreview(sent)).draftSha256);
  });
  it("requires explicit inspection approval and reports inaccessible pages without implying success", async () => {
    const client = mockClient();
    vi.mocked(client.inspect).mockResolvedValue({ reviewId: initial.reviewId, requestId: initial.requestId, mockOnly: true, receipts: [{ sourceUrl: "https://example.com/", finalUrl: null, capturedAt: "2026-09-21T19:00:00.000Z", status: "inaccessible", httpStatus: 403, redirects: [], title: "", text: "", bodySha256: null, excerptSha256: null, excerptLocation: null, omissions: ["Access denied; no content read"], untrustedContent: true }] });
    const container = await mount(client); await field(container, "Venture question", "Review?"); await click(container, "Start local rehearsal");
    await field(container, "Approved page URLs", "https://example.com/"); expect(client.inspect).not.toHaveBeenCalled();
    await click(container, "Approve listed scope and inspect");
    expect(client.inspect).toHaveBeenCalledWith(initial.reviewId, initial.requestId, ["https://example.com/"]);
    expect(container.textContent).toContain("inaccessible"); expect(container.textContent).toContain("Access denied; no content read");
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Include this excerpt in preview")!.disabled).toBe(true);
  });
  it("preserves local evidence and shows honest failure without retry", async () => {
    const client = mockClient(); vi.mocked(client.submit).mockRejectedValue(new Error("Review unavailable; no automatic retry"));
    vi.mocked(client.get).mockResolvedValue({ ...structuredClone(initial), phase: "failed" });
    const container = await mount(client); await field(container, "Venture question", "Review?"); await click(container, "Start local rehearsal");
    await field(container, "Founder note", "Keep my fictional evidence"); await click(container, "Preview exact packet locally"); await click(container, "Approve sharing and run mock review");
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("no automatic retry");
    expect(container.querySelector("pre")!.textContent).toContain("Keep my fictional evidence");
    expect(container.textContent).toContain("Review state: failed");
    expect(client.submit).toHaveBeenCalledTimes(1);
  });
});
