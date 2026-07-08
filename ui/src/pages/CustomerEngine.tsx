import { useEffect, useState } from "react";
import { ArrowRight, BarChart3, BookOpenCheck, ClipboardCheck, HeartPulse, Inbox, Radio, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { customerEngineApi, type CustomerEngineBridgeSnapshot } from "@/api/customerEngine";
import { pluginsApi } from "@/api/plugins";
import { CustomerEngineBridgeCard, bridgeSnapshotToCardState } from "../components/CustomerEngineBridgeCard";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";

const SIM_WIKI_PACKAGE = "@paperclipai/plugin-llm-wiki";

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
    title: "SIM Memory",
    status: "Promotion only",
    body: "Proof, positioning, and relationship decisions can become durable knowledge when the human promotes them.",
    icon: BookOpenCheck,
  },
];

type LiveCustomerEngineBridgeSnapshot = Extract<CustomerEngineBridgeSnapshot, { status: "live" }>;

type WikiPromotionState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; path: string }
  | { status: "error"; message: string };

function slugifyForWikiPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "customer-engine-readout";
}

function timestampForWikiPath(now: Date): string {
  return now.toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
}

function buildCustomerEngineWikiPromotion(snapshot: LiveCustomerEngineBridgeSnapshot, now = new Date()) {
  const title = "Customer Engine proof readout";
  const path = `wiki/synthesis/customer-engine-${timestampForWikiPath(now)}-${slugifyForWikiPath(title)}.md`;
  const updated = now.toISOString().slice(0, 10);
  const topAction = snapshot.actions.items[0];
  const durableSignals = [
    snapshot.metrics.waitlistTotal > 0 ? "- Active waitlist signal is present." : null,
    snapshot.metrics.qualifiedLeads > 0 ? "- Qualified customer demand is present." : null,
    snapshot.metrics.proofEvents > 0 ? "- Proof signal is present." : null,
    snapshot.actions.count > 0 ? "- At least one customer-facing judgment needs human review." : null,
  ].filter((signal): signal is string => signal !== null);
  const contents = [
    "---",
    `title: ${title}`,
    "type: synthesis",
    "tags: [simone, customer-engine, tissuu, proof]",
    "sources: [tissuu-customer-engine-bridge]",
    `created: ${updated}`,
    `updated: ${updated}`,
    "---",
    "",
    `# ${title}`,
    "",
    "## Source",
    "",
    "- source: Tissuu Customer Engine bridge",
    `- generated: ${snapshot.generatedAt}`,
    "- bridge mode: read-only",
    "",
    "## Durable Interpretation",
    "",
    "Tissuu is showing customer movement that deserves human judgment before any public reply, offer change, or relationship move is made.",
    "",
    "## Why Preserve This",
    "",
    durableSignals.length > 0 ? durableSignals.join("\n") : "- No durable customer signal was selected for preservation.",
    topAction ? `- The next useful decision is a ${topAction.priority}-priority human review, kept live in Tissuu.` : "- No specific review decision was selected.",
    "",
    "## What Stays Live",
    "",
    "Operational counts, pending queues, customer handles, and draft-specific details stay in Tissuu. This page records only the promoted interpretation and provenance.",
    "",
    "## Ops Health",
    "",
    `- status: ${snapshot.ops.overall}`,
    snapshot.ops.staleSignals.length ? `- stale signals: ${snapshot.ops.staleSignals.join(", ")}` : "- stale signals: none",
    "",
    "## Promotion Note",
    "",
    "Live Tissuu counts stay live. Only proof, positioning, or relationship decisions become durable SIM Wiki pages.",
    "",
    "## Next Move",
    "",
    "Review the customer judgment in Tissuu, then decide whether Product, Cash, or SIM memory should change.",
  ].join("\n");

  return { path, contents };
}

