import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Check,
  Circle,
  CirclePause,
  Play,
  RotateCcw,
} from "lucide-react";
import type {
  SimCycle,
  DelegatedSimCycleIntervention,
  SimCyclePhase,
  SimEngine,
  VentureSourceRef,
  VentureStateRevision,
} from "@paperclipai/shared";
import { founderCockpitApi } from "@/api/founderCockpit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/queryKeys";

const PHASES: Array<{ key: Exclude<SimCyclePhase, "complete">; label: string; entry: string; output: string }> = [
  {
    key: "map",
    label: "MAP",
    entry: "Founder starts deliberately under an active Constitution.",
    output: "One current four-engine venture map with source evidence.",
  },
  {
    key: "diagnose",
    label: "DIAGNOSE",
    entry: "A current venture map exists.",
    output: "One accepted or rejected constraint hypothesis with evidence.",
  },
  {
    key: "leverage",
    label: "LEVERAGE",
    entry: "The founder accepts one constraint.",
    output: "One bounded intervention, success signal, and commitment.",
  },
  {
    key: "compound",
    label: "COMPOUND",
    entry: "The intervention has a founder commitment.",
    output: "Outcome evidence and one promoted learning.",
  },
];

const ENGINE_LABELS: Record<SimEngine, string> = {
  product: "Product",
  customer: "Customer",
  cash: "Cash",
  skills: "Skills",
};

const phaseIndex = (phase: SimCyclePhase) =>
  phase === "complete" ? PHASES.length : PHASES.findIndex((item) => item.key === phase);

function SourceRefInput({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        placeholder="Name the note, interview, metric, or reviewed source"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function EngineSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: SimEngine;
  onChange: (value: SimEngine) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as SimEngine)}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {Object.entries(ENGINE_LABELS).map(([key, label]) => (
        <option value={key} key={key}>{label}</option>
      ))}
    </select>
  );
}

function PhaseRail({ cycle }: { cycle: SimCycle | null }) {
  const currentIndex = cycle ? phaseIndex(cycle.phase) : -1;
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {PHASES.map((phase, index) => {
        const completed = currentIndex > index;
        const current = currentIndex === index;
        return (
          <div
            key={phase.key}
            className={
              current
                ? "border border-primary bg-primary/5 p-3"
                : "border border-border bg-background p-3"
            }
          >
            <div className="flex items-center gap-2">
              {completed ? <Check className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className="text-xs font-semibold tracking-[0.16em]">{phase.label}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{phase.output}</p>
          </div>
        );
      })}
    </div>
  );
}

