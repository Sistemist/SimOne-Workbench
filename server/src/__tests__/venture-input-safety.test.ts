import { describe, expect, it } from "vitest";
import { assertNoSecretBearingVentureInput } from "../services/venture-input-safety.js";

describe("canonical venture input safety", () => {
  it("accepts normal founder state and provenance metadata", () => {
    expect(() =>
      assertNoSecretBearingVentureInput({
        ventureSummary: "A founder is validating one bounded customer loop.",
        evidence: [
          {
            kind: "founder_note",
            label: "Controlled founder session",
            url: "https://example.com/evidence/session-1?view=summary",
          },
        ],
      }),
    ).not.toThrow();
  });

  it.each([
    ["OpenAI-style key", "sk-abcdefghijklmnopqrstuvwxyz123456"],
    ["bearer token", "Authorization: Bearer founder-secret-value"],
    ["JWT", "abcdefgh.ijklmnop.qrstuvwx"],
    ["credential assignment", "api_key=founder-secret-value"],
    ["basic-auth URL", "https://founder:private-password@example.com/evidence"],
    ["secret query URL", "https://example.com/evidence?access_token=founder-secret-value"],
  ])("rejects a nested %s without echoing it", (_label, secret) => {
    let caught: Error | null = null;
    try {
      assertNoSecretBearingVentureInput({
        content: {
          engines: {
            customer: {
              evidence: [{ label: secret }],
            },
          },
        },
      });
    } catch (error) {
      caught = error as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught?.message).toContain("$.content.engines.customer.evidence[0].label");
    expect(caught?.message).toContain("scoped secret store");
    expect(caught?.message).not.toContain(secret);
  });
});
