import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, CheckCircle2, Clock3, Coins, ListFilter, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { modelRoutingApi, type ModelRouteDecisionAuditRow } from "../api/modelRouting";
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

  if (decisionsQuery.isLoading) {
    return <PageSkeleton />;
  }

  if (decisionsQuery.error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {decisionsQuery.error instanceof Error
            ? decisionsQuery.error.message
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
          Inspect why a model lane was chosen, what approval boundary applied, how the output was reviewed,
          and whether spend has been linked back to the route.
        </p>
      </div>

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
