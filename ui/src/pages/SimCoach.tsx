import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  CircleDollarSign,
  Compass,
  FileSearch,
  MessageCircleQuestion,
  PackageCheck,
  Scale,
  Sparkles,
  Workflow,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { pluginsApi } from "@/api/plugins";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";

const SIM_WIKI_PACKAGE = "@paperclipai/plugin-llm-wiki";
const SIM_WIKI_FOCUS_ROUTE = "/company/settings/instance/plugins?focus=paperclipai.plugin-llm-wiki";
const BOTTLENECK_SCAN_STORAGE_KEY = "simone:bottleneck-scan";

type ScannerCoachContext = {
  headline: string;
  engine: string;
  questions: string[];
  artifact: string;
  firstSection: string;
};

type MethodologyContext = {
  concept: string;
  idea: string;
  useWhen: string;
};

const engines = [
  {
    name: "Product",
    summary: "Offer, roadmap, delivery",
    icon: PackageCheck,
    tone: "text-sky-500 bg-sky-500/10",
  },
  {
    name: "Customer",
    summary: "Discovery, trust, demand",
    icon: Users,
    tone: "text-emerald-500 bg-emerald-500/10",
  },
  {
    name: "Cash",
    summary: "Pricing, revenue, runway",
    icon: CircleDollarSign,
    tone: "text-amber-500 bg-amber-500/10",
  },
  {
    name: "Skills",
    summary: "Capability, learning, leverage",
    icon: Boxes,
    tone: "text-rose-500 bg-rose-500/10",
  },
];

const drivers = ["Innovation", "Governance", "Interaction", "Culture"];

const coachNotes = [
  {
    title: "Feedback loop weakened",
    body: "Customer signal, review, or learning disappears from the workflow.",
  },
  {
    title: "Agent making a judgment call",
    body: "Strategy, spend, reputation, or company structure changes without approval.",
  },
  {
    title: "Engine missing its counterpart",
    body: "Product work proceeds without customer evidence, or cash planning ignores delivery capacity.",
  },
  {
    title: "System archetype emerging",
    body: "A recurring pattern starts to look like drift, delay, over-control, or unchecked acceleration.",
  },
];

const setupOptions = [
  {
    title: "SimOne starter",
    label: "Recommended",
    body: "Four engines, four drivers, approval boundaries, and a SIM Wiki-ready Sprint Zero.",
    action: "Open starter",
    href: "/teams-catalog/paperclipai%3Abundled%3Asimone%3Asimone-starter",
  },
  {
    title: "Blank company",
    label: "Advanced",
    body: "A clean control plane for teams that already know how agents, tasks, and governance should fit.",
    action: "Stay blank",
    href: "/dashboard",
  },
];

const reviewBoundaries = [
  "Strategy",
  "Spending",
  "Public claims",
  "Company structure",
  "Customer promises",
];

const coachFlow = [
  {
    title: "Messy input",
    body: "Founder notes, tasks, docs, and research land in the workbench.",
    icon: FileSearch,
  },
  {
    title: "SIM Wiki",
    body: "When enabled, the maintainer compiles durable memory instead of relying on repeated raw retrieval.",
    icon: BookOpenCheck,
  },
  {
    title: "Coach judgment",
    body: "SimOne flags risks, missing loops, and approval moments before agents run too far.",
    icon: MessageCircleQuestion,
  },
];

const simWikiSeedMap = [
  {
    title: "Method pages",
    body: "Engines, drivers, system laws, archetypes, and coaching guidance.",
  },
  {
    title: "Venture memory",
    body: "Founder notes, first maps, decisions, proof points, and Sprint Zero context.",
  },
  {
    title: "Promotion rule",
    body: "Live bridge counts stay live. Only useful decisions and proof become durable wiki pages.",
  },
];

function buildWikiRetrievalQuestion(context: ScannerCoachContext): string {
  return `What should SIM Coach check before assigning work on ${context.headline}?`;
}

type WikiPromotionState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; path: string }
  | { status: "error"; message: string };

type WikiRetrievalState =
  | { status: "idle" }
  | { status: "starting" }
  | {
      status: "queued";
      operationId: string | null;
      issueRef: string | null;
      channel: string | null;
      answer: string;
      sourceRefs: WikiAnswerSource[];
      streamStatus: "connecting" | "running" | "done" | "error";
      streamMessage: string | null;
    }
  | { status: "error"; message: string };

