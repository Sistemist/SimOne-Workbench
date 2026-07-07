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
};

const SCAN_STORAGE_KEY = "simone:bottleneck-scan";

const fallbackResult: ScannerResult = {
  headline: "Feedback loop is unclear",
  engine: "Product Engine",
  severity: "medium",
  reason: "The note has a goal, but the system that turns feedback into a decision is not visible yet.",
  nextAction: "Write down the next customer decision and who approves it.",
  watches: "SimOne would watch for missing feedback, ownership, and approval boundaries.",
};

const patterns: Array<{
  engine: ScannerResult["engine"];
  headline: string;
  keywords: string[];
  reason: string;
  nextAction: string;
  watches: string;
}> = [
  {
    engine: "Customer Engine",
    headline: "Customer loop is leaking",
    keywords: ["lead", "customer", "reply", "waitlist", "prospect", "follow-up", "follow up", "inbox"],
    reason: "Customer signal exists, but it is not moving through one trusted review loop.",
    nextAction: "Make one review queue for replies, prospects, and proof points.",
    watches: "SimOne would watch the handoff from signal to human approval to durable memory.",
  },
  {
    engine: "Cash Engine",
    headline: "Cash pressure is steering the system",
    keywords: ["cash", "burn", "revenue", "pricing", "runway", "sales", "paid", "budget"],
    reason: "The business constraint is financial, but the next pricing or revenue decision is not explicit.",
    nextAction: "Name the next money decision and the evidence needed to make it.",
    watches: "SimOne would watch budget pressure, pricing assumptions, and approval thresholds.",
  },
  {
    engine: "Skills Engine",
    headline: "Capacity is the constraint",
    keywords: ["hire", "hiring", "team", "capacity", "manual", "ops", "skills", "overwhelmed"],
    reason: "The work depends on people or skills that are not yet mapped to a clear operating role.",
    nextAction: "List the recurring work and assign one accountable role for the next week.",
    watches: "SimOne would watch ownership, missing skills, and work that keeps bouncing back to the founder.",
  },
  {
    engine: "Product Engine",
    headline: "Product direction is diffused",
    keywords: ["feature", "roadmap", "product", "prototype", "launch", "scope", "positioning"],
    reason: "The product surface is moving, but the next sharp decision is not anchored to customer evidence.",
    nextAction: "Pick one user promise and one proof point that would make it believable.",
    watches: "SimOne would watch product promises, proof, and the approval point before building more.",
  },
];

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

  return {
    headline: best.pattern.headline,
    engine: best.pattern.engine,
    severity: best.score > 2 ? "high" : "medium",
    reason: best.pattern.reason,
    nextAction: best.pattern.nextAction,
    watches: best.pattern.watches,
  };
}

export function SystemsBottleneckScanner() {
  const [startupUrl, setStartupUrl] = useState("");
  const [founderNote, setFounderNote] = useState("");
  const [result, setResult] = useState<ScannerResult | null>(null);
  const canScan = useMemo(
    () => startupUrl.trim().length > 0 || founderNote.trim().length > 0,
    [startupUrl, founderNote],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canScan) return;
    const nextResult = scanBottleneck(`${startupUrl}\n${founderNote}`);
    setResult(nextResult);
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
                <div className="border-l border-border pl-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Next action
                  </div>
                  <p className="mt-1 text-sm font-medium">{result.nextAction}</p>
                </div>
                <div className="border-l border-border pl-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    What SimOne would watch
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{result.watches}</p>
                </div>
                <a
                  href="/auth?next=%2Fonboarding"
                  className="inline-flex h-9 w-fit items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create the full SimOne map
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
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
