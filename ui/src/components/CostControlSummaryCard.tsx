import type { CostControlSummary } from "@paperclipai/shared";
import { AlertTriangle, CheckCircle2, CircleOff, Route } from "lucide-react";
import { cn, formatCents, formatTokens } from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusPresentation(status: CostControlSummary["status"]) {
  switch (status) {
    case "needs_reconciliation":
      return {
        label: "Reconcile before paid runs",
        icon: AlertTriangle,
        className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "clear":
      return {
        label: "Recorded usage reconciled",
        icon: CheckCircle2,
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "no_usage":
      return {
        label: "No usage recorded",
        icon: CircleOff,
        className: "border-border bg-muted/40 text-muted-foreground",
      };
  }
}

function ControlMetric({
  label,
  value,
  detail,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className={cn("border border-border p-3", warning && "border-amber-500/40 bg-amber-500/5")}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-lg font-semibold tabular-nums", warning && "text-amber-700 dark:text-amber-300")}>
        {value}
      </div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}

export function CostControlSummaryCard({ summary }: { summary: CostControlSummary }) {
  const status = statusPresentation(summary.status);
  const StatusIcon = status.icon;
  const governedRouteDetail =
    summary.eventCount === 0
      ? "No execution evidence in this period"
      : `${summary.governedRouteEventCount} of ${summary.eventCount} events linked`;

  return (
    <Card data-testid="cost-control-summary">
      <CardHeader className="gap-3 px-5 pt-5 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">AI usage control</CardTitle>
          <CardDescription>
            What Sysdom recorded, what may incur metered charges, and what still needs cost evidence.
          </CardDescription>
        </div>
        <div className={cn("flex shrink-0 items-center gap-2 border px-3 py-2 text-xs font-medium", status.className)}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-2">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ControlMetric
            label="Recorded ledger"
            value={formatCents(summary.recordedCostCents)}
            detail={`${summary.eventCount} event${summary.eventCount === 1 ? "" : "s"} · ${formatTokens(summary.tokenCount)} tokens`}
          />
          <ControlMetric
            label="Metered exposure"
            value={formatCents(summary.meteredCostCents)}
            detail={`${summary.meteredEventCount} metered or overage event${summary.meteredEventCount === 1 ? "" : "s"}`}
          />
          <ControlMetric
            label="Included / prepaid"
            value={formatTokens(summary.includedOrPrepaidTokenCount)}
            detail={`${summary.includedOrPrepaidEventCount} included, credit, or fixed event${summary.includedOrPrepaidEventCount === 1 ? "" : "s"}`}
          />
          <ControlMetric
            label="Needs reconciliation"
            value={String(summary.unreconciledEventCount)}
            detail={
              summary.unreconciledEventCount > 0
                ? `${formatTokens(summary.unreconciledTokenCount)} tokens have unknown or zero-priced metered cost`
                : "No unknown or zero-priced metered usage detected"
            }
            warning={summary.unreconciledEventCount > 0}
          />
        </div>

        <div className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border">
              <Route className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium">Governed route linkage</div>
              <div className="text-xs text-muted-foreground">{governedRouteDetail}</div>
            </div>
          </div>
          <div className="text-2xl font-semibold tabular-nums">{summary.governedRoutePercent}%</div>
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          This is Sysdom&apos;s operational ledger. It is not a provider invoice or an independent provider-side
          spending cap. Unknown or zero-priced metered usage must be reconciled before further paid runs.
        </p>
      </CardContent>
    </Card>
  );
}
