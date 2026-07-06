import { ArrowRight, BookOpenCheck, MessageCircleWarning, Radio, Users } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomerEngineStatus = "connected" | "pending" | "attention";

type CustomerEngineSignal = {
  label: string;
  value: string;
  tone?: "default" | "muted" | "attention";
};

export type CustomerEngineBridgeState = {
  status: CustomerEngineStatus;
  statusLabel: string;
  headline: string;
  summary: string;
  signals: CustomerEngineSignal[];
};

const defaultState: CustomerEngineBridgeState = {
  status: "pending",
  statusLabel: "Live signal pending",
  headline: "Customer Engine",
  summary: "Customer discovery can keep running in Tissuu while SimOne turns the signal into review prompts, assumptions, and durable SIM memory.",
  signals: [
    { label: "Digest", value: "Waiting for readout", tone: "muted" },
    { label: "Review", value: "Approval stays human", tone: "attention" },
    { label: "Memory", value: "Capture decisions in SIM Wiki" },
  ],
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              Customer signal
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircleWarning className="h-3.5 w-3.5" aria-hidden="true" />
              Human review
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpenCheck className="h-3.5 w-3.5" aria-hidden="true" />
              SIM memory
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/sim-coach">Open SIM Coach</Link>
            </Button>
            <Button asChild size="sm" className="h-8">
              <Link to="/issues">
                Open Work
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
