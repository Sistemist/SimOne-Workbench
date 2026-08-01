import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, CheckCircle2, Clock3, Coins, ListFilter, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { modelRoutingApi, type ModelRouteDecisionAuditRow } from "../api/modelRouting";
import { ModelExecutionPolicyEditor } from "../components/model-routing/ModelExecutionPolicyEditor";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";

const NO_COMPANY = "__none__";
const DECISION_LIMIT = 50;
type ReviewStatus = "approved" | "needs_revision" | "rejected";
type ReviewFilter = "all" | "pending" | ReviewStatus;
type ExecutionSafetyStatus = "ready" | "blocked" | "unverified";
type ExecutionReconciliationStatus = "reconciled" | "blocked" | "unverified";

interface ExecutionSafetyEvidence {
  status: ExecutionSafetyStatus;
  billingType: string;
  blockers: string[];
  controls: {
    timeoutSec: number | null;
    maxTurnsPerRun: number | null;
    maxRuns: number | null;
    maxRetries: number | null;
    concurrency: number | null;
    maxRunCostCents: number | null;
    providerHardCapCents: number | null;
  };
}

interface ExecutionReconciliationEvidence {
  status: ExecutionReconciliationStatus;
  terminalOutcome: string;
  blockers: string[];
  expected: {
    provider: string;
    model: string;
    billingType: string;
    maxRunCostCents: number | null;
  };
  actual: {
    provider: string | null;
    model: string | null;
    billingType: string;
    costKnown: boolean;
    costCents: number | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
}

interface RouteRecommendationEvidence {
  status: "ready" | "no_model" | "blocked";
  policyVersion: string;
  posture: string;
  lane: string;
  riskLevel: string;
  reason: string;
  selectedCandidate: {
    provider: string;
    model: string;
  } | null;
}

const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "needs_revision", label: "Needs revision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function humanize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replaceAll("_", " ");
}

function titleCase(value: string) {
  const label = humanize(value);
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;
}

function reviewTone(status: string) {
  if (status === "approved") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "needs_revision") return "bg-amber-500/10 text-amber-700 border-amber-500/30";
  if (status === "rejected") return "bg-destructive/10 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
}

function CostEvidence({ decision }: { decision: ModelRouteDecisionAuditRow }) {
  const noun = decision.costEventCount === 1 ? "cost event" : "cost events";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Coins className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium text-foreground">
        {decision.costEventCount} {noun}
      </span>
      <span className="text-muted-foreground">{formatCents(decision.costCents)}</span>
    </div>
  );
}

function routeDecisionOutputArtifacts(decision: ModelRouteDecisionAuditRow) {
  const raw = decision.metadata?.outputArtifacts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is { id: string; title: string; href: string } => {
    if (!item || typeof item !== "object") return false;
    const artifact = item as Record<string, unknown>;
    return (
      typeof artifact.id === "string" &&
      typeof artifact.title === "string" &&
      artifact.title.trim().length > 0 &&
      typeof artifact.href === "string" &&
      (artifact.href === "/artifacts" || artifact.href.startsWith("/artifacts?") || artifact.href.startsWith("/artifacts#"))
    );
  });
}

function routeContextProjectionEvidence(decision: ModelRouteDecisionAuditRow) {
  const metadata = decision.metadata ?? {};
  const id = typeof metadata.contextProjectionId === "string" ? metadata.contextProjectionId : null;
  const version =
    typeof metadata.contextProjectionVersion === "number" ? metadata.contextProjectionVersion : null;
  if (!id || version === null) return null;
  return {
    id,
    version,
    constitutionRevisionId:
      typeof metadata.constitutionRevisionId === "string" ? metadata.constitutionRevisionId : null,
    ventureStateRevisionId:
      typeof metadata.ventureStateRevisionId === "string" ? metadata.ventureStateRevisionId : null,
  };
}

