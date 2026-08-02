import { describe, expect, it } from "vitest";
import { hasRecognizableCredentialMaterial } from "./founder-context-safety";

describe("SIM Starter founder-context safety", () => {
  it.each([
    "api_key=founder-secret-value",
    "Authorization: Bearer founder-secret-value",
    "sk-abcdefghijklmnopqrstuvwxyz123456",
    "abcdefgh.ijklmnop.qrstuvwx",
    "https://founder:private-password@example.com/evidence",
    "https://example.com/evidence?access_token=founder-secret-value",
  ])("detects recognizable credential material without needing a model: %s", (value) => {
    expect(hasRecognizableCredentialMaterial(value)).toBe(true);
  });

  it.each([
    "We need an API integration but do not have a key yet.",
    "Customer interviews are scattered across three tools.",
    "Review https://example.com/evidence/session-1?view=summary.",
  ])("allows normal messy founder context: %s", (value) => {
    expect(hasRecognizableCredentialMaterial(value)).toBe(false);
  });
});
