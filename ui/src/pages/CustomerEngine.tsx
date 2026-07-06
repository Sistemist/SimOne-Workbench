import { useEffect } from "react";
import { ArrowRight, BarChart3, ClipboardCheck, HeartPulse, Inbox, Radio, Users } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { CustomerEngineBridgeCard } from "../components/CustomerEngineBridgeCard";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

const bridgeSurfaces = [
  {
    title: "Daily Readout",
    status: "Waiting for digest",
    body: "A short executive summary of wins, risks, and next customer moves.",
    icon: Inbox,
  },
  {
    title: "Human Review Queue",
    status: "Approval stays here",
    body: "Public language, relationship choices, and offer changes remain judgment calls.",
    icon: ClipboardCheck,
  },
  {
    title: "Funnel Signals",
    status: "Metrics pending",
    body: "Waitlist, qualified leads, reply quality, source mix, and proof events.",
    icon: BarChart3,
  },
  {
    title: "Engine Health",
    status: "Ops pending",
    body: "Tissuu job status, stale signals, failures, and cost notes.",
    icon: HeartPulse,
  },
];

export function CustomerEngine() {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Customer Engine" }]);
  }, [setBreadcrumbs]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
      <section className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Customer Engine</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
              Turn customer signal into company judgment.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keep Tissuu as the live discovery system and use SimOne to review what changed, what needs approval,
              and which assumptions should become SIM memory.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/sim-coach">SIM Coach</Link>
            </Button>
            <Button asChild size="sm" className="h-8">
              <Link to="/issues">
                Open Work
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <CustomerEngineBridgeCard />

      <section className="grid gap-4 md:grid-cols-2">
        {bridgeSurfaces.map((surface) => {
          const Icon = surface.icon;
          return (
            <div key={surface.title} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{surface.title}</h2>
                    <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {surface.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{surface.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">First bridge rule</h2>
            <p className="mt-1 text-sm leading-5 text-amber-900/80 dark:text-amber-100/80">
              SimOne reads customer signal first. Posting, publishing, following, and prospect changes stay in Tissuu
              until there is an explicit reviewed action.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
