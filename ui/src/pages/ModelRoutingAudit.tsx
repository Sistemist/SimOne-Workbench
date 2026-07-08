import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, CheckCircle2, Clock3, Coins, ShieldCheck, TriangleAlert } from "lucide-react";
import { modelRoutingApi, type ModelRouteDecisionAuditRow } from "../api/modelRouting";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";

const NO_COMPANY = "__none__";

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

function DecisionCard({ decision }: { decision: ModelRouteDecisionAuditRow }) {
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
          {decision.heartbeatRunId ? <span>Run linked</span> : <span>No run link yet</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelRoutingAudit() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const companyId = selectedCompanyId ?? NO_COMPANY;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Model routing" },
    ]);
  }, [setBreadcrumbs]);

  const decisionsQuery = useQuery({
    queryKey: queryKeys.modelRouteDecisions(companyId, 50),
    queryFn: () => modelRoutingApi.listDecisions(companyId, { limit: 50 }),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
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
          {decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} />
          ))}
        </div>
      )}
    </div>
  );
}
