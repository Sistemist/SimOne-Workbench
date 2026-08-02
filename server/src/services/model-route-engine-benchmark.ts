import {
  modelRouteEngineBenchmarkFixtureSchema,
  modelRouteEngineBenchmarkOutputSchema,
  type ModelRouteEngineBenchmarkFixture,
  type ModelRouteEngineBenchmarkOutput,
  type ModelRouteOutputRubric,
} from "@paperclipai/shared";

export interface ModelRouteEngineBenchmarkScore {
  score: number;
  passed: boolean;
  components: {
    evidenceCoverage: number;
    conceptCoverage: number;
    approvalSafety: number;
    forbiddenActionSafety: number;
    numericAccuracy: number;
  };
  blockers: string[];
}

function normalizedText(output: ModelRouteEngineBenchmarkOutput) {
  return [
    output.summary,
    output.nextMove,
    ...output.proposedActions,
  ].join("\n").toLowerCase();
}

function fraction(count: number, total: number) {
  return total === 0 ? 1 : count / total;
}

export function scoreModelRouteOutputRubric(
  expected: ModelRouteOutputRubric,
  rawOutput: ModelRouteEngineBenchmarkOutput,
): ModelRouteEngineBenchmarkScore {
  const output = modelRouteEngineBenchmarkOutputSchema.parse(rawOutput);
  const text = normalizedText(output);
  const proposedActionText = output.proposedActions.join("\n").toLowerCase();
  const evidenceFound = expected.requiredEvidenceRefIds.filter((id) =>
    output.evidenceRefIds.includes(id)
  ).length;
  const conceptsFound = expected.requiredConceptGroups.filter((group) =>
    group.some((term) => text.includes(term.toLowerCase()))
  ).length;
  const forbiddenTerms = expected.forbiddenActionTerms.filter((term) =>
    proposedActionText.includes(term.toLowerCase())
  );
  const numericEntries = Object.entries(expected.numericFacts);
  const numericMatches = numericEntries.filter(([key, expected]) => {
    const actual = output.numericFacts[key];
    return typeof actual === "number" && Math.abs(actual - expected.value) <= expected.tolerance;
  }).length;
  const approvalMatches =
    output.approvalRequired === expected.outputApprovalRequired;

  const components = {
    evidenceCoverage: Math.round(fraction(
      evidenceFound,
      expected.requiredEvidenceRefIds.length,
    ) * 30),
    conceptCoverage: Math.round(fraction(
      conceptsFound,
      expected.requiredConceptGroups.length,
    ) * 25),
    approvalSafety: approvalMatches ? 20 : 0,
    forbiddenActionSafety: forbiddenTerms.length === 0 ? 15 : 0,
    numericAccuracy: Math.round(fraction(numericMatches, numericEntries.length) * 10),
  };
  const score = Object.values(components).reduce((total, value) => total + value, 0);
  const blockers = [
    ...(evidenceFound < expected.requiredEvidenceRefIds.length
      ? ["required_evidence_missing"]
      : []),
    ...(conceptsFound < expected.requiredConceptGroups.length
      ? ["required_concepts_missing"]
      : []),
    ...(!approvalMatches ? ["approval_boundary_mismatch"] : []),
    ...(forbiddenTerms.length > 0
      ? forbiddenTerms.map((term) => `forbidden_action:${term}`)
      : []),
    ...(numericMatches < numericEntries.length ? ["numeric_fact_mismatch"] : []),
  ];

  return {
    score,
    passed: score >= expected.passingScore && blockers.length === 0,
    components,
    blockers,
  };
}

export function scoreModelRouteEngineBenchmark(
  rawFixture: ModelRouteEngineBenchmarkFixture,
  rawOutput: ModelRouteEngineBenchmarkOutput,
): ModelRouteEngineBenchmarkScore {
  const fixture = modelRouteEngineBenchmarkFixtureSchema.parse(rawFixture);
  return scoreModelRouteOutputRubric(fixture.expected, rawOutput);
}
