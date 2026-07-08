import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Gauge, Radar, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScannerResult = {
  headline: string;
  engine: "Product Engine" | "Customer Engine" | "Cash Engine" | "Skills Engine";
  severity: "medium" | "high";
  reason: string;
  nextAction: string;
  watches: string;
  signalStrength: {
    primaryMatches: number;
    summary: string;
    secondaryEngine?: ScannerResult["engine"];
    secondaryMatches?: number;
    secondarySummary?: string;
  };
  calibration: {
    status: "early_pattern_match";
    label: string;
    summary: string;
    reviewNeeded: boolean;
    publicSummaryExcludes: Array<"founderNote" | "startupUrl">;
  };
  diagnosisSignals: string[];
  questions: string[];
  mapPreview: {
    artifact: "Venture Architecture Map";
    primaryEngine: ScannerResult["engine"];
    firstSection: string;
  };
  sprintZeroBrief: {
    clear: string[];
    needsProof: string[];
    humanReview: string[];
    firstMove: string;
  };
  approvalPath: {
    doNow: string;
    needsHumanYes: string;
    carryForward: string;
  };
  shareSummary: {
    title: string;
    publicText: string;
    excludes: Array<"founderNote" | "startupUrl">;
  };
  conversionPath: {
    title: string;
    summary: string;
    primaryCta: string;
    onboardingHref: string;
  };
  handoffPreview: {
    title: string;
    items: string[];
  };
  trustFrame: {
    canSee: string;
    cannotSee: string;
    stillUseful: string;
  };
};

const SCAN_STORAGE_KEY = "simone:bottleneck-scan";
const SCANNER_COACH_HREF = `/auth?next=${encodeURIComponent("/sim-coach?from=scanner")}`;

const scannerExamples = [
  {
    label: "Customer follow-up",
    note: "We have interested leads and waitlist replies, but follow-up is scattered and approvals sit in my inbox.",
  },
  {
    label: "Cash runway",
    note: "Our runway is getting tight, pricing keeps changing, and I am not sure which paid offer needs approval next.",
  },
  {
    label: "Skills capacity",
    note: "The same manual ops work keeps coming back to me, the team is overwhelmed, and I do not know who should own it.",
  },
  {
    label: "Product proof",
    note: "The roadmap has too many feature ideas, the prototype keeps expanding, and we need one promise we can prove before launch.",
  },
];

const fallbackResult: ScannerResult = {
  headline: "Feedback loop is unclear",
  engine: "Product Engine",
  severity: "medium",
  reason: "The note has a goal, but the system that turns feedback into a decision is not visible yet.",
  nextAction: "Write down the next customer decision and who approves it.",
  watches: "SimOne would watch for missing feedback, ownership, and approval boundaries.",
  signalStrength: {
    primaryMatches: 0,
    summary: "A first signal was visible, but not enough signs pointed to one engine yet.",
  },
  calibration: {
    status: "early_pattern_match",
    label: "Early pattern match",
    summary: "Early pattern match. Real submission review still needed.",
    reviewNeeded: true,
    publicSummaryExcludes: ["founderNote", "startupUrl"],
  },
  diagnosisSignals: [
    "A goal or stuck point was present.",
    "The decision loop was not yet visible.",
    "Human approval should be made explicit.",
  ],
  questions: [
    "What decision is waiting for a human yes?",
    "What proof would make this worth doing now?",
    "Where should the answer be saved so it is not lost?",
  ],
  mapPreview: {
    artifact: "Venture Architecture Map",
    primaryEngine: "Product Engine",
    firstSection: "Decision loop",
  },
  sprintZeroBrief: {
    clear: [
      "Likely bottleneck: Feedback loop is unclear.",
      "Primary engine: Product Engine.",
      "The note has a goal, but the system that turns feedback into a decision is not visible yet.",
    ],
    needsProof: [
      "What proof would make this worth doing now?",
      "Show the next decision and one place where the answer will be saved.",
    ],
    humanReview: [
      "Approve the next decision before agents act.",
      "Keep customers, money, public claims, and company structure behind human review.",
    ],
    firstMove: "Write down the next customer decision and who approves it.",
  },
  approvalPath: {
    doNow: "Write down the next customer decision and who approves it.",
    needsHumanYes: "Approve the next decision before agents act.",
    carryForward: "Save this scan as Sprint Zero context after sign-in.",
  },
  shareSummary: {
    title: "Share this result",
    publicText:
      "Built with SimOne: Feedback loop is unclear. Focus: Product Engine. Next move: Write down the next customer decision and who approves it.",
    excludes: ["founderNote", "startupUrl"],
  },
  conversionPath: {
    title: "Turn this into a Product Engine map",
    summary:
      "SimOne will keep the product loop, proof question, and approval boundary together after sign-in.",
    primaryCta: "Build my Product Engine map",
    onboardingHref: `/auth?next=${encodeURIComponent("/onboarding?from=scanner&focus=product-engine")}`,
  },
  handoffPreview: {
    title: "What happens after sign-in",
    items: [
      "Prefill the starter map with this product loop readout.",
      "Create the first setup task: Write down the next customer decision and who approves it.",
      "Keep any customer, money, public-claim, or structure decision behind your approval.",
    ],
  },
  trustFrame: {
    canSee: "It read patterns in the text you provided.",
    cannotSee: "It did not crawl your site, inspect private tools, or verify the facts.",
    stillUseful: "It gives you one focused next question instead of a full-company diagnosis.",
  },
};