export function CustomerEngine() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId } = useCompany();
  const [promotionState, setPromotionState] = useState<WikiPromotionState>({ status: "idle" });
  const { data: bridgeSnapshot } = useQuery({
    queryKey: ["customer-engine-bridge", selectedCompanyId],
    queryFn: () => customerEngineApi.bridgeSnapshot(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: plugins } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });
  const simWikiPlugin = plugins?.find((plugin) => plugin.packageName === SIM_WIKI_PACKAGE);
  const simWikiReady = simWikiPlugin?.status === "ready";
  const liveSnapshot = bridgeSnapshot?.status === "live" ? bridgeSnapshot : null;

  useEffect(() => {
    setBreadcrumbs([{ label: "Customer Engine" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    setPromotionState({ status: "idle" });
  }, [selectedCompanyId, liveSnapshot?.generatedAt]);

  async function promoteReadoutToWiki() {
    if (!liveSnapshot || !simWikiPlugin || !selectedCompanyId) return;
    const page = buildCustomerEngineWikiPromotion(liveSnapshot);
    setPromotionState({ status: "saving" });
    try {
      const response = await pluginsApi.bridgePerformAction(
        simWikiPlugin.id,
        "write-page",
        {
          companyId: selectedCompanyId,
          wikiId: "default",
          spaceSlug: "default",
          path: page.path,
          contents: page.contents,
          summary: "Promoted Customer Engine readout from SimOne",
          sourceRefs: [{ kind: "tissuu-customer-engine-bridge", generatedAt: liveSnapshot.generatedAt }],
        },
        selectedCompanyId
      );
      const data = response.data as { path?: unknown } | undefined;
      setPromotionState({ status: "saved", path: typeof data?.path === "string" ? data.path : page.path });
    } catch (error) {
      setPromotionState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not save to SIM Wiki.",
      });
    }
  }

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

      <CustomerEngineBridgeCard state={bridgeSnapshotToCardState(bridgeSnapshot)} />

      <section className="grid gap-4 md:grid-cols-2">
        {bridgeSurfaces.map((surface) => {
          const Icon = surface.icon;
          const status =
            liveSnapshot && surface.title === "Daily Readout"
              ? "Live digest"
              : liveSnapshot && surface.title === "Human Review Queue"
                ? `${liveSnapshot.actions.count} items`
                : liveSnapshot && surface.title === "Funnel Signals"
                  ? `${liveSnapshot.metrics.waitlistTotal} people`
                  : liveSnapshot && surface.title === "SIM Memory"
                    ? "Human-promoted"
                    : surface.status;
          const body =
            liveSnapshot && surface.title === "Daily Readout"
              ? liveSnapshot.digest.summary
              : liveSnapshot && surface.title === "Human Review Queue"
                ? liveSnapshot.actions.items[0]?.title ?? "No review items waiting."
                : liveSnapshot && surface.title === "Funnel Signals"
                  ? `${liveSnapshot.metrics.qualifiedLeads} qualified leads, ${liveSnapshot.metrics.proofEvents} proof events.`
                  : liveSnapshot && surface.title === "SIM Memory"
                    ? `Keep ${liveSnapshot.actions.count} live review items ephemeral unless a proof point or decision should be remembered.`
                    : surface.body;
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
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {liveSnapshot ? (
        <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 text-emerald-950 dark:text-emerald-50">
          <div className="flex items-start gap-3">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Why SimOne stops here</h2>
              <p className="mt-1 text-sm leading-5 text-emerald-950/80 dark:text-emerald-50/80">
                Customer replies and proof points can change the company map. SimOne can surface the pattern,
                but the relationship move stays with a human before anything is posted, promoted, or remembered.
              </p>
              <p className="mt-2 text-sm leading-5 text-emerald-950/80 dark:text-emerald-50/80">
                Ops check: {liveSnapshot.ops.overall === "healthy" ? "engine healthy" : "needs attention"} across{" "}
                {liveSnapshot.ops.jobs.length} observed job{liveSnapshot.ops.jobs.length === 1 ? "" : "s"}.
              </p>
              {simWikiReady && selectedCompanyId ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-emerald-500/30 bg-background/70 text-emerald-950 hover:bg-background dark:text-emerald-50"
                    onClick={promoteReadoutToWiki}
                    disabled={promotionState.status === "saving"}
                  >
                    {promotionState.status === "saving" ? "Saving..." : "Save proof readout to SIM Wiki"}
                  </Button>
                  {promotionState.status === "saved" ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-emerald-950/80 dark:text-emerald-50/80">
                      <span>Saved to SIM Wiki: {promotionState.path}</span>
                      <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs text-inherit">
                        <Link to={`/wiki/page/${promotionState.path}`}>Open saved page</Link>
                      </Button>
                    </div>
                  ) : null}
                  {promotionState.status === "error" ? (
                    <p className="text-xs leading-5 text-destructive">{promotionState.message}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {liveSnapshot?.actions.items.length ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">Review In Tissuu</h2>
          </div>
          <div className="mt-3 divide-y divide-border">
            {liveSnapshot.actions.items.slice(0, 5).map((action) => (
              <div key={action.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{action.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
                </div>
                <a
                  href={action.deepLink}
                  className="text-sm font-medium text-primary underline underline-offset-2"
                >
                  Open in Tissuu
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