type QueuedWikiRetrieval = Extract<WikiRetrievalState, { status: "queued" }>;

type WikiAnswerSource = {
  kind: "wiki-page" | "raw-source";
  path: string;
};

function loadScannerCoachContext(): ScannerCoachContext | null {
  try {
    const raw = window.localStorage.getItem(BOTTLENECK_SCAN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      result?: {
        headline?: unknown;
        engine?: unknown;
        questions?: unknown;
        mapPreview?: {
          artifact?: unknown;
          firstSection?: unknown;
        };
      };
    };
    const headline = typeof parsed.result?.headline === "string" ? parsed.result.headline.trim() : "";
    const engine = typeof parsed.result?.engine === "string" ? parsed.result.engine.trim() : "";
    const questions = Array.isArray(parsed.result?.questions)
      ? parsed.result.questions
          .filter((question): question is string => typeof question === "string" && question.trim().length > 0)
          .map((question) => question.trim())
          .slice(0, 3)
      : [];
    const artifact =
      typeof parsed.result?.mapPreview?.artifact === "string"
        ? parsed.result.mapPreview.artifact.trim()
        : "Venture Architecture Map";
    const firstSection =
      typeof parsed.result?.mapPreview?.firstSection === "string"
        ? parsed.result.mapPreview.firstSection.trim()
        : "";

    if (!headline || !engine) return null;

    return {
      headline,
      engine,
      questions,
      artifact: artifact || "Venture Architecture Map",
      firstSection,
    };
  } catch {
    return null;
  }
}

function slugifyForWikiPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "scanner-synthesis";
}

function timestampForWikiPath(now: Date): string {
  return now.toISOString().slice(0, 19).replace("T", "-").replace(/:/g, "");
}

function extractWikiAnswerSources(answer: string): WikiAnswerSource[] {
  const sources: WikiAnswerSource[] = [];
  const seen = new Set<string>();
  const addSource = (kind: WikiAnswerSource["kind"], rawPath: string) => {
    const path = rawPath.trim().replace(/[),.;:]+$/g, "");
    if (!path || seen.has(`${kind}:${path}`)) return;
    seen.add(`${kind}:${path}`);
    sources.push({ kind, path });
  };

  for (const match of answer.matchAll(/\[\[(wiki\/[^\]\|]+)(?:\|[^\]]+)?\]\]/g)) {
    addSource("wiki-page", match[1] ?? "");
  }
  for (const match of answer.matchAll(/(?:^|[\s(])`?(wiki\/[A-Za-z0-9_./-]+\.md)`?/g)) {
    addSource("wiki-page", match[1] ?? "");
  }
  for (const match of answer.matchAll(/\[\[(raw\/[^\]\|]+)(?:\|[^\]]+)?\]\]/g)) {
    addSource("raw-source", match[1] ?? "");
  }
  for (const match of answer.matchAll(/(?:^|[\s(])`?(raw\/[A-Za-z0-9_./-]+)`?/g)) {
    addSource("raw-source", match[1] ?? "");
  }

  return sources.slice(0, 8);
}

function normalizeWikiAnswerSourceRefs(value: unknown): WikiAnswerSource[] {
  if (!Array.isArray(value)) return [];
  const sources: WikiAnswerSource[] = [];
  const seen = new Set<string>();

  for (const ref of value) {
    if (typeof ref !== "object" || ref == null || Array.isArray(ref)) continue;
    const kind = (ref as { kind?: unknown }).kind;
    const path = (ref as { path?: unknown }).path;
    if ((kind !== "wiki-page" && kind !== "raw-source") || typeof path !== "string") continue;
    const normalizedPath = path.trim().replace(/[),.;:]+$/g, "");
    if (!normalizedPath || seen.has(`${kind}:${normalizedPath}`)) continue;
    seen.add(`${kind}:${normalizedPath}`);
    sources.push({ kind, path: normalizedPath });
    if (sources.length >= 8) break;
  }

  return sources;
}