function routeLaneEvidence(decision: ModelRouteDecisionAuditRow): { title: string; body: string } | null {
  if (decision.lane === "deliberation_audit") {
    return {
      title: "Deliberation audit evidence",
      body: "Prompt, disagreement, blind spots, synthesis, and approval gate should be captured for this high-risk review.",
    };
  }
  if (decision.lane === "external_specialist") {
    return {
      title: "External specialist review",
      body: "Task boundary, returned result, evaluation, fallback, and human review must be inspectable before this output becomes trusted.",
    };
  }
  return null;
}

function routeRecommendationEvidence(
  decision: ModelRouteDecisionAuditRow,
): RouteRecommendationEvidence | null {
  const raw = decision.metadata?.routeRecommendation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const evidence = raw as Record<string, unknown>;
  if (evidence.version !== "sysdom_model_route_recommendation_v1") return null;
  if (!["ready", "no_model", "blocked"].includes(String(evidence.status))) return null;
  const rawCandidate =
    evidence.selectedCandidate
    && typeof evidence.selectedCandidate === "object"
    && !Array.isArray(evidence.selectedCandidate)
      ? evidence.selectedCandidate as Record<string, unknown>
      : null;
  const selectedCandidate =
    rawCandidate
    && typeof rawCandidate.provider === "string"
    && typeof rawCandidate.model === "string"
      ? {
          provider: rawCandidate.provider,
          model: rawCandidate.model,
        }
      : null;
  return {
    status: evidence.status as RouteRecommendationEvidence["status"],
    policyVersion: typeof evidence.policyVersion === "string" ? evidence.policyVersion : "unknown",
    posture: typeof evidence.posture === "string" ? evidence.posture : "balanced",
    lane: typeof evidence.lane === "string" ? evidence.lane : "unknown",
    riskLevel: typeof evidence.riskLevel === "string" ? evidence.riskLevel : "unknown",
    reason: typeof evidence.reason === "string"
      ? evidence.reason
      : "No recommendation reason was recorded.",
    selectedCandidate,
  };
}

function RouteRecommendationCard({
  evidence,
}: {
  evidence: RouteRecommendationEvidence;
}) {
  const recommendation =
    evidence.status === "no_model"
      ? "Use deterministic code or rules; no model call."
      : evidence.selectedCandidate
        ? `${evidence.selectedCandidate.provider} / ${evidence.selectedCandidate.model}`
        : "No permitted exact model is currently available.";
  return (
    <section
      aria-label="Sysdom Auto shadow recommendation"
      className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sysdom Auto shadow recommendation
        </div>
        <Badge variant="outline">{humanize(evidence.status)}</Badge>
        <Badge variant="outline">{titleCase(evidence.lane)}</Badge>
        <Badge variant="outline">{humanize(evidence.riskLevel)} risk</Badge>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{recommendation}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{evidence.reason}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Shadow mode only—this recommendation did not change execution. Policy {evidence.policyVersion}; posture {humanize(evidence.posture)}.
      </p>
    </section>
  );
}

function routeExecutionSafety(
  decision: ModelRouteDecisionAuditRow,
): ExecutionSafetyEvidence | null {
  const raw = decision.metadata?.executionSafety;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const evidence = raw as Record<string, unknown>;
  if (evidence.version !== "sysdom_model_execution_safety_v1") return null;
  if (!["ready", "blocked", "unverified"].includes(String(evidence.status))) return null;
  const rawControls =
    evidence.controls && typeof evidence.controls === "object" && !Array.isArray(evidence.controls)
      ? evidence.controls as Record<string, unknown>
      : {};
  const numberOrNull = (value: unknown) => typeof value === "number" ? value : null;
  return {
    status: evidence.status as ExecutionSafetyStatus,
    billingType: typeof evidence.billingType === "string" ? evidence.billingType : "unknown",
    blockers: Array.isArray(evidence.blockers)
      ? evidence.blockers.filter((value): value is string => typeof value === "string")
      : [],
    controls: {
      timeoutSec: numberOrNull(rawControls.timeoutSec),
      maxTurnsPerRun: numberOrNull(rawControls.maxTurnsPerRun),
      maxRuns: numberOrNull(rawControls.maxRuns),
      maxRetries: numberOrNull(rawControls.maxRetries),
      concurrency: numberOrNull(rawControls.concurrency),
      maxRunCostCents: numberOrNull(rawControls.maxRunCostCents),
      providerHardCapCents: numberOrNull(rawControls.providerHardCapCents),
    },
  };
}

