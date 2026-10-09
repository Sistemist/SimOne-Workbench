import { describe, expect, it } from "vitest";
import {
  JEV_AUTOMATIC_RETRIES,
  JEV_PINNED_MODEL,
  createFixtureJevTransport,
  recommendWithJevShadow,
} from "./jev-shadow-selector.js";

describe("recommendWithJevShadow", () => {
  it("passes only code-eligible options and stays advisory", async () => {
    const result = await recommendWithJevShadow({
      state: "A claim needs evidence checking.",
      question: "Which approved check is most relevant?",
      options: [
        { id: "claim-evidence-check", allowed: true },
        { id: "publish-claim", allowed: false, reason: "Founder approval required" },
      ],
      transport: createFixtureJevTransport({ "claim-evidence-check": 0.88, "publish-claim": 0.99 }),
      recheck: (optionId) => optionId === "claim-evidence-check",
    });
    expect(result).toEqual({
      model: "jev-1.13.0",
      optionId: "claim-evidence-check",
      probability: 0.88,
      confidence: "high",
      mode: "shadow",
    });
    expect(JEV_PINNED_MODEL).toBe("jev-1.13.0");
    expect(JEV_AUTOMATIC_RETRIES).toBe(0);
  });

  it("returns no recommendation when probability is weak", async () => {
    const result = await recommendWithJevShadow({
      state: "Sparse evidence.",
      question: "Which check?",
      options: [{ id: "request-evidence", allowed: true }],
      transport: createFixtureJevTransport({ "request-evidence": 0.51 }),
      recheck: () => true,
    });
    expect(result.optionId).toBeNull();
  });

  it("fails closed when the code recheck rejects the choice", async () => {
    const result = await recommendWithJevShadow({
      state: "Candidate runtime facts.",
      question: "Which runtime?",
      options: [{ id: "runtime-a", allowed: true }],
      transport: createFixtureJevTransport({ "runtime-a": 0.95 }),
      recheck: () => false,
    });
    expect(result.optionId).toBeNull();
  });
});