function collectWikiAnswerSources(answer: string, sourceRefs: WikiAnswerSource[] = []): WikiAnswerSource[] {
  const sources: WikiAnswerSource[] = [];
  const seen = new Set<string>();
  const addSource = (source: WikiAnswerSource) => {
    if (seen.has(`${source.kind}:${source.path}`)) return;
    seen.add(`${source.kind}:${source.path}`);
    sources.push(source);
  };

  sourceRefs.forEach(addSource);
  extractWikiAnswerSources(answer).forEach(addSource);

  return sources.slice(0, 8);
}

function wikiAnswerSourceMarkdown(source: WikiAnswerSource): string {
  return source.kind === "wiki-page" ? `- [[${source.path}]]` : `- \`${source.path}\``;
}

function buildScannerWikiPromotion(context: ScannerCoachContext, methodology: MethodologyContext, now = new Date()) {
  const path = `wiki/synthesis/scanner-${timestampForWikiPath(now)}-${slugifyForWikiPath(context.headline)}.md`;
  const updated = now.toISOString().slice(0, 10);
  const questions = context.questions.length > 0
    ? context.questions.map((question) => `- ${question}`).join("\n")
    : "- No open questions were captured in the scanner result.";
  const contents = [
    "---",
    `title: ${context.headline.replace(/:/g, " -")}`,
    "type: synthesis",
    "tags: [simone, scanner, coach]",
    "sources: []",
    `created: ${updated}`,
    `updated: ${updated}`,
    "---",
    "",
    `# ${context.headline}`,
    "",
    "## Scanner Signal",
    "",
    `- engine: ${context.engine}`,
    `- artifact: ${context.artifact}`,
    context.firstSection ? `- map section: ${context.firstSection}` : "- map section: not captured",
    "",
    "## Method Underneath",
    "",
    `**${methodology.concept}**`,
    "",
    methodology.idea,
    "",
    methodology.useWhen,
    "",
    "## Open Questions",
    "",
    questions,
    "",
    "## Promotion Note",
    "",
    "Live bridge counts stay live. Only useful decisions and proof become durable SIM Wiki pages.",
    "",
    "## Next Move",
    "",
    "Turn this into Sprint Zero or review the saved synthesis with SIM Coach before assigning agent work.",
  ].join("\n");

  return { path, contents };
}

function buildWikiAnswerPromotion(context: ScannerCoachContext, retrieval: QueuedWikiRetrieval, now = new Date()) {
  const path = `wiki/synthesis/coach-answer-${timestampForWikiPath(now)}-${slugifyForWikiPath(context.headline)}.md`;
  const updated = now.toISOString().slice(0, 10);
  const answerSources = collectWikiAnswerSources(retrieval.answer, retrieval.sourceRefs);
  const sourcesMentioned = answerSources.length > 0
    ? answerSources.map(wikiAnswerSourceMarkdown).join("\n")
    : "- No explicit wiki or raw source paths were mentioned in the answer.";
  const questions = context.questions.length > 0
    ? context.questions.map((question) => `- ${question}`).join("\n")
    : "- No open questions were captured in the scanner result.";
  const contents = [
    "---",
    `title: SIM Wiki answer - ${context.headline.replace(/:/g, " -")}`,
    "type: synthesis",
    "tags: [simone, coach, sim-wiki-answer]",
    "sources: []",
    `created: ${updated}`,
    `updated: ${updated}`,
    "---",
    "",
    `# SIM Wiki answer: ${context.headline}`,
    "",
    "## SIM Wiki Answer",
    "",
    retrieval.answer.trim(),
    "",
    "## Sources Mentioned",
    "",
    sourcesMentioned,
    "",
    "## Scanner Context",
    "",
    `- engine: ${context.engine}`,
    `- artifact: ${context.artifact}`,
    context.firstSection ? `- map section: ${context.firstSection}` : "- map section: not captured",
    retrieval.issueRef ? `- maintainer task: ${retrieval.issueRef}` : "- maintainer task: not captured",
    retrieval.operationId ? `- operation id: ${retrieval.operationId}` : "- operation id: not captured",
    "",
    "## Open Questions",
    "",
    questions,
    "",
    "## Promotion Note",
    "",
    "This answer was returned from SIM Wiki and deliberately promoted from SIM Coach. Use it as durable coaching memory, not as a replacement for live source checks.",
  ].join("\n");

  return { path, contents };
}