function MapPhase({
  companyId,
  cycle,
  currentState,
  run,
  busy,
}: {
  companyId: string;
  cycle: SimCycle;
  currentState: VentureStateRevision | null;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [ventureSummary, setVentureSummary] = useState(currentState?.content.ventureSummary ?? "");
  const [product, setProduct] = useState(currentState?.content.engines.product.summary ?? "");
  const [customer, setCustomer] = useState(currentState?.content.engines.customer.summary ?? "");
  const [cash, setCash] = useState(currentState?.content.engines.cash.summary ?? "");
  const [skills, setSkills] = useState(currentState?.content.engines.skills.summary ?? "");
  const [sourceLabel, setSourceLabel] = useState("Founder MAP review");
  const ready = [ventureSummary, product, customer, cash, skills, sourceLabel].every((value) => value.trim());

  async function submit() {
    const now = new Date().toISOString();
    const evidence: VentureSourceRef[] = [{
      kind: "founder_map",
      label: sourceLabel.trim(),
      capturedAt: now,
    }];
    await run(() =>
      founderCockpitApi.submitCycleMap(companyId, cycle.id, {
        content: {
          ventureSummary: ventureSummary.trim(),
          engines: {
            product: { summary: product.trim(), evidence, freshness: now },
            customer: { summary: customer.trim(), evidence, freshness: now },
            cash: { summary: cash.trim(), evidence, freshness: now },
            skills: { summary: skills.trim(), evidence, freshness: now },
          },
          activeConstraint: null,
          nextMove: null,
          learnings: currentState?.content.learnings ?? [],
          refreshedAt: now,
        },
        sourceRefs: evidence,
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-primary pl-4">
        <p className="text-sm font-medium">Entry condition</p>
        <p className="text-sm text-muted-foreground">{PHASES[0].entry}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cycle-venture-summary">Venture summary</Label>
        <Textarea id="cycle-venture-summary" value={ventureSummary} onChange={(event) => setVentureSummary(event.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {([
          ["Product", product, setProduct],
          ["Customer", customer, setCustomer],
          ["Cash", cash, setCash],
          ["Skills", skills, setSkills],
        ] as const).map(([label, value, setter]) => (
          <div className="space-y-2" key={label}>
            <Label htmlFor={`cycle-map-${label.toLowerCase()}`}>{label} state</Label>
            <Textarea
              id={`cycle-map-${label.toLowerCase()}`}
              value={value}
              onChange={(event) => setter(event.target.value)}
            />
          </div>
        ))}
      </div>
      <SourceRefInput
        id="cycle-map-source"
        label="Reviewed map source"
        value={sourceLabel}
        onChange={setSourceLabel}
        required
      />
      <Button disabled={!ready || busy} onClick={submit}>
        Complete MAP and continue
      </Button>
    </div>
  );
}

function DiagnosePhase({
  companyId,
  cycle,
  run,
  busy,
}: {
  companyId: string;
  cycle: SimCycle;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const previous = cycle.diagnoseOutput?.constraint;
  const [engine, setEngine] = useState<SimEngine>(previous?.engine ?? "product");
  const [hypothesis, setHypothesis] = useState(previous?.hypothesis ?? "");
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">(previous?.confidence ?? "medium");
  const [sourceLabel, setSourceLabel] = useState(previous?.evidence[0]?.label ?? "");
  const [decisionNote, setDecisionNote] = useState(previous?.decisionNote ?? "");
  const ready = [hypothesis, sourceLabel, decisionNote].every((value) => value.trim());

  async function decide(decision: "accepted" | "rejected") {
    await run(() =>
      founderCockpitApi.decideCycleDiagnosis(companyId, cycle.id, {
        engine,
        hypothesis: hypothesis.trim(),
        confidence,
        evidence: [{ kind: "diagnosis_evidence", label: sourceLabel.trim(), capturedAt: new Date().toISOString() }],
        decision,
        decisionNote: decisionNote.trim(),
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-primary pl-4">
        <p className="text-sm font-medium">Entry condition</p>
        <p className="text-sm text-muted-foreground">{PHASES[1].entry}</p>
      </div>
      {previous?.decision === "rejected" ? (
        <div className="border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          The previous hypothesis was rejected. Revise it or choose another engine; the cycle remains in DIAGNOSE.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cycle-diagnose-engine">Constraint engine</Label>
          <EngineSelect id="cycle-diagnose-engine" value={engine} onChange={setEngine} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cycle-diagnose-confidence">Confidence</Label>
          <select
            id="cycle-diagnose-confidence"
            value={confidence}
            onChange={(event) => setConfidence(event.target.value as typeof confidence)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cycle-diagnose-hypothesis">Constraint hypothesis</Label>
        <Textarea id="cycle-diagnose-hypothesis" value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} />
      </div>
      <SourceRefInput
        id="cycle-diagnose-source"
        label="Evidence supporting or challenging this hypothesis"
        value={sourceLabel}
        onChange={setSourceLabel}
        required
      />
      <div className="space-y-2">
        <Label htmlFor="cycle-diagnose-note">Founder decision note</Label>
        <Textarea id="cycle-diagnose-note" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!ready || busy} onClick={() => decide("rejected")}>
          Reject hypothesis
        </Button>
        <Button disabled={!ready || busy} onClick={() => decide("accepted")}>
          Accept constraint and continue
        </Button>
      </div>
    </div>
  );
}

function LeveragePhase({
  companyId,
  cycle,
  run,
  busy,
}: {
  companyId: string;
  cycle: SimCycle;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [engine, setEngine] = useState<SimEngine>(cycle.diagnoseOutput?.constraint.engine ?? "product");
  const [successSignal, setSuccessSignal] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [commitmentNote, setCommitmentNote] = useState("");
  const ready = [title, rationale, successSignal, commitmentNote].every((value) => value.trim());

  async function submit() {
    await run(() =>
      founderCockpitApi.commitCycleLeverage(companyId, cycle.id, {
        title: title.trim(),
        rationale: rationale.trim(),
        engine,
        successSignal: successSignal.trim(),
        approvalRequired,
        evidence: sourceLabel.trim()
          ? [{ kind: "intervention_evidence", label: sourceLabel.trim(), capturedAt: new Date().toISOString() }]
          : [],
        commitmentNote: commitmentNote.trim(),
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-primary pl-4">
        <p className="text-sm font-medium">Entry condition</p>
        <p className="text-sm text-muted-foreground">{PHASES[2].entry}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cycle-leverage-title">Bounded intervention</Label>
          <Input id="cycle-leverage-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cycle-leverage-engine">Intervention engine</Label>
          <EngineSelect id="cycle-leverage-engine" value={engine} onChange={setEngine} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cycle-leverage-rationale">Why this lever</Label>
        <Textarea id="cycle-leverage-rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cycle-leverage-signal">Success signal</Label>
        <Textarea id="cycle-leverage-signal" value={successSignal} onChange={(event) => setSuccessSignal(event.target.value)} />
      </div>
      <SourceRefInput
        id="cycle-leverage-source"
        label="Intervention source (optional)"
        value={sourceLabel}
        onChange={setSourceLabel}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={approvalRequired}
          onChange={(event) => setApprovalRequired(event.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="font-medium">Consequential approval gate</span>
          <span className="block text-muted-foreground">Keep the next move visibly founder-approved.</span>
        </span>
      </label>
      <div className="space-y-2">
        <Label htmlFor="cycle-leverage-note">Founder commitment note</Label>
        <Textarea id="cycle-leverage-note" value={commitmentNote} onChange={(event) => setCommitmentNote(event.target.value)} />
      </div>
      <Button disabled={!ready || busy} onClick={submit}>
        Commit intervention and continue
      </Button>
    </div>
  );
}

function CompoundPhase({
  companyId,
  cycle,
  run,
  busy,
}: {
  companyId: string;
  cycle: SimCycle;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [delegated, setDelegated] = useState<DelegatedSimCycleIntervention | null>(null);
  const [delegating, setDelegating] = useState(false);
  const [delegationError, setDelegationError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [learning, setLearning] = useState("");
  const [nextTitle, setNextTitle] = useState("");
  const [nextRationale, setNextRationale] = useState("");
  const [nextEngine, setNextEngine] = useState<SimEngine>("product");
  const [nextApproval, setNextApproval] = useState(false);
  const ready = [outcome, sourceLabel, learning, nextTitle, nextRationale].every((value) => value.trim());

  async function delegateIntervention() {
    setDelegating(true);
    setDelegationError(null);
    try {
      setDelegated(await founderCockpitApi.delegateCycleIntervention(companyId, cycle.id));
    } catch (cause) {
      setDelegationError(cause instanceof Error ? cause.message : "The bounded task could not be created.");
    } finally {
      setDelegating(false);
    }
  }

  async function submit() {
    await run(() =>
      founderCockpitApi.completeCycleCompound(companyId, cycle.id, {
        outcome: outcome.trim(),
        evidence: [{ kind: "cycle_outcome", label: sourceLabel.trim(), capturedAt: new Date().toISOString() }],
        learning: learning.trim(),
        nextMove: {
          title: nextTitle.trim(),
          rationale: nextRationale.trim(),
          engine: nextEngine,
          approvalRequired: nextApproval,
        },
      }),
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-l-2 border-primary pl-4">
        <p className="text-sm font-medium">Entry condition</p>
        <p className="text-sm text-muted-foreground">{PHASES[3].entry}</p>
      </div>
      {cycle.leverageOutput ? (
        <section aria-label="Delegate committed intervention" className="border border-border bg-muted/20 p-4">
          <p className="font-medium">Promote the committed intervention into bounded work</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This creates one unassigned backlog task pinned to the cycle&apos;s exact Context Projection.
            It does not start an agent or make a model call.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy || delegating}
              onClick={delegateIntervention}
            >
              {delegating ? "Creating bounded task…" : delegated ? "Refresh task link" : "Create bounded task"}
            </Button>
            {delegated ? (
              <Link
                className="text-sm font-medium text-primary underline underline-offset-4"
                to={`/issues/${delegated.issue.identifier ?? delegated.issue.id}`}
              >
                Open {delegated.issue.identifier ?? "delegated task"}
              </Link>
            ) : null}
          </div>
          <div aria-live="polite" role="status" className="mt-2 text-sm">
            {delegated
              ? `Task ${delegated.issue.identifier ?? delegated.issue.id} is ${delegated.issue.status} and unassigned.`
              : delegationError}
          </div>
        </section>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="cycle-compound-outcome">Observed outcome</Label>
        <Textarea id="cycle-compound-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
      </div>
      <SourceRefInput
        id="cycle-compound-source"
        label="Outcome evidence"
        value={sourceLabel}
        onChange={setSourceLabel}
        required
      />
      <div className="space-y-2">
        <Label htmlFor="cycle-compound-learning">Learning to promote</Label>
        <Textarea id="cycle-compound-learning" value={learning} onChange={(event) => setLearning(event.target.value)} />
      </div>
      <div className="border-t border-border pt-5">
        <p className="mb-4 text-sm font-medium">Next bounded move after this cycle</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cycle-compound-next-title">Next move</Label>
            <Input id="cycle-compound-next-title" value={nextTitle} onChange={(event) => setNextTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-compound-next-engine">Engine</Label>
            <EngineSelect id="cycle-compound-next-engine" value={nextEngine} onChange={setNextEngine} />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="cycle-compound-next-rationale">Why this follows</Label>
          <Textarea
            id="cycle-compound-next-rationale"
            value={nextRationale}
            onChange={(event) => setNextRationale(event.target.value)}
          />
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={nextApproval}
            onChange={(event) => setNextApproval(event.target.checked)}
          />
          Next move requires founder approval
        </label>
      </div>
      <Button disabled={!ready || busy} onClick={submit}>
        Promote evidence and complete cycle
      </Button>
    </div>
  );
}

export function GuidedSimCycle({
  companyId,
  cycle,
  currentState,
  constitutionActive,
}: {
  companyId: string;
  cycle: SimCycle | null;
  currentState: VentureStateRevision | null;
  constitutionActive: boolean;
}) {
  const queryClient = useQueryClient();
  const [startReason, setStartReason] = useState("Run one deliberate founder-triggered SIM Cycle.");
  const [pauseReason, setPauseReason] = useState("Pause and preserve the current phase for later.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventsQuery = useQuery({
    queryKey: queryKeys.founderCockpit.cycleEvents(companyId, cycle?.id ?? "__none__"),
    queryFn: () => founderCockpitApi.cycleEvents(companyId, cycle!.id),
    enabled: Boolean(cycle),
  });

  useEffect(() => {
    setError(null);
  }, [cycle?.phase, cycle?.status]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.founderCockpit.snapshot(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.founderCockpit.stateRevisions(companyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.founderCockpit.contextProjections(companyId) }),
      cycle
        ? queryClient.invalidateQueries({ queryKey: queryKeys.founderCockpit.cycleEvents(companyId, cycle.id) })
        : Promise.resolve(),
    ]);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The SIM Cycle action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Guided SIM Cycle</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Founder-triggered and resumable. No autonomous schedule and no model call.
            </p>
          </div>
          {cycle ? (
            <div className="flex items-center gap-2">
              <Badge variant={cycle.status === "paused" ? "outline" : "default"}>{cycle.status}</Badge>
              <Badge variant="secondary">{cycle.phase.toUpperCase()}</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <PhaseRail cycle={cycle} />
        {!cycle ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cycle-start-reason">Why start this cycle now?</Label>
              <Textarea
                id="cycle-start-reason"
                value={startReason}
                onChange={(event) => setStartReason(event.target.value)}
              />
            </div>
            <Button
              disabled={!constitutionActive || !startReason.trim() || busy}
              onClick={() => run(() => founderCockpitApi.startCycle(companyId, { startReason: startReason.trim() }))}
            >
              <Play className="h-4 w-4" />
              Start guided cycle
            </Button>
            {!constitutionActive ? (
              <p className="text-sm text-amber-700">Activate a Venture Constitution first.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 border-y border-border py-4">
              {cycle.status === "paused" ? (
                <Button
                  disabled={busy}
                  onClick={() => run(() => founderCockpitApi.resumeCycle(companyId, cycle.id))}
                >
                  <RotateCcw className="h-4 w-4" />
                  Resume {cycle.phase.toUpperCase()}
                </Button>
              ) : (
                <>
                  <div className="min-w-[260px] flex-1 space-y-2">
                    <Label htmlFor="cycle-pause-reason">Pause reason</Label>
                    <Input
                      id="cycle-pause-reason"
                      value={pauseReason}
                      onChange={(event) => setPauseReason(event.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy || !pauseReason.trim()}
                    onClick={() =>
                      run(() =>
                        founderCockpitApi.pauseCycle(companyId, cycle.id, { reason: pauseReason.trim() }),
                      )
                    }
                  >
                    <CirclePause className="h-4 w-4" />
                    Pause cycle
                  </Button>
                </>
              )}
            </div>

            {cycle.status === "paused" ? (
              <div className="border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                <p className="font-medium">Cycle paused in {cycle.phase.toUpperCase()}</p>
                <p className="mt-1 text-sm text-muted-foreground">{cycle.pausedReason}</p>
              </div>
            ) : cycle.phase === "map" ? (
              <MapPhase companyId={companyId} cycle={cycle} currentState={currentState} run={run} busy={busy} />
            ) : cycle.phase === "diagnose" ? (
              <DiagnosePhase companyId={companyId} cycle={cycle} run={run} busy={busy} />
            ) : cycle.phase === "leverage" ? (
              <LeveragePhase companyId={companyId} cycle={cycle} run={run} busy={busy} />
            ) : cycle.phase === "compound" ? (
              <CompoundPhase companyId={companyId} cycle={cycle} run={run} busy={busy} />
            ) : null}
          </>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {cycle && (eventsQuery.data?.length ?? 0) > 0 ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Cycle evidence trail ({eventsQuery.data?.length})
            </summary>
            <div className="mt-3 space-y-2 border-l border-border pl-4">
              {eventsQuery.data?.map((event) => (
                <div key={event.id} className="text-sm">
                  <span className="font-medium">{event.type.replaceAll("_", " ")}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
