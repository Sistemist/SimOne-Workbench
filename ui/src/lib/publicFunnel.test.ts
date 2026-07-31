// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scannerResultCategory, trackPublicFunnelEvent } from "./publicFunnel";

describe("public funnel measurement", () => {
  beforeEach(() => {
    localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/scanner?utm_source=cmu&utm_medium=outreach&utm_campaign=first-20");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts only privacy-safe attribution and never includes scanner answers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    trackPublicFunnelEvent("scanner_complete", { resultCategory: "customer" });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      eventName: "scanner_complete",
      path: "/scanner",
      source: "cmu",
      medium: "outreach",
      campaign: "first-20",
      resultCategory: "customer",
    });
    expect(JSON.stringify(body)).not.toMatch(/founderNote|startupUrl|answer/i);
  });

  it("keeps first-touch attribution after the Scanner-to-signup navigation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    trackPublicFunnelEvent("scanner_view");
    window.history.replaceState({}, "", "/auth?mode=sign_up&next=%2Fonboarding");
    trackPublicFunnelEvent("signup_complete");
    await Promise.resolve();

    const [, secondRequest] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(secondRequest.body))).toMatchObject({
      eventName: "signup_complete",
      path: "/auth",
      source: "cmu",
      medium: "outreach",
      campaign: "first-20",
    });
  });

  it("maps engine labels to stable public categories", () => {
    expect(scannerResultCategory("Product Engine")).toBe("product");
    expect(scannerResultCategory("Customer Engine")).toBe("customer");
    expect(scannerResultCategory("Cash Engine")).toBe("cash");
    expect(scannerResultCategory("Skills Engine")).toBe("skills");
  });

  it("marks explicit test traffic without changing normal attribution", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/scanner?utm_source=qa&sysdom_test=1");

    trackPublicFunnelEvent("scanner_view");
    await Promise.resolve();

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      eventName: "scanner_view",
      source: "qa",
      isTest: true,
    });
  });
});
