import { describe, expect, it } from "vitest";
import { buildExecutionPolicy, withModelRouteSignals } from "./issue-execution-policy";

const routeSignals = {
  version: "sysdom_model_route_task_signals_v1" as const,
  taskClass: "analysis" as const,
  criticality: "high" as const,
  reversible: false,
  externalEffects: ["financial" as const],
  dataSensitivity: "confidential" as const,
  evidenceRequirement: "provenance_required" as const,
  latencyNeed: "interactive" as const,
  requiresTools: true,
  requiresStructuredOutput: true,
  approvalRequired: true,
};

describe("issue execution policy model-route signals", () => {
  it("creates and clears a signals-only policy", () => {
    const policy = withModelRouteSignals(null, routeSignals);
    expect(policy?.modelRouteSignals).toEqual(routeSignals);
    expect(withModelRouteSignals(policy, null)).toBeNull();
  });

  it("preserves explicit routing signals when reviewer stages change", () => {
    const policy = withModelRouteSignals(null, routeSignals);
    const next = buildExecutionPolicy({
      existingPolicy: policy,
      reviewerValues: ["user:founder"],
      approverValues: [],
    });

    expect(next?.modelRouteSignals).toEqual(routeSignals);
    expect(next?.stages[0]?.type).toBe("review");
  });
});