function executionSafetyTone(status: ExecutionSafetyStatus) {
  if (status === "ready") return "border-emerald-500/30 bg-emerald-500/5";
  if (status === "blocked") return "border-destructive/30 bg-destructive/5";
  return "border-amber-500/30 bg-amber-500/5";
}

function routeExecutionReconciliation(
  decision: ModelRouteDecisionAuditRow,
): ExecutionReconciliationEvidence | null {
  const raw = decision.metadata?.executionReconciliation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const evidence = raw as Record<string, unknown>;
  if (evidence.version !== "sysdom_model_execution_reconciliation_v1") return null;
  if (![ "reconciled", "blocked", "unverified" ].includes(String(evidence.status))) return null;
  const expected =
    evidence.expected && typeof evidence.expected === "object" && !Array.isArray(evidence.expected)
      ? evidence.expected as Record<string, unknown>
      : {};
  const actual =
    evidence.actual && typeof evidence.actual === "object" && !Array.isArray(evidence.actual)
      ? evidence.actual as Record<string, unknown>
      : {};
  const numberOrZero = (value: unknown) => typeof value === "number" ? value : 0;
  const numberOrNull = (value: unknown) => typeof value === "number" ? value : null;
  const stringOrNull = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;
  return {
    status: evidence.status as ExecutionReconciliationStatus,
    terminalOutcome: typeof evidence.terminalOutcome === "string" ? evidence.terminalOutcome : "unknown",
    blockers: Array.isArray(evidence.blockers)
      ? evidence.blockers.filter((value): value is string => typeof value === "string")
      : [],
    expected: {
      provider: typeof expected.provider === "string" ? expected.provider : "unknown",
      model: typeof expected.model === "string" ? expected.model : "unknown",
      billingType: typeof expected.billingType === "string" ? expected.billingType : "unknown",
      maxRunCostCents: numberOrNull(expected.maxRunCostCents),
    },
    actual: {
      provider: stringOrNull(actual.provider),
      model: stringOrNull(actual.model),
      billingType: typeof actual.billingType === "string" ? actual.billingType : "unknown",
      costKnown: actual.costKnown === true,
      costCents: numberOrNull(actual.costCents),
      inputTokens: numberOrZero(actual.inputTokens),
      cachedInputTokens: numberOrZero(actual.cachedInputTokens),
      outputTokens: numberOrZero(actual.outputTokens),
    },
  };
}