function methodologyForScannerContext(context: ScannerCoachContext): MethodologyContext {
  if (context.engine.toLowerCase().includes("customer")) {
    return {
      concept: context.firstSection || "Customer review loop",
      idea: "SIM idea: signal becomes useful only when it moves through judgment and into memory.",
      useWhen: "Use this when customer replies, proof, or promises are scattered.",
    };
  }
  if (context.engine.toLowerCase().includes("cash")) {
    return {
      concept: context.firstSection || "Money decision loop",
      idea: "SIM idea: financial pressure needs an explicit decision boundary before it steers the whole system.",
      useWhen: "Use this when pricing, runway, spend, or revenue choices are shaping the next move.",
    };
  }
  if (context.engine.toLowerCase().includes("skills")) {
    return {
      concept: context.firstSection || "Ownership loop",
      idea: "SIM idea: recurring work becomes leverage only when capability and responsibility are visible.",
      useWhen: "Use this when work keeps returning to the founder or no role clearly owns the next step.",
    };
  }
  return {
    concept: context.firstSection || "Product proof loop",
    idea: "SIM idea: product direction stays coherent when promises, proof, and approval move together.",
    useWhen: "Use this when features, positioning, or roadmap choices are moving faster than evidence.",
  };
}

export function SimCoach() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? "this company";
  const [promotionState, setPromotionState] = useState<WikiPromotionState>({ status: "idle" });
  const [answerPromotionState, setAnswerPromotionState] = useState<WikiPromotionState>({ status: "idle" });
  const [retrievalState, setRetrievalState] = useState<WikiRetrievalState>({ status: "idle" });
  const driverText = useMemo(() => drivers.join(" / "), []);
  const scannerContext = useMemo(loadScannerCoachContext, []);
  const methodologyContext = scannerContext ? methodologyForScannerContext(scannerContext) : null;
  const wikiRetrievalQuestion = scannerContext ? buildWikiRetrievalQuestion(scannerContext) : null;
  const wikiAnswerSources =
    retrievalState.status === "queued" ? collectWikiAnswerSources(retrievalState.answer, retrievalState.sourceRefs) : [];
  const { data: plugins } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });
  const simWikiPlugin = plugins?.find((plugin) => plugin.packageName === SIM_WIKI_PACKAGE);
  const simWikiReady = simWikiPlugin?.status === "ready";
  const retrievalChannel = retrievalState.status === "queued" ? retrievalState.channel : null;
  const resolvedCoachFlow = useMemo(
    () =>
      coachFlow.map((step) =>
        step.title === "SIM Wiki"
          ? {
              ...step,
              body: simWikiReady
                ? "Ready for durable memory, source ingestion, and cited coaching."
                : step.body,
            }
          : step
      ),
    [simWikiReady]
  );

  useEffect(() => {
    if (
      !retrievalChannel ||
      !simWikiPlugin ||
      !companyId
    ) {
      return undefined;
    }

    let closed = false;
    const params = new URLSearchParams({ companyId });
    const source = new EventSource(
      `/api/plugins/${encodeURIComponent(simWikiPlugin.id)}/bridge/stream/${encodeURIComponent(
        retrievalChannel
      )}?${params.toString()}`,
      { withCredentials: true }
    );

    source.onopen = () => {
      setRetrievalState((current) =>
        current.status === "queued" ? { ...current, streamStatus: "running", streamMessage: null } : current
      );
    };
    source.onmessage = (event) => {
      let parsed: {
        type?: unknown;
        eventType?: unknown;
        stream?: unknown;
        message?: unknown;
        answer?: unknown;
        sourceRefs?: unknown;
      };
      try {
        parsed = JSON.parse(event.data) as typeof parsed;
      } catch {
        return;
      }

      if (
        parsed.type === "agent.event" &&
        parsed.eventType === "chunk" &&
        parsed.stream !== "stderr" &&
        typeof parsed.message === "string" &&
        parsed.message.length > 0
      ) {
        setRetrievalState((current) =>
          current.status === "queued"
            ? {
                ...current,
                answer: `${current.answer}${parsed.message as string}`,
                streamStatus: current.streamStatus === "connecting" ? "running" : current.streamStatus,
              }
            : current
        );
        return;
      }

      if (parsed.type === "query.done") {
        closed = true;
        source.close();
        setRetrievalState((current) =>
          current.status === "queued"
            ? {
                ...current,
                answer: typeof parsed.answer === "string" ? parsed.answer : current.answer,
                sourceRefs: normalizeWikiAnswerSourceRefs(parsed.sourceRefs),
                streamStatus: "done",
                streamMessage: "Answer finished.",
              }
            : current
        );
        return;
      }

      if (parsed.type === "query.error") {
        closed = true;
        source.close();
        setRetrievalState((current) =>
          current.status === "queued"
            ? {
                ...current,
                streamStatus: "error",
                streamMessage:
                  typeof parsed.message === "string"
                    ? parsed.message
                    : "Could not stream the SIM Wiki answer. Open the maintainer task to inspect it.",
              }
            : current
        );
      }
    };
    source.onerror = () => {
      if (closed) return;
      setRetrievalState((current) =>
        current.status === "queued"
          ? {
              ...current,
              streamStatus: "error",
              streamMessage: "Could not stream the SIM Wiki answer. Open the maintainer task to inspect it.",
            }
          : current
      );
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [companyId, retrievalChannel, simWikiPlugin]);

  useEffect(() => {
    setBreadcrumbs([{ label: "SIM Coach" }]);
  }, [setBreadcrumbs]);

  async function promoteScannerToWiki() {
    if (!scannerContext || !methodologyContext || !simWikiPlugin || !companyId) return;
    const page = buildScannerWikiPromotion(scannerContext, methodologyContext);
    setPromotionState({ status: "saving" });
    try {
      const response = await pluginsApi.bridgePerformAction(
        simWikiPlugin.id,
        "write-page",
        {
          companyId,
          wikiId: "default",
          spaceSlug: "default",
          path: page.path,
          contents: page.contents,
          summary: "Promoted scanner synthesis from SIM Coach",
          sourceRefs: [{ kind: "simone-bottleneck-scan", artifact: scannerContext.artifact }],
        },
        companyId
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

  async function queueWikiRetrieval() {
    if (!scannerContext || !wikiRetrievalQuestion || !simWikiPlugin || !companyId) return;
    setRetrievalState({ status: "starting" });
    try {
      const response = await pluginsApi.bridgePerformAction(
        simWikiPlugin.id,
        "start-query",
        {
          companyId,
          wikiId: "default",
          spaceSlug: "default",
          question: wikiRetrievalQuestion,
          title: `SIM Coach retrieval: ${scannerContext.headline}`,
        },
        companyId
      );
      const data = response.data as {
        operationId?: unknown;
        channel?: unknown;
        issue?: {
          id?: unknown;
          identifier?: unknown;
        };
      } | undefined;
      const issueIdentifier = typeof data?.issue?.identifier === "string" ? data.issue.identifier : "";
      const issueId = typeof data?.issue?.id === "string" ? data.issue.id : "";
      setRetrievalState({
        status: "queued",
        operationId: typeof data?.operationId === "string" ? data.operationId : null,
        issueRef: issueIdentifier || issueId || null,
        channel: typeof data?.channel === "string" ? data.channel : null,
        answer: "",
        sourceRefs: [],
        streamStatus: typeof data?.channel === "string" ? "connecting" : "done",
        streamMessage: typeof data?.channel === "string" ? null : "SIM Wiki check queued.",
      });
    } catch (error) {
      setRetrievalState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not ask SIM Wiki.",
      });
    }
  }

  async function promoteWikiAnswerToWiki() {
    if (
      !scannerContext ||
      retrievalState.status !== "queued" ||
      !retrievalState.answer.trim() ||
      !simWikiPlugin ||
      !companyId
    ) {
      return;
    }

    const page = buildWikiAnswerPromotion(scannerContext, retrievalState);
    setAnswerPromotionState({ status: "saving" });
    try {
      const response = await pluginsApi.bridgePerformAction(
        simWikiPlugin.id,
        "write-page",
        {
          companyId,
          wikiId: "default",
          spaceSlug: "default",
          path: page.path,
          contents: page.contents,
          summary: "Promoted SIM Wiki answer from SIM Coach",
          sourceRefs: [
            {
              kind: "sim-wiki-query",
              issueRef: retrievalState.issueRef,
              operationId: retrievalState.operationId,
            },
            ...collectWikiAnswerSources(retrievalState.answer, retrievalState.sourceRefs).map((source) => ({
              kind: "sim-wiki-answer-source",
              sourceKind: source.kind,
              path: source.path,
            })),
            { kind: "simone-bottleneck-scan", artifact: scannerContext.artifact },
          ],
        },
        companyId
      );
      const data = response.data as { path?: unknown } | undefined;
      setAnswerPromotionState({ status: "saved", path: typeof data?.path === "string" ? data.path : page.path });
    } catch (error) {
      setAnswerPromotionState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not save answer to SIM Wiki.",
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-6">
      <section className="flex flex-col gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BookOpenCheck className="h-4 w-4" />
              <span>SIM Coach</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
              Shape {companyName} before assigning agents.
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start from a legible operating map, let agents draft and research, then pause at the
              moments where human judgment protects the company.
            </p>
          </div>
          <div className="flex gap-2">
            <span
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium",
                simWikiReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              {simWikiReady ? "SIM Wiki ready" : "SIM Wiki not enabled"}
            </span>
            <Button asChild size="sm" className="h-8">
              <Link to="/teams-catalog/paperclipai%3Abundled%3Asimone%3Asimone-starter">
                Starter
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to={simWikiReady ? "/wiki" : SIM_WIKI_FOCUS_ROUTE}>
                {simWikiReady ? "Open SIM Wiki" : "Enable SIM Wiki"}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {scannerContext ? (
        <section className="grid gap-4 border-b border-border pb-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>From your scanner result</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{scannerContext.headline}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Plain English: signal needs a decision, a decision needs an owner, and the answer
              needs a place to live.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                {scannerContext.engine}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                {scannerContext.artifact}
              </span>
              {scannerContext.firstSection ? (
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {scannerContext.firstSection}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Why SIM cares</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                SimOne keeps the useful question close to the work: what should move, who says yes,
                and where the decision becomes memory for the team.
              </p>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-xs">
                <Link to={simWikiReady ? "/wiki" : SIM_WIKI_FOCUS_ROUTE}>Learn why</Link>
              </Button>
            </div>
            {methodologyContext ? (
              <div className="rounded-md border border-border bg-background/60 p-3">
                <div className="text-xs font-medium uppercase text-muted-foreground">Method underneath</div>
                <h3 className="mt-2 text-sm font-medium text-foreground">{methodologyContext.concept}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{methodologyContext.idea}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{methodologyContext.useWhen}</p>
              </div>
            ) : null}
            {scannerContext.questions.length > 0 ? (
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {scannerContext.questions.map((question) => (
                  <li key={question} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {simWikiReady && wikiRetrievalQuestion ? (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-medium text-foreground">Retrieve from SIM Wiki</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Before stronger advice, ask the wiki to check saved method pages, venture memory,
                  and prior promoted syntheses.
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Ask: {wikiRetrievalQuestion}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={queueWikiRetrieval}
                    disabled={retrievalState.status === "starting"}
                  >
                    {retrievalState.status === "starting" ? "Asking..." : "Ask SIM Wiki now"}
                  </Button>
                  <Button asChild variant="link" size="sm" className="h-8 px-0 text-xs">
                    <Link to="/wiki/query">Open Ask tab</Link>
                  </Button>
                </div>
                {retrievalState.status === "queued" ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-emerald-700 dark:text-emerald-200">
                      <span>SIM Wiki check queued</span>
                      {retrievalState.issueRef ? <span>Maintainer task: {retrievalState.issueRef}</span> : null}
                      {retrievalState.issueRef ? (
                        <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                          <Link to={`/issues/${retrievalState.issueRef}`}>Open maintainer task</Link>
                        </Button>
                      ) : null}
                    </div>
                    {retrievalState.answer ? (
                      <div className="rounded-md border border-emerald-500/20 bg-background/70 p-3">
                        <h4 className="text-xs font-medium uppercase text-emerald-700 dark:text-emerald-200">
                          SIM Wiki answer
                        </h4>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {retrievalState.answer.trim()}
                        </p>
                        {wikiAnswerSources.length > 0 ? (
                          <div className="mt-3 rounded-md border border-border bg-muted/30 p-2.5">
                            <div className="text-xs font-medium uppercase text-muted-foreground">
                              Sources mentioned
                            </div>
                            <ul className="mt-2 grid gap-1 text-xs leading-5 text-muted-foreground">
                              {wikiAnswerSources.map((source) => (
                                <li key={`${source.kind}:${source.path}`}>
                                  {source.kind === "wiki-page" ? (
                                    <Link className="text-primary underline-offset-4 hover:underline" to={`/wiki/page/${source.path}`}>
                                      {source.path}
                                    </Link>
                                  ) : (
                                    <span>{source.path}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={promoteWikiAnswerToWiki}
                            disabled={answerPromotionState.status === "saving"}
                          >
                            {answerPromotionState.status === "saving"
                              ? "Saving answer..."
                              : "Save answer to SIM Wiki"}
                          </Button>
                        </div>
                        {answerPromotionState.status === "saved" ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs leading-5 text-emerald-700 dark:text-emerald-200">
                            <span>Saved answer to SIM Wiki: {answerPromotionState.path}</span>
                            <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                              <Link to={`/wiki/page/${answerPromotionState.path}`}>Open saved answer</Link>
                            </Button>
                          </div>
                        ) : null}
                        {answerPromotionState.status === "error" ? (
                          <p className="mt-2 text-xs leading-5 text-destructive">
                            {answerPromotionState.message}
                          </p>
                        ) : null}
                      </div>
                    ) : retrievalState.streamStatus === "connecting" || retrievalState.streamStatus === "running" ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        SIM Wiki Maintainer is checking memory.
                      </p>
                    ) : null}
                    {retrievalState.streamMessage ? (
                      <p
                        className={cn(
                          "text-xs leading-5",
                          retrievalState.streamStatus === "error"
                            ? "text-destructive"
                            : "text-emerald-700 dark:text-emerald-200"
                        )}
                      >
                        {retrievalState.streamMessage}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {retrievalState.status === "error" ? (
                  <p className="mt-2 text-xs leading-5 text-destructive">{retrievalState.message}</p>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="h-8">
                <Link to="/teams-catalog/paperclipai%3Abundled%3Asimone%3Asimone-starter">
                  Turn this into Sprint Zero
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              {simWikiReady && companyId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={promoteScannerToWiki}
                  disabled={promotionState.status === "saving"}
                >
                  {promotionState.status === "saving" ? "Saving..." : "Save to SIM Wiki"}
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link to="/scanner">Run scanner again</Link>
              </Button>
            </div>
            {promotionState.status === "saved" ? (
              <div className="flex flex-wrap items-center gap-2 text-xs leading-5 text-emerald-700 dark:text-emerald-200">
                <span>Saved to SIM Wiki: {promotionState.path}</span>
                <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                  <Link to={`/wiki/page/${promotionState.path}`}>Open saved page</Link>
                </Button>
              </div>
            ) : null}
            {promotionState.status === "error" ? (
              <p className="text-xs leading-5 text-destructive">{promotionState.message}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Start State</h2>
          </div>
          {setupOptions.map((option) => (
            <div key={option.title} className="flex flex-col gap-3 border-b border-border py-4 first:pt-1 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{option.title}</div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{option.body}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {option.label}
                </span>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 w-fit">
                <Link to={option.href}>{option.action}</Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Starter SIM Map</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              Draft
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{driverText}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {engines.map((engine) => {
              const Icon = engine.icon;
              return (
                <div key={engine.name} className="border-b border-border py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-md p-1.5", engine.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{engine.name} Engine</div>
                      <div className="text-xs text-muted-foreground">{engine.summary}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Approval Boundaries</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {reviewBoundaries.map((boundary) => (
              <span key={boundary} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                {boundary}
              </span>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Research and drafting can move quickly. These boundaries turn into approval moments
            before agents change the shape of the business.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-semibold text-foreground">Coach Nudges</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {coachNotes.map((note) => (
              <div key={note.title} className="flex gap-3 border-b border-border py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium text-foreground">{note.title}</div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{note.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Coach Loop</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {resolvedCoachFlow.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">{step.title}</div>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{step.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">SIM Wiki Seed Map</h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This keeps SIM understandable without hiding where the knowledge came from.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link to={simWikiReady ? "/wiki" : SIM_WIKI_FOCUS_ROUTE}>
              {simWikiReady ? "Open SIM Wiki" : "Enable SIM Wiki"}
            </Link>
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {simWikiSeedMap.map((item) => (
            <div key={item.title} className="border-b border-border pb-4">
              <div className="text-sm font-medium text-foreground">{item.title}</div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
