import { ArrowRight, BookOpenCheck, ExternalLink, MessageCircleWarning, Radio, Users } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustomerEngineBridgeSnapshot } from "@/api/customerEngine";

type CustomerEngineStatus = "connected" | "pending" | "attention";

type CustomerEngineSignal = {
  label: string;
  value: string;
  tone?: "default" | "muted" | "attention";
};

type CustomerEngineReviewLoop = {
  changed: string;
  needsHuman: string;
  memory: string;
};

export type CustomerEngineBridgeState = {
  status: CustomerEngineStatus;
  statusLabel: string;
  headline: string;
  summary: string;
  signals: CustomerEngineSignal[];
  reviewLoop: CustomerEngineReviewLoop;
  judgmentPrompt: string;
  nextReview?: {
    title: string;
    reason?: string;
  };
  reviewHref?: string;
};

const defaultState: CustomerEngineBridgeState = {
  status: "pending",
  statusLabel: "Signal pending",
  headline: "Customer Signal",
  summary: "Customer discovery can keep running in Tissuu while SimOne turns the signal into review prompts, assumptions, and durable SIM memory.",
  signals: [
    { label: "Digest", value: "Waiting for readout", tone: "muted" },
    { label: "Review", value: "Approval stays human", tone: "attention" },
    { label: "Memory", value: "Capture decisions in SIM Wiki" },
  ],
  reviewLoop: {
    changed: "Waiting for the next customer readout.",
    needsHuman: "Approval stays with the human before any public or relationship move.",
    memory: "Promote decisions and proof points into SIM Wiki when they matter.",
  },
  judgmentPrompt: "Decide what changes in Product, Cash, or SIM memory.",
};

const statusTone: Record<CustomerEngineStatus, string> = {
  connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  pending: "border-border bg-muted/40 text-muted-foreground",
  attention: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

const signalTone: Record<NonNullable<CustomerEngineSignal["tone"]>, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  attention: "text-amber-700 dark:text-amber-200",
};

export function bridgeSnapshotToCardState(
  snapshot: CustomerEngineBridgeSnapshot | undefined,
): CustomerEngineBridgeState {
  if (!snapshot) return defaultState;
  if (snapshot.status === "unavailable") {
    return {
      status: "attention",
      statusLabel: "Bridge unavailable",
      headline: "Customer Signal",
      summary: snapshot.message,
      signals: [
        { label: "Digest", value: "Unavailable", tone: "attention" },
        { label: "Review", value: "Approval stays in Tissuu" },
        { label: "Memory", value: "Do not invent signal", tone: "muted" },
      ],
      reviewLoop: {
        changed: "No trusted customer signal is available yet.",
        needsHuman: "Wait for the live bridge before changing the company map.",
        memory: "Do not create SIM memory from missing or invented customer data.",
      },
      judgmentPrompt: "Wait for live customer signal before changing the company map.",
    };
  }

  const nextReviewItem = snapshot.actions.items[0];
  const nextDigestAction = snapshot.digest.nextActions[0];

  return {
    status: snapshot.ops.overall === "healthy" ? "connected" : "attention",
    statusLabel: "Live signal from Tissuu",
    headline: "Customer Signal",
    summary: `${snapshot.digest.headline}. ${snapshot.digest.summary}`,
    signals: [
      { label: "Needs review", value: `${snapshot.actions.count} items`, tone: snapshot.actions.count > 0 ? "attention" : "default" },
      { label: "Waitlist", value: `${snapshot.metrics.waitlistTotal} people` },
      {
        label: "Health",
        value: snapshot.ops.overall === "healthy" ? "Engine healthy" : "Needs attention",
        tone: snapshot.ops.overall === "healthy" ? "default" : "attention",
      },
    ],
    reviewLoop: {
      changed: snapshot.digest.headline,
      needsHuman:
        nextReviewItem?.title ??
        nextDigestAction?.title ??
        (snapshot.actions.count > 0 ? `${snapshot.actions.count} customer items need review.` : "No live review item is waiting."),
      memory: "Promote only proof, positioning, or relationship decisions; keep live counts ephemeral.",
    },
    judgmentPrompt: "Decide what changes in Product, Cash, or SIM memory.",
    nextReview:
      nextReviewItem || nextDigestAction
        ? {
            title: nextReviewItem?.title ?? nextDigestAction?.title ?? "Review the next customer move",
            reason: nextReviewItem?.reason,
          }
        : undefined,
    reviewHref: nextDigestAction?.deepLink ?? nextReviewItem?.deepLink,
  };
}

export function CustomerEngineBridgeCard({ state = defaultState }: { state?: CustomerEngineBridgeState }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-md bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-300">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">{state.headline}</h3>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone[state.status])}>
                  {state.statusLabel}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{state.summary}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {state.signals.map((signal) => (
            <div key={signal.label} className="border-l border-border pl-3">
              <div className="text-[11px] font-medium uppercase text-muted-foreground">{signal.label}</div>
              <div className={cn("mt-1 text-sm font-medium", signalTone[signal.tone ?? "default"])}>
                {signal.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-y border-border py-3 md:grid-cols-3">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Customer signal</div>
            <p className="mt-1 text-sm font-medium text-foreground">{state.reviewLoop.changed}</p>
          </div>
          <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Next judgment</div>
            <p className="mt-1 text-sm font-medium text-foreground">{state.judgmentPrompt}</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.reviewLoop.needsHuman}</p>
            {state.nextReview?.reason ? (
              <p className="mt-1 text-sm text-muted-foreground">{state.nextReview.reason}</p>
            ) : null}
          </div>
          <div className="border-t border-border pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Company memory</div>
            <p className="mt-1 text-sm text-muted-foreground">{state.reviewLoop.memory}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              Live in Tissuu
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircleWarning className="h-3.5 w-3.5" aria-hidden="true" />
              Human review
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
              SIM Wiki memory
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-200">
              <MessageCircleWarning className="h-3.5 w-3.5" aria-hidden="true" />
              Read-only bridge
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/sim-coach">Ask SIM Coach why</Link>
            </Button>
            {state.reviewHref ? (
              <Button asChild variant="outline" size="sm" className="h-8">
                <a href={state.reviewHref}>
                  Review in Tissuu
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
            <Button asChild size="sm" className="h-8">
              <Link to="/customer-engine">
                Open Customer Engine
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