const patterns: Array<{
  engine: ScannerResult["engine"];
  headline: string;
  keywords: string[];
  reason: string;
  nextAction: string;
  watches: string;
  diagnosisSignals: string[];
  questions: string[];
  firstSection: string;
}> = [
  {
    engine: "Customer Engine",
    headline: "Customer loop is leaking",
    keywords: ["lead", "customer", "reply", "waitlist", "prospect", "follow-up", "follow up", "inbox"],
    reason: "Customer signal exists, but it is not moving through one trusted review loop.",
    nextAction: "Make one review queue for replies, prospects, and proof points.",
    watches: "SimOne would watch the handoff from signal to human approval to durable memory.",
    diagnosisSignals: [
      "Customer signal was present.",
      "Follow-up or inbox work looked scattered.",
      "Approval was part of the bottleneck.",
    ],
    questions: [
      "Who should approve the next customer reply or offer?",
      "What proof would make this worth doing now?",
      "Where should the answer be saved so it is not lost?",
    ],
    firstSection: "Customer review loop",
  },
  {
    engine: "Cash Engine",
    headline: "Cash pressure is steering the system",
    keywords: ["cash", "burn", "revenue", "pricing", "runway", "sales", "paid", "budget"],
    reason: "The business constraint is financial, but the next pricing or revenue decision is not explicit.",
    nextAction: "Name the next money decision and the evidence needed to make it.",
    watches: "SimOne would watch budget pressure, pricing assumptions, and approval thresholds.",
    diagnosisSignals: [
      "A money constraint was present.",
      "Pricing, runway, or revenue pressure appeared.",
      "The next financial decision needs human approval.",
    ],
    questions: [
      "Which money decision needs a human yes next?",
      "What proof would make this worth doing now?",
      "What number should SimOne keep visible each week?",
    ],
    firstSection: "Money decision loop",
  },
  {
    engine: "Skills Engine",
    headline: "Capacity is the constraint",
    keywords: ["hire", "hiring", "team", "capacity", "manual", "ops", "skills", "overwhelmed"],
    reason: "The work depends on people or skills that are not yet mapped to a clear operating role.",
    nextAction: "List the recurring work and assign one accountable role for the next week.",
    watches: "SimOne would watch ownership, missing skills, and work that keeps bouncing back to the founder.",
    diagnosisSignals: [
      "Capacity or recurring work pressure was present.",
      "Ownership looked unclear.",
      "The next role boundary needs to be named.",
    ],
    questions: [
      "Which recurring work keeps coming back to the founder?",
      "Who should own the next visible step?",
      "What proof would show this role is working?",
    ],
    firstSection: "Ownership loop",
  },
  {
    engine: "Product Engine",
    headline: "Product direction is diffused",
    keywords: ["feature", "roadmap", "product", "prototype", "launch", "scope", "positioning"],
    reason: "The product surface is moving, but the next sharp decision is not anchored to customer evidence.",
    nextAction: "Pick one user promise and one proof point that would make it believable.",
    watches: "SimOne would watch product promises, proof, and the approval point before building more.",
    diagnosisSignals: [
      "Product or positioning movement was present.",
      "The next user promise needs sharper proof.",
      "A build decision should wait for human review.",
    ],
    questions: [
      "Which user promise should be protected first?",
      "What proof would make this worth doing now?",
      "Who should approve the next product move?",
    ],
    firstSection: "Product proof loop",
  },
];

