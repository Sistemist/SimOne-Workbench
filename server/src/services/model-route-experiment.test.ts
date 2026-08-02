import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  modelRouteExperimentEvaluationInputSchema,
  type ModelRouteExperimentEvaluationInput,
} from "@paperclipai/shared";
import { evaluateModelRouteExperiment } from "./model-route-experiment.js";

const fixturePath = new URL(
  "../../../evals/fixtures/sysdom-experiment-lanes.v1.json",
  import.meta.url,
);
const fixture = modelRouteExperimentEvaluationInputSchema.parse(
  JSON.parse(await readFile(fixturePath, "utf8")),
);
const resultPath = new URL(
  "../../../evals/results/sysdom-experiment-lanes-2026-08-02.json",
  import.meta.url,
);
const recordedResult = JSON.parse(await readFile(resultPath, "utf8")) as unknown;

function cloneFixture(): ModelRouteExperimentEvaluationInput {
  return structuredClone(fixture);
}

function recordedFixture(): ModelRouteExperimentEvaluationInput {
  const input = cloneFixture();
  input.evidenceClass = "recorded_run";
  const routeDecisionIds = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
  ];
  const heartbeatRunIds = [
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
    "77777777-7777-4777-8777-777777777777",
    "88888888-8888-4888-8888-888888888888",
  ];
  input.outcomes.forEach((outcome, index) => {
    outcome.routeDecisionId = routeDecisionIds[index]!;
    outcome.heartbeatRunId = heartbeatRunIds[index]!;
    outcome.observed.providerRequestMade = true;
    outcome.observed.billingType = "metered_api";
    outcome.observed.costUsd = index < 2
      ? index === 0 ? 0.1 : 0.2
      : index === 2 ? 0.2 : 0.25;
  });
  return input;
}

describe("Sysdom Experiment Lane evaluator", () => {
  it("proves both synthetic comparison workflows without nominating or activating", () => {
    const evaluation = evaluateModelRouteExperiment(fixture);

    expect(evaluation).toEqual(recordedResult);
    expect(evaluation).toMatchObject({
      version: "sysdom_model_route_experiment_evaluation_v1",
      suiteVersion: "sysdom_model_route_experiments_v1",
      evidenceClass: "synthetic_fixture",
      status: "passed",
      reviewRequired: true,
      eligibleForAdoption: false,
      activationAttempted: false,
      providerDispatchAttempted: false,
      aggregate: {
        comparisonCount: 2,
        blockedCount: 0,
        simulationPassCount: 2,
        challengerNominationCount: 0,
      },
      blockers: [],
    });
    expect(evaluation.comparisons.map((comparison) => comparison.challengerLane).sort())
      .toEqual(["deliberation_audit", "external_specialist"]);
    expect(evaluation.comparisons.every(
      (comparison) => comparison.decision === "simulation_passed",
    )).toBe(true);
  });

  it("fails closed when control and challenger do not share the fixture task hash", () => {
    const input = cloneFixture();
    input.outcomes[1]!.taskSha256 = "0".repeat(64);

    const evaluation = evaluateModelRouteExperiment(input);

    expect(evaluation.status).toBe("blocked");
    expect(evaluation.comparisons[0]).toMatchObject({
      decision: "blocked",
      status: "blocked",
      blockers: expect.arrayContaining(["task_hash_mismatch"]),
    });
  });

  it("fails closed on missing recorded cost telemetry", () => {
    const input = recordedFixture();
    input.outcomes[1]!.observed.costUsd = null;

    const evaluation = evaluateModelRouteExperiment(input);

    expect(evaluation.status).toBe("blocked");
    expect(evaluation.blockers).toContain(
      "deliberation-conflicting-traction-claim:experiment_challenger:telemetry_missing:cost_usd",
    );
    expect(evaluation.aggregate.challengerNominationCount).toBe(0);
    expect(evaluation.comparisons[1]?.decision).toBe("sovereign_control_retained");
    expect(evaluation.eligibleForAdoption).toBe(false);
  });

  it("blocks unsafe challenger actions", () => {
    const input = cloneFixture();
    input.outcomes[3]!.output.proposedActions = ["Deploy the selected approach."];

    const evaluation = evaluateModelRouteExperiment(input);

    expect(evaluation.status).toBe("blocked");
    expect(evaluation.blockers).toContain(
      "specialist-context-projector-plan:experiment_challenger:forbidden_action:deploy",
    );
  });

  it("can nominate complete recorded challengers for review but never for adoption", () => {
    const evaluation = evaluateModelRouteExperiment(recordedFixture());

    expect(evaluation).toMatchObject({
      evidenceClass: "recorded_run",
      status: "passed",
      eligibleForAdoption: false,
      activationAttempted: false,
      providerDispatchAttempted: false,
      aggregate: {
        challengerNominationCount: 2,
      },
    });
    expect(evaluation.comparisons.every(
      (comparison) => comparison.decision === "challenger_nominated_for_review",
    )).toBe(true);
  });

  it("rejects synthetic outcomes that claim a provider or run execution", () => {
    const input = cloneFixture();
    input.outcomes[0]!.observed.providerRequestMade = true;

    expect(() => modelRouteExperimentEvaluationInputSchema.parse(input)).toThrow(
      "Synthetic experiment outcomes cannot claim provider or run execution",
    );
  });
});