function ExecutionReconciliationCard({
  evidence,
}: {
  evidence: ExecutionReconciliationEvidence;
}) {
  const actualRoute = `${evidence.actual.provider ?? "missing provider"} / ${evidence.actual.model ?? "missing model"}`;
  const expectedRoute = `${evidence.expected.provider} / ${evidence.expected.model}`;
  const tokenTotal =
    evidence.actual.inputTokens +
    evidence.actual.cachedInputTokens +
    evidence.actual.outputTokens;
  return (
    <div className={`rounded-md border px-3 py-3 ${executionSafetyTone(evidence.status === "reconciled" ? "ready" : evidence.status)}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {evidence.status === "blocked"
          ? <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
          : <CheckCircle2 className="h-3.5 w-3.5" />}
        Actual usage reconciliation: {evidence.status}
      </div>
      <p className="mt-1 text-sm leading-6">
        {evidence.status === "reconciled"
          ? `The ${humanize(evidence.terminalOutcome)} run reported the authorized route and billing evidence.`
          : evidence.status === "blocked"
            ? "Actual provider, model, billing, or spend evidence did not match the authorization. Further automatic execution remains stopped until board review clears this decision."
            : "This legacy run did not have an enforceable pre-dispatch policy, so its usage cannot be claimed as reconciled."}
      </p>
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
        <p>Authorized: {expectedRoute} · {humanize(evidence.expected.billingType)}</p>
        <p>Reported: {actualRoute} · {humanize(evidence.actual.billingType)}</p>
        <p>
          Cost: {evidence.actual.costKnown && evidence.actual.costCents !== null
            ? formatCents(evidence.actual.costCents)
            : "unknown"}
          {evidence.expected.maxRunCostCents !== null
            ? ` / ${formatCents(evidence.expected.maxRunCostCents)} allowance`
            : ""}
        </p>
        <p>Tokens reported: {tokenTotal.toLocaleString()}</p>
      </div>
      {evidence.blockers.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {evidence.blockers.map(titleCase).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function ExecutionSafetyEvidenceCard({
  evidence,
}: {
  evidence: ExecutionSafetyEvidence;
}) {
  const controls = evidence.controls;
  const readySummary = [
    controls.timeoutSec ? `${controls.timeoutSec}s timeout` : null,
    controls.maxTurnsPerRun ? `${controls.maxTurnsPerRun} turns` : null,
    controls.maxRuns !== null ? `${controls.maxRuns} run` : null,
    controls.maxRetries !== null ? `${controls.maxRetries} retries` : null,
    controls.concurrency !== null ? `${controls.concurrency} concurrent` : null,
    controls.maxRunCostCents !== null ? `${formatCents(controls.maxRunCostCents)} declared run allowance` : null,
    controls.providerHardCapCents !== null ? `${formatCents(controls.providerHardCapCents)} provider hard cap` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className={`rounded-md border px-3 py-3 ${executionSafetyTone(evidence.status)}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {evidence.status === "blocked"
          ? <TriangleAlert className="h-3.5 w-3.5 text-destructive" />
          : <ShieldCheck className="h-3.5 w-3.5" />}
        Execution safety: {evidence.status}
      </div>
      <p className="mt-1 text-sm leading-6">
        {evidence.status === "ready"
          ? `${titleCase(evidence.billingType)} route has pinned selection, bounded runtime, and recorded external-cap evidence before provider execution.`
          : evidence.status === "blocked"
            ? "The provider invocation was blocked before execution because required controls were missing or inconsistent."
            : "No enforceable execution-safety policy was attached. This audit row does not prove the route was safe to run."}
      </p>
      {evidence.status === "ready" && readySummary.length > 0 ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{readySummary.join(" · ")}</p>
      ) : null}
      {evidence.status !== "ready" && evidence.blockers.length > 0 ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {evidence.blockers.map(titleCase).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function DecisionCard({
  decision,
  isReviewing,
  reviewError,
  onReview,
}: {
  decision: ModelRouteDecisionAuditRow;
  isReviewing: boolean;
  reviewError: string | null;
  onReview: (decision: ModelRouteDecisionAuditRow, reviewStatus: ReviewStatus, reviewNote: string) => void;
}) {
  const [reviewNote, setReviewNote] = useState(decision.reviewNote ?? "");
  const modelLabel = `${decision.provider} / ${decision.model}`;
  const outputArtifacts = routeDecisionOutputArtifacts(decision);
  const laneEvidence = routeLaneEvidence(decision);
  const routeRecommendation = routeRecommendationEvidence(decision);
  const executionSafety = routeExecutionSafety(decision);
  const executionReconciliation = routeExecutionReconciliation(decision);
  const contextProjection = routeContextProjectionEvidence(decision);

  return (
    <Card>
      <CardHeader className="space-y-3 px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{titleCase(decision.lane)}</Badge>
          <Badge variant="outline">{humanize(decision.riskLevel)} risk</Badge>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${reviewTone(decision.reviewStatus)}`}>
            {humanize(decision.reviewStatus)}
          </span>
        </div>
        <div className="min-w-0">
          <CardTitle className="text-base">{decision.provider} / {decision.model}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{decision.reason}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5" />
              Intent
            </div>
            <p className="mt-1 text-sm">{decision.taskIntent ?? "No task intent recorded."}</p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Approval
            </div>
            <p className="mt-1 text-sm">{humanize(decision.approvalGate)}</p>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              Cost evidence
            </div>
            <div className="mt-1">
              <CostEvidence decision={decision} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Context supplied</div>
            <p className="mt-1 text-sm leading-6">{decision.contextSummary ?? "No context summary recorded."}</p>
          </div>
          <div className="rounded-md border border-border px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output review</div>
            <p className="mt-1 text-sm leading-6">{decision.outputSummary ?? "No output summary recorded yet."}</p>
            {outputArtifacts.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {outputArtifacts.map((artifact) => (
                  <Link
                    key={artifact.id}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                    to={artifact.href}
                  >
                    {artifact.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">No output artifact linked yet.</p>
            )}
            {decision.reviewNote ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{decision.reviewNote}</p>
            ) : null}
          </div>
        </div>

        {laneEvidence ? (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {laneEvidence.title}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{laneEvidence.body}</p>
          </div>
        ) : null}

        {contextProjection ? (
          <section
            aria-label="Venture context projection evidence"
            className="rounded-md border border-primary/30 bg-primary/5 px-3 py-3"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Founder-approved venture context
            </div>
            <p className="mt-1 text-sm leading-6">
              Context Projection v{contextProjection.version} was pinned to this delegated run.
            </p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">Projection receipt</summary>
              <dl className="mt-2 grid gap-1 font-mono">
                <div><dt className="inline">projection </dt><dd className="inline">{contextProjection.id}</dd></div>
                <div><dt className="inline">constitution </dt><dd className="inline">{contextProjection.constitutionRevisionId ?? "not recorded"}</dd></div>
                <div><dt className="inline">venture state </dt><dd className="inline">{contextProjection.ventureStateRevisionId ?? "not recorded"}</dd></div>
              </dl>
            </details>
          </section>
        ) : null}

        {routeRecommendation ? (
          <RouteRecommendationCard evidence={routeRecommendation} />
        ) : null}
        {executionSafety ? (
          <ExecutionSafetyEvidenceCard evidence={executionSafety} />
        ) : null}
        {executionReconciliation ? (
          <ExecutionReconciliationCard evidence={executionReconciliation} />
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(decision.createdAt).toLocaleString()}
          </span>
          <span>Confidence: {humanize(decision.outputConfidence)}</span>
          {decision.heartbeatRunId ? (
            <Link
              className="font-medium text-foreground underline-offset-4 hover:underline"
              to={`/agents/${decision.agentId}/runs/${decision.heartbeatRunId}`}
            >
              Run linked
            </Link>
          ) : <span>No run link yet</span>}
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
          <label
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            htmlFor={`model-route-review-${decision.id}`}
          >
            Review note
          </label>
          <Textarea
            id={`model-route-review-${decision.id}`}
            aria-label={`Review note for ${modelLabel}`}
            className="mt-2 min-h-20 resize-y bg-background text-sm"
            placeholder="Add what changed, what passed review, or why this needs another pass."
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            disabled={isReviewing}
          />
          {reviewError ? (
            <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{reviewError}</span>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onReview(decision, "approved", reviewNote)}
              disabled={isReviewing}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onReview(decision, "needs_revision", reviewNote)}
              disabled={isReviewing}
            >
              Needs revision
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onReview(decision, "rejected", reviewNote)}
              disabled={isReviewing}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelRoutingAudit() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const companyId = selectedCompanyId ?? NO_COMPANY;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Model routing" },
    ]);
  }, [setBreadcrumbs]);

  const decisionsQuery = useQuery({
    queryKey: queryKeys.modelRouteDecisions(companyId, DECISION_LIMIT),
    queryFn: () => modelRoutingApi.listDecisions(companyId, { limit: DECISION_LIMIT }),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const policiesQuery = useQuery({
    queryKey: queryKeys.modelExecutionPolicies(companyId),
    queryFn: () => modelRoutingApi.listPolicies(companyId),
    enabled: !!selectedCompanyId,
  });

  const policyMutation = useMutation({
    mutationFn: ({
      agentId,
      input,
    }: {
      agentId: string;
      input: Parameters<typeof modelRoutingApi.updatePolicy>[2];
    }) => modelRoutingApi.updatePolicy(companyId, agentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.modelExecutionPolicies(companyId),
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      decision,
      reviewStatus,
      reviewNote,
    }: {
      decision: ModelRouteDecisionAuditRow;
      reviewStatus: ReviewStatus;
      reviewNote: string;
    }) => modelRoutingApi.updateReview(companyId, decision.id, {
      outputSummary: decision.outputSummary,
      outputConfidence: decision.outputConfidence,
      reviewStatus,
      reviewNote: reviewNote.trim() || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.modelRouteDecisions(companyId, DECISION_LIMIT),
      });
    },
  });

  if (!selectedCompanyId) {
    return <div className="text-sm text-muted-foreground">Select a company to inspect model routing.</div>;
  }

  if (decisionsQuery.isLoading || policiesQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (decisionsQuery.error || policiesQuery.error) {
    const loadError = decisionsQuery.error ?? policiesQuery.error;
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {loadError instanceof Error
            ? loadError.message
            : "Failed to load model routing decisions."}
        </span>
      </div>
    );
  }

  const decisions = decisionsQuery.data?.items ?? [];
  const reviewCounts = decisions.reduce<Record<ReviewFilter, number>>((counts, decision) => {
    counts.all += 1;
    if (decision.reviewStatus === "pending") counts.pending += 1;
    if (decision.reviewStatus === "needs_revision") counts.needs_revision += 1;
    if (decision.reviewStatus === "approved") counts.approved += 1;
    if (decision.reviewStatus === "rejected") counts.rejected += 1;
    return counts;
  }, {
    all: 0,
    pending: 0,
    needs_revision: 0,
    approved: 0,
    rejected: 0,
  });
  const filteredDecisions = reviewFilter === "all"
    ? decisions
    : decisions.filter((decision) => decision.reviewStatus === reviewFilter);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Model routing audit</h1>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure a governed route before execution, then inspect why a model lane was chosen, what approval
          boundary applied, how the output was reviewed, and whether spend reconciled back to the route.
        </p>
      </div>

      <ModelExecutionPolicyEditor
        policies={policiesQuery.data?.items ?? []}
        isSaving={policyMutation.isPending}
        saveError={
          policyMutation.isError
            ? policyMutation.error instanceof Error
              ? policyMutation.error.message
              : "Failed to save execution policy."
            : null
        }
        savedPolicy={policyMutation.data ?? null}
        onSave={(agentId, input) => policyMutation.mutate({ agentId, input })}
      />

      {decisions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          message="No route decisions have been recorded yet."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="mr-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ListFilter className="h-3.5 w-3.5" />
              Review
            </div>
            {REVIEW_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="xs"
                variant={reviewFilter === filter.value ? "secondary" : "ghost"}
                onClick={() => setReviewFilter(filter.value)}
              >
                {filter.label}
                <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {reviewCounts[filter.value]}
                </span>
              </Button>
            ))}
          </div>

          {filteredDecisions.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              message={`No ${humanize(reviewFilter)} route decisions in this view.`}
            />
          ) : null}

          {filteredDecisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              isReviewing={reviewMutation.isPending && reviewMutation.variables?.decision.id === decision.id}
              reviewError={
                reviewMutation.isError && reviewMutation.variables?.decision.id === decision.id
                  ? reviewMutation.error instanceof Error
                    ? reviewMutation.error.message
                    : "Failed to update review."
                  : null
              }
              onReview={(targetDecision, reviewStatus, reviewNote) => reviewMutation.mutate({
                decision: targetDecision,
                reviewStatus,
                reviewNote,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