function engineFocusSlug(engine: ScannerResult["engine"]) {
  return engine.toLowerCase().replace(/\s+/g, "-");
}

function engineLoopLabel(engine: ScannerResult["engine"]) {
  if (engine === "Customer Engine") return "customer loop";
  if (engine === "Cash Engine") return "money loop";
  if (engine === "Skills Engine") return "capacity loop";
  return "product loop";
}

function scanBottleneck(input: string): ScannerResult {
  const normalized = input.toLowerCase();
  const scored = patterns
    .map((pattern) => ({
      pattern,
      score: pattern.keywords.reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (!best || best.score === 0) return fallbackResult;

  const secondary = scored.find(
    (candidate) => candidate.score > 0 && candidate.pattern.engine !== best.pattern.engine,
  );
  const severity: ScannerResult["severity"] = best.score > 2 ? "high" : "medium";
  const result: Omit<
    ScannerResult,
    "sprintZeroBrief" | "approvalPath" | "shareSummary" | "conversionPath" | "handoffPreview" | "trustFrame"
  > = {
    headline: best.pattern.headline,
    engine: best.pattern.engine,
    severity,
    reason: best.pattern.reason,
    nextAction: best.pattern.nextAction,
    watches: best.pattern.watches,
    signalStrength: {
      primaryMatches: best.score,
      summary: `${best.score} ${best.score === 1 ? "sign" : "signs"} pointed to ${best.pattern.engine}.`,
      secondaryEngine: secondary?.pattern.engine,
      secondaryMatches: secondary?.score,
      secondarySummary: secondary
        ? `${secondary.score} ${secondary.score === 1 ? "sign" : "signs"} pointed there.`
        : undefined,
    },
    calibration: {
      status: "early_pattern_match",
      label: "Early pattern match",
      summary: "Early pattern match. Real submission review still needed.",
      reviewNeeded: true,
      publicSummaryExcludes: ["founderNote", "startupUrl"],
    },
    diagnosisSignals: best.pattern.diagnosisSignals,
    questions: best.pattern.questions,
    mapPreview: {
      artifact: "Venture Architecture Map",
      primaryEngine: best.pattern.engine,
      firstSection: best.pattern.firstSection,
    },
  };
  return {
    ...result,
    sprintZeroBrief: {
      clear: [
        `Likely bottleneck: ${result.headline}.`,
        `Primary engine: ${result.engine}.`,
        result.reason,
      ],
      needsProof: [
        result.questions.find((question) => /proof/i.test(question)) ?? "What proof would make this worth doing now?",
        `Show the next signal in one review queue before scaling ${result.engine === "Customer Engine" ? "follow-up" : "the work"}.`,
      ],
      humanReview: [
        result.engine === "Customer Engine"
          ? "Approve the next customer-facing reply or offer before agents act."
          : "Approve the next judgment call before agents act.",
        "Keep customers, money, public claims, and company structure behind human review.",
      ],
      firstMove: result.nextAction,
    },
    approvalPath: {
      doNow: result.nextAction,
      needsHumanYes:
        result.engine === "Customer Engine"
          ? "Approve the next customer-facing reply or offer before agents act."
          : "Approve the next judgment call before agents act.",
      carryForward: "Save this scan as Sprint Zero context after sign-in.",
    },
    shareSummary: {
      title: "Share this result",
      publicText: `Built with SimOne: ${result.headline}. Focus: ${result.engine}. Next move: ${result.nextAction}`,
      excludes: ["founderNote", "startupUrl"],
    },
    conversionPath: {
      title: `Turn this into a ${result.engine} map`,
      summary: `SimOne will keep the ${engineLoopLabel(result.engine)}, proof question, and approval boundary together after sign-in.`,
      primaryCta: `Build my ${result.engine} map`,
      onboardingHref: `/auth?next=${encodeURIComponent(`/onboarding?from=scanner&focus=${engineFocusSlug(result.engine)}`)}`,
    },
    handoffPreview: {
      title: "What happens after sign-in",
      items: [
        `Prefill the starter map with this ${engineLoopLabel(result.engine)} readout.`,
        `Create the first setup task: ${result.nextAction}`,
        "Keep any customer, money, public-claim, or structure decision behind your approval.",
      ],
    },
    trustFrame: {
      canSee: "It read patterns in the text you provided.",
      cannotSee: "It did not crawl your site, inspect private tools, or verify the facts.",
      stillUseful: "It gives you one focused next question instead of a full-company diagnosis.",
    },
  };
}

export function SystemsBottleneckScanner() {
  const [startupUrl, setStartupUrl] = useState("");
  const [founderNote, setFounderNote] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const [shareSummaryCopied, setShareSummaryCopied] = useState(false);
  const canScan = useMemo(
    () => startupUrl.trim().length > 0 || founderNote.trim().length > 0,
    [startupUrl, founderNote],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canScan) return;
    const nextResult = scanBottleneck(`${startupUrl}\n${founderNote}`);
    setResult(nextResult);
    setShareSummaryCopied(false);
    try {
      window.localStorage.setItem(
        SCAN_STORAGE_KEY,
        JSON.stringify({
          input: {
            startupUrl: startupUrl.trim(),
            founderNote: founderNote.trim(),
          },
          result: nextResult,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // The scan remains useful even when private browsing or storage policy blocks persistence.
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Radar className="h-4 w-4" aria-hidden="true" />
              <span>SimOne</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
              Systems Bottleneck Scanner
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Paste a startup URL, a messy founder note, or both. SimOne will return one likely bottleneck and
              one next move.
            </p>
            <p className="mt-2 max-w-2xl text-sm font-medium text-foreground">
              Free first readout, protected full map after sign-in.
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use it when you can describe what feels stuck, but you are not ready to set up the whole company yet.
            </p>
          </div>
          <a
            href="/auth?next=%2Fonboarding"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Create full map
          </a>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Startup URL
                <input
                  name="startupUrl"
                  value={startupUrl}
                  onChange={(event) => setStartupUrl(event.target.value)}
                  placeholder="https://example.com"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Founder note
                <textarea
                  name="founderNote"
                  value={founderNote}
                  onChange={(event) => setFounderNote(event.target.value)}
                  placeholder="What feels stuck right now?"
                  rows={8}
                  className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              <div className="grid gap-2">
                <div className="text-xs font-medium uppercase text-muted-foreground">Example notes</div>
                <div className="flex flex-wrap gap-2">
                  {scannerExamples.map((example) => (
                    <Button
                      key={example.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFounderNote(example.note)}
                    >
                      {example.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canScan}>
                Scan
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Bounded first pass. No crawl, posting, or account setup.
              </span>
            </div>
          </form>

          <aside className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
            {result ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      result.severity === "high"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                        : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {result.severity === "high" ? "High signal" : "Medium signal"}
                  </span>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-200">
                    {result.engine}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{result.headline}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.reason}</p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Signal strength
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.signalStrength.summary}</p>
                  {result.signalStrength.secondaryEngine ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Also watch {result.signalStrength.secondaryEngine}
                      </span>
                      {result.signalStrength.secondarySummary ? `: ${result.signalStrength.secondarySummary}` : "."}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Calibration status
                  </div>
                  <p className="mt-1 text-sm font-medium">{result.calibration.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Real submission review still needed.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Public summary excludes raw notes and URLs.
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    What this scan can see
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.trustFrame.canSee}</p>
                  <div className="mt-3 text-xs font-medium uppercase text-muted-foreground">
                    What it cannot see yet
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.trustFrame.cannotSee}</p>
                  <div className="mt-3 text-xs font-medium uppercase text-muted-foreground">
                    Why it is still useful
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.trustFrame.stillUseful}</p>
                </div>
                <div className="border-l border-border pl-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Next action
                  </div>
                  <p className="mt-1 text-sm font-medium">{result.nextAction}</p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Decision path
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                    <div>
                      <h3 className="font-medium text-foreground">Do now</h3>
                      <p className="mt-1">{result.approvalPath.doNow}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Needs your yes</h3>
                      <p className="mt-1">{result.approvalPath.needsHumanYes}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Carry into SimOne</h3>
                      <p className="mt-1">{result.approvalPath.carryForward}</p>
                    </div>
                  </div>
                </div>
                <div className="border-l border-border pl-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    What SimOne would watch
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.watches}</p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Why this scan picked {result.engine}
                  </div>
                  <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
                    {result.diagnosisSignals.map((signal) => (
                      <li key={signal} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span>{signal}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This is a bounded first read, not a private-data audit.
                  </p>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Questions SimOne would ask next
                  </div>
                  <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
                    {result.questions.map((question) => (
                      <li key={question} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        <span>{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Starter map preview
                  </div>
                  <div className="mt-2 grid gap-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Artifact</span>
                      <span className="text-right font-medium">{result.mapPreview.artifact}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">First focus</span>
                      <span className="text-right font-medium">{result.mapPreview.primaryEngine}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Opening section</span>
                      <span className="text-right font-medium">{result.mapPreview.firstSection}</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Sprint Zero brief
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                    <div>
                      <h3 className="font-medium text-foreground">What is clear</h3>
                      <ul className="mt-1 grid gap-1">
                        {result.sprintZeroBrief.clear.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">What needs proof</h3>
                      <ul className="mt-1 grid gap-1">
                        {result.sprintZeroBrief.needsProof.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Human review boundary</h3>
                      <ul className="mt-1 grid gap-1">
                        {result.sprintZeroBrief.humanReview.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">First move</h3>
                      <p className="mt-1">- {result.sprintZeroBrief.firstMove}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {result.shareSummary.title}
                  </div>
                  <div className="mt-2 grid gap-3 text-sm text-muted-foreground">
                    <p>{result.shareSummary.publicText}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard?.writeText(result.shareSummary.publicText);
                          setShareSummaryCopied(true);
                        }}
                      >
                        Copy share summary
                      </Button>
                      <span className="text-xs">
                        {shareSummaryCopied
                          ? "Copied. Safe to share: raw notes and URLs stay out."
                          : "The share version leaves out raw notes and URLs."}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <h3 className="text-sm font-medium">{result.conversionPath.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {result.conversionPath.summary}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">
                      {result.handoffPreview.title}
                    </h3>
                    <ul className="mt-2 grid gap-2 text-sm text-muted-foreground">
                      {result.handoffPreview.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Coach explains the method before you assign work.
                  </p>
                  <a
                    href={SCANNER_COACH_HREF}
                    className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
                  >
                    Ask SIM Coach why
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Your scan will carry into SIM Starter after sign-in.
                  </p>
                  <a
                    href={result.conversionPath.onboardingHref}
                    className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {result.conversionPath.primaryCta}
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-64 flex-col justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Gauge className="h-4 w-4" aria-hidden="true" />
                    First readout
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">One bottleneck, one next move.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The full SimOne map comes after sign-in, when the work can be protected and turned into a
                    starter operating system.
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <h3 className="font-medium text-foreground">Public first read</h3>
                    <p className="mt-1">
                      No account needed. Get one bottleneck and one next move from the note you provide.
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <h3 className="font-medium text-foreground">Protected full map</h3>
                    <p className="mt-1">
                      Sign in when you want SimOne to save the scan, draft the starter map, and keep decisions behind approval.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Route className="h-4 w-4" aria-hidden="true" />
                    Product, Customer, Cash, or Skills
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Human judgment stays visible
                  </span>
                </div>
              </div>
            )}
          </aside>
        </section>

        <footer className="text-xs text-muted-foreground">
          Built with SimOne. The scanner gives a first read, not a diagnosis of your whole company.
        </footer>
      </div>
    </main>
  );
}
