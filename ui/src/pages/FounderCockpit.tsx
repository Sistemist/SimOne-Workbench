import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Compass,
  FileClock,
  Fingerprint,
  PauseCircle,
  RefreshCw,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import type {
  SimCycle,
  VentureStateRevision,
  VentureConstitutionContent,
  VentureConstitutionRevision,
} from "@paperclipai/shared";
import { founderCockpitApi } from "@/api/founderCockpit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GuidedSimCycle } from "@/components/GuidedSimCycle";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useSearchParams } from "@/lib/router";

const ENGINE_LABELS = {
  product: "Product",
  customer: "Customer",
  cash: "Cash",
  skills: "Skills",
} as const;

type DraftFields = {
  purpose: string;
  intendedImpact: string;
  customerPrinciples: string;
  qualityPrinciples: string;
  desiredVoice: string;
  voiceExamples: string;
  voiceCounterexamples: string;
  nonNegotiables: string;
  antiGoals: string;
  founderRights: string;
  delegatedRights: string;
  approvalBoundaries: string;
  financialRisk: string;
  securityRisk: string;
  privacyRisk: string;
  reputationalRisk: string;
  evidenceStandards: string;
  changeReason: string;
};

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function draftFromRevision(revision: VentureConstitutionRevision | null): DraftFields {
  const content = revision?.content;
  return {
    purpose: content?.purpose ?? "",
    intendedImpact: content?.intendedImpact ?? "",
    customerPrinciples: joinLines(content?.customerPrinciples ?? []),
    qualityPrinciples: joinLines(content?.qualityPrinciples ?? []),
    desiredVoice: joinLines(content?.voice.desired ?? []),
    voiceExamples: joinLines(content?.voice.examples ?? []),
    voiceCounterexamples: joinLines(content?.voice.counterexamples ?? []),
    nonNegotiables: joinLines(content?.nonNegotiables ?? []),
    antiGoals: joinLines(content?.antiGoals ?? []),
    founderRights: joinLines(content?.decisionRights.founder ?? []),
    delegatedRights: joinLines(content?.decisionRights.delegated ?? []),
    approvalBoundaries: joinLines(content?.decisionRights.approvalRequired ?? []),
    financialRisk: content?.riskTolerance.financial ?? "",
    securityRisk: content?.riskTolerance.security ?? "",
    privacyRisk: content?.riskTolerance.privacy ?? "",
    reputationalRisk: content?.riskTolerance.reputational ?? "",
    evidenceStandards: joinLines(content?.evidenceStandards ?? []),
    changeReason: revision
      ? `Revise Venture Constitution v${revision.version} for founder review.`
      : "Establish the first founder-approved Venture Constitution.",
  };
}

function contentFromDraft(draft: DraftFields): VentureConstitutionContent {
  return {
    purpose: draft.purpose.trim(),
    intendedImpact: draft.intendedImpact.trim(),
    customerPrinciples: splitLines(draft.customerPrinciples),
    qualityPrinciples: splitLines(draft.qualityPrinciples),
    voice: {
      desired: splitLines(draft.desiredVoice),
      examples: splitLines(draft.voiceExamples),
      counterexamples: splitLines(draft.voiceCounterexamples),
    },
    nonNegotiables: splitLines(draft.nonNegotiables),
    antiGoals: splitLines(draft.antiGoals),
    decisionRights: {
      founder: splitLines(draft.founderRights),
      delegated: splitLines(draft.delegatedRights),
      approvalRequired: splitLines(draft.approvalBoundaries),
    },
    riskTolerance: {
      financial: draft.financialRisk.trim(),
      security: draft.securityRisk.trim(),
      privacy: draft.privacyRisk.trim(),
      reputational: draft.reputationalRisk.trim(),
    },
    evidenceStandards: splitLines(draft.evidenceStandards),
  };
}

function formatTimestamp(value: string | Date | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div className="border-l border-border pl-4">
      <div className={tone === "warning" && value > 0 ? "text-2xl font-semibold text-amber-600" : "text-2xl font-semibold"}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}

function FounderPracticePath({
  activeRevision,
  currentDraft,
  state,
  activeCycle,
  latestCycle,
}: {
  activeRevision: VentureConstitutionRevision | null;
  currentDraft: VentureConstitutionRevision | null;
  state: VentureStateRevision | null;
  activeCycle: SimCycle | null;
  latestCycle: SimCycle | null;
}) {
  const completedCycle = latestCycle?.status === "completed";
  const phaseStep = activeCycle
    ? activeCycle.phase === "map"
      ? 0
      : activeCycle.phase === "diagnose"
        ? 1
        : activeCycle.phase === "leverage"
          ? 2
          : 3
    : state
      ? 1
      : 0;
  const currentStep = completedCycle ? 4 : phaseStep;
  const activePhaseLabel = activeCycle
    ? activeCycle.phase === "map"
      ? "DIAGNOSE"
      : activeCycle.phase === "diagnose"
        ? "DESIGN"
        : activeCycle.phase === "leverage"
          ? "OPERATE"
          : "REVIEW"
    : null;
  const steps = [
    {
      label: "Diagnose",
      detail: state ? `Venture picture v${state.version}` : "See the whole and find the active constraint",
    },
    {
      label: "Design",
      detail: "Choose one intervention and its success signal",
    },
    {
      label: "Operate",
      detail: activeCycle?.status === "paused" ? "Paused until you resume" : "Commit one bounded next move",
    },
    {
      label: "Review",
      detail: completedCycle ? "Outcome recorded and learning kept" : "Turn the outcome into evidence",
    },
  ];
  const action = !activeRevision
    ? {
        label: currentDraft ? "Review and activate draft" : "Draft the Constitution",
        href: currentDraft ? "#constitution-history" : "#venture-constitution",
        route: false,
      }
    : activeCycle
      ? {
          label: `${activeCycle.status === "paused" ? "Resume" : "Continue"} ${activePhaseLabel}`,
          href: "#guided-sim-cycle",
          route: false,
        }
      : completedCycle
        ? { label: "Open SIM Coach", href: "/sim-coach", route: true }
        : {
            label: state ? "Start the next guided cycle" : "Start the first guided cycle",
            href: "#guided-sim-cycle",
            route: false,
          };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Your operating practice</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Diagnose → design → operate → review. You decide when each step moves.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {completedCycle ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/routines?starter=sim-practice">
                  Make repeatable
                  <Repeat className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm">
              {action.route ? (
                <Link to={action.href}>
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <a href={action.href}>
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => {
            const complete = index < currentStep;
            const active = index === currentStep;
            return (
              <li
                key={step.label}
                aria-current={active ? "step" : undefined}
                className={`border-l-2 pl-3 ${complete ? "border-emerald-500" : active ? "border-primary" : "border-border"}`}
              >
                <div className="flex items-center gap-2">
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  )}
                  <span className="text-sm font-medium">{step.label}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function constitutionChangeLabels(
  revision: VentureConstitutionRevision,
  previous: VentureConstitutionRevision | null,
) {
  if (!previous) return ["Initial Constitution"];

  const labels: string[] = [];
  const current = revision.content;
  const prior = previous.content;
  if (
    !sameValue(
      [current.purpose, current.intendedImpact],
      [prior.purpose, prior.intendedImpact],
    )
  ) {
    labels.push("Direction");
  }
  if (
    !sameValue(
      [current.customerPrinciples, current.qualityPrinciples, current.voice],
      [prior.customerPrinciples, prior.qualityPrinciples, prior.voice],
    )
  ) {
    labels.push("Principles and voice");
  }
  if (
    !sameValue(
      [current.nonNegotiables, current.antiGoals],
      [prior.nonNegotiables, prior.antiGoals],
    )
  ) {
    labels.push("Boundaries");
  }
  if (!sameValue(current.decisionRights, prior.decisionRights)) {
    labels.push("Decision rights");
  }
  if (!sameValue(current.riskTolerance, prior.riskTolerance)) {
    labels.push("Risk tolerance");
  }
  if (!sameValue(current.evidenceStandards, prior.evidenceStandards)) {
    labels.push("Evidence standards");
  }
  return labels.length > 0 ? labels : ["No governed fields changed"];
}

function ventureStateChangeLabels(
  revision: VentureStateRevision,
  previous: VentureStateRevision | null,
) {
  if (!previous) return ["Initial venture state"];

  const labels: string[] = [];
  if (revision.content.ventureSummary !== previous.content.ventureSummary) {
    labels.push("Venture summary changed");
  }
  for (const engine of Object.keys(ENGINE_LABELS) as Array<keyof typeof ENGINE_LABELS>) {
    const currentEngine = revision.content.engines[engine];
    const previousEngine = previous.content.engines[engine];
    if (
      !sameValue(
        [currentEngine.summary, currentEngine.evidence],
        [previousEngine.summary, previousEngine.evidence],
      )
    ) {
      labels.push(`${ENGINE_LABELS[engine]} changed`);
    }
  }
  if (!sameValue(revision.content.activeConstraint, previous.content.activeConstraint)) {
    labels.push("Constraint changed");
  }
  if (!sameValue(revision.content.nextMove, previous.content.nextMove)) {
    labels.push("Next move changed");
  }
  if (!sameValue(revision.content.learnings, previous.content.learnings)) {
    const added = revision.content.learnings.filter(
      (learning) => !previous.content.learnings.includes(learning),
    ).length;
    labels.push(added > 0 ? `${added} learning${added === 1 ? "" : "s"} added` : "Learnings changed");
  }
  return labels.length > 0 ? labels : ["No material operating fields changed"];
}

function RevisionHistory({
  revisions,
  companyId,
}: {
  revisions: VentureConstitutionRevision[];
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [approvalNote, setApprovalNote] = useState("Approved as the founder's current operating contract.");
  const mutation = useMutation({
    mutationFn: async (action: { kind: "activate" | "restore"; revision: VentureConstitutionRevision }) => {
      if (action.kind === "activate") {
        return founderCockpitApi.activateConstitutionRevision(
          companyId,
          action.revision.id,
          approvalNote,
        );
      }
      return founderCockpitApi.restoreConstitutionRevision(
        companyId,
        action.revision.id,
        `Restore v${action.revision.version} as a new draft for founder review.`,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.founderCockpit.snapshot(companyId) }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.founderCockpit.constitutionRevisions(companyId),
        }),
      ]);
    },
  });

  if (revisions.length === 0) return null;
  const sortedRevisions = [...revisions].sort((left, right) => right.version - left.version);

  return (
    <Card id="constitution-history">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileClock className="h-4 w-4" />
          Constitution history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="constitution-approval-note">Founder approval note</Label>
          <Input
            id="constitution-approval-note"
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
          />
        </div>
        {sortedRevisions.map((revision) => {
          const previous =
            sortedRevisions.find((candidate) => candidate.version < revision.version) ?? null;
          const changes = constitutionChangeLabels(revision, previous);
          return (
            <div
              key={revision.id}
              className="flex flex-col gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Version {revision.version}</span>
                  <Badge variant={revision.status === "active" ? "default" : "outline"}>
                    {revision.status}
                  </Badge>
                  {revision.restoredFromRevisionId ? <Badge variant="secondary">restored</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{revision.changeReason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {changes.map((change) => (
                    <Badge key={change} variant="secondary">{change}</Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Created {formatTimestamp(revision.createdAt)}
                  {revision.activatedAt ? ` · active ${formatTimestamp(revision.activatedAt)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {revision.status === "draft" ? (
                  <Button
                    size="sm"
                    disabled={mutation.isPending || !approvalNote.trim()}
                    onClick={() => mutation.mutate({ kind: "activate", revision })}
                  >
                    Activate
                  </Button>
                ) : null}
                {revision.status === "superseded" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ kind: "restore", revision })}
                  >
                    Restore as draft
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        {mutation.error ? (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Could not update the revision."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VentureStateHistory({
  revisions,
  currentState,
}: {
  revisions: VentureStateRevision[];
  currentState: VentureStateRevision | null;
}) {
  if (!currentState || revisions.length === 0) return null;

  const sortedRevisions = [...revisions].sort((left, right) => right.version - left.version);
  const previous =
    sortedRevisions.find((revision) => revision.version < currentState.version) ?? null;
  const changes = ventureStateChangeLabels(currentState, previous);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileClock className="h-4 w-4" />
              What changed in State v{currentState.version}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {previous
                ? `Compared with State v${previous.version}.`
                : "This is the first saved venture picture."}
            </p>
          </div>
          <Badge variant="secondary">{currentState.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {changes.map((change) => (
            <Badge key={change} variant="outline">{change}</Badge>
          ))}
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Why it changed</p>
            <p className="mt-2 leading-relaxed">{currentState.creationReason}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provenance</p>
            <p className="mt-2">{currentState.sourceRefs.length} source reference(s)</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cycle</p>
            <p className="mt-2">
              {currentState.basedOnCycleId
                ? `Promoted by cycle ${currentState.basedOnCycleId.slice(0, 8)}`
                : "Recorded outside a completed cycle"}
            </p>
          </div>
        </div>
        {sortedRevisions.length > 1 ? (
          <div className="border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent state history</p>
            <div className="mt-3 space-y-3">
              {sortedRevisions.slice(0, 5).map((revision) => (
                <div className="flex flex-wrap items-start justify-between gap-3 text-sm" key={revision.id}>
                  <div>
                    <span className="font-medium">State v{revision.version}</span>
                    <span className="ml-2 text-muted-foreground">{revision.creationReason}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {revision.sourceRefs.length} source(s) · {formatTimestamp(revision.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ConstitutionEditor({
  companyId,
  activeRevision,
}: {
  companyId: string;
  activeRevision: VentureConstitutionRevision | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(activeRevision === null);
  const [draft, setDraft] = useState(() => draftFromRevision(activeRevision));
  const mutation = useMutation({
    mutationFn: () =>
      founderCockpitApi.createConstitutionRevision(companyId, {
        content: contentFromDraft(draft),
        changeReason: draft.changeReason.trim(),
        sourceRefs: [
          {
            kind: "founder_cockpit",
            label: "Founder-authored Venture Constitution",
            capturedAt: new Date().toISOString(),
          },
        ],
      }),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.founderCockpit.constitutionRevisions(companyId),
      });
    },
  });

  useEffect(() => {
    if (!open) setDraft(draftFromRevision(activeRevision));
  }, [activeRevision, open]);

  const set = (key: keyof DraftFields, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const requiredReady = [
    draft.purpose,
    draft.intendedImpact,
    draft.financialRisk,
    draft.securityRisk,
    draft.privacyRisk,
    draft.reputationalRisk,
    draft.changeReason,
  ].every((value) => value.trim().length > 0);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {activeRevision ? "Propose revision" : "Draft Constitution"}
      </Button>
    );
  }

  const multilineFields: Array<[keyof DraftFields, string, string]> = [
    ["customerPrinciples", "Customer principles", "One principle per line"],
    ["qualityPrinciples", "Quality principles", "One principle per line"],
    ["desiredVoice", "Desired voice", "One quality per line"],
    ["voiceExamples", "Voice examples", "One example per line"],
    ["voiceCounterexamples", "Voice counterexamples", "One counterexample per line"],
    ["nonNegotiables", "Non-negotiables", "One boundary per line"],
    ["antiGoals", "Anti-goals", "One anti-goal per line"],
    ["founderRights", "Founder decision rights", "One right per line"],
    ["delegatedRights", "Delegated decision rights", "One bounded right per line"],
    ["approvalBoundaries", "Approval required", "One consequential boundary per line"],
    ["evidenceStandards", "Evidence standards", "One standard per line"],
  ];

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle>{activeRevision ? "Propose a Constitution revision" : "Draft the first Constitution"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Saving creates a draft only. A separate founder approval is required before agents can consume it as current state.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="constitution-purpose">Purpose</Label>
            <Textarea
              id="constitution-purpose"
              value={draft.purpose}
              onChange={(event) => set("purpose", event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="constitution-impact">Intended impact</Label>
            <Textarea
              id="constitution-impact"
              value={draft.intendedImpact}
              onChange={(event) => set("intendedImpact", event.target.value)}
            />
          </div>
          {multilineFields.map(([key, label, placeholder]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`constitution-${key}`}>{label}</Label>
              <Textarea
                id={`constitution-${key}`}
                placeholder={placeholder}
                value={draft[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </div>
          ))}
          {([
            ["financialRisk", "Financial risk tolerance"],
            ["securityRisk", "Security risk tolerance"],
            ["privacyRisk", "Privacy risk tolerance"],
            ["reputationalRisk", "Reputational risk tolerance"],
          ] as Array<[keyof DraftFields, string]>).map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`constitution-${key}`}>{label}</Label>
              <Textarea
                id={`constitution-${key}`}
                value={draft[key]}
                onChange={(event) => set(key, event.target.value)}
              />
            </div>
          ))}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="constitution-reason">Reason for this revision</Label>
            <Input
              id="constitution-reason"
              value={draft.changeReason}
              onChange={(event) => set("changeReason", event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!requiredReady || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving draft…" : "Save draft for review"}
          </Button>
          {activeRevision ? (
            <Button variant="ghost" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
        {mutation.error ? (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Could not save the draft."}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FounderCockpit() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const arrivedFromSimStarter = searchParams.get("from") === "sim-starter";
  const starterIssueRef = searchParams.get("issue");

  useEffect(() => {
    setBreadcrumbs([{ label: "Founder Cockpit" }]);
  }, [setBreadcrumbs]);

  const snapshotQuery = useQuery({
    queryKey: queryKeys.founderCockpit.snapshot(selectedCompanyId ?? "__none__"),
    queryFn: () => founderCockpitApi.get(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const revisionsQuery = useQuery({
    queryKey: queryKeys.founderCockpit.constitutionRevisions(selectedCompanyId ?? "__none__"),
    queryFn: () => founderCockpitApi.constitutionRevisions(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const stateRevisionsQuery = useQuery({
    queryKey: queryKeys.founderCockpit.stateRevisions(selectedCompanyId ?? "__none__"),
    queryFn: () => founderCockpitApi.stateRevisions(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const projectionMutation = useMutation({
    mutationFn: () =>
      founderCockpitApi.createContextProjection(selectedCompanyId!, {
        creationReason: "Refresh the Founder Cockpit's bounded current context.",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.founderCockpit.snapshot(selectedCompanyId!),
      });
    },
  });

  const snapshot = snapshotQuery.data;
  const activeRevision = snapshot?.constitution ?? null;
  const currentDraft = useMemo(
    () => revisionsQuery.data?.find((revision) => revision.status === "draft") ?? null,
    [revisionsQuery.data],
  );

  if (!selectedCompanyId) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Choose a company to open its Founder Cockpit.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (snapshotQuery.isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">Loading Founder Cockpit…</div>;
  }

  if (snapshotQuery.error || !snapshot) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-8">
            <CircleAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium">The Founder Cockpit could not load.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : "Try again."}
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => void snapshotQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const state = snapshot.ventureState;
  const projection = snapshot.contextProjection;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
      <section className="border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Compass className="h-4 w-4" />
              Founder control surface
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{snapshot.company.name}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              See the whole venture, find the active constraint, and decide the next move.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={activeRevision ? "default" : "outline"}>
              {activeRevision ? `Direction v${activeRevision.version}` : "Direction not set"}
            </Badge>
            <Badge variant={state ? "secondary" : "outline"}>
              {state ? `Venture map v${state.version}` : "Venture not mapped"}
            </Badge>
          </div>
        </div>
      </section>

      {arrivedFromSimStarter ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="font-medium">SIM Starter is ready in the Founder Cockpit.</p>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {starterIssueRef
                  ? "Your first mapping task is ready. Use it while you set the venture’s direction, limits, and current four-engine picture."
                  : "The starter is installed, but its first mapping task could not be found. Continue here, then review the starter tasks before mapping the venture."}
              </p>
            </div>
            {starterIssueRef ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/issues/${encodeURIComponent(starterIssueRef)}`}>
                  Open first mapping task
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label="Active work" value={snapshot.work.active} />
        <Metric label="Blocked" value={snapshot.work.blocked} tone="warning" />
        <Metric label="Pending approvals" value={snapshot.approvals.pending} tone="warning" />
      </section>

      <FounderPracticePath
        activeRevision={activeRevision}
        currentDraft={currentDraft}
        state={state}
        activeCycle={snapshot.activeCycle}
        latestCycle={snapshot.latestCycle}
      />

      {!activeRevision ? (
        <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium">Set and approve your Venture Constitution before starting.</p>
            <p className="mt-1 text-muted-foreground">
              This is the venture’s standing direction, limits, and approval rules. Saving a draft does not make it active.
            </p>
          </div>
        </div>
      ) : null}

      <section id="venture-constitution" className="grid scroll-mt-6 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenCheck className="h-4 w-4" />
              Current direction
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeRevision ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Purpose</p>
                  <p className="mt-2 text-lg leading-relaxed">{activeRevision.content.purpose}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Non-negotiables</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {activeRevision.content.nonNegotiables.map((item) => <li key={item}>— {item}</li>)}
                  </ul>
                </div>
                <ConstitutionEditor companyId={selectedCompanyId} activeRevision={activeRevision} />
              </div>
            ) : (
              <ConstitutionEditor companyId={selectedCompanyId} activeRevision={null} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Fingerprint className="h-4 w-4" />
              Why this view can be trusted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projection ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">Source view v{projection.version}</Badge>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(projection.createdAt)}</span>
                </div>
                <p className="text-sm text-muted-foreground">{projection.creationReason}</p>
                <div className="space-y-2">
                  {projection.sourceRefs.slice(0, 6).map((source, index) => (
                    <div className="border-l border-border pl-3 text-sm" key={`${source.kind}-${source.id ?? index}`}>
                      <p className="font-medium">{source.label}</p>
                      <p className="text-xs text-muted-foreground">Reviewed source</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <PauseCircle className="mt-0.5 h-5 w-5" />
                <p>
                  After you map the venture, Sysdom will show which notes and decisions support this view.
                  This first version works without an AI call.
                </p>
              </div>
            )}
            {state ? (
              <Button
                variant="outline"
                size="sm"
                disabled={projectionMutation.isPending}
                onClick={() => projectionMutation.mutate()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh sources
              </Button>
            ) : null}
            {projectionMutation.error ? (
              <p className="text-sm text-destructive">
                {projectionMutation.error instanceof Error
                  ? projectionMutation.error.message
                  : "Could not refresh the supporting sources."}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {stateRevisionsQuery.error ? (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-3 py-5">
            <CircleAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium">State history could not load.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The current venture state remains available, but revision comparison is temporarily unavailable.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <VentureStateHistory
          revisions={stateRevisionsQuery.data ?? []}
          currentState={state}
        />
      )}

      <section id="guided-sim-cycle" className="scroll-mt-6">
        <GuidedSimCycle
          companyId={selectedCompanyId}
          cycle={snapshot.activeCycle}
          currentState={state}
          constitutionActive={Boolean(activeRevision)}
        />
      </section>

      {!snapshot.activeCycle && snapshot.latestCycle?.status === "completed" ? (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Most recent SIM Cycle</CardTitle>
              <Badge variant="secondary">completed</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Observed outcome</p>
              <p className="mt-2 text-sm leading-relaxed">
                {snapshot.latestCycle.compoundOutput?.outcome ?? "Outcome retained in the cycle evidence trail."}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Promoted learning</p>
              <p className="mt-2 text-sm leading-relaxed">
                {snapshot.latestCycle.compoundOutput?.learning ?? "Learning kept in the venture record."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-2">
              Completed {formatTimestamp(snapshot.latestCycle.completedAt)} · source view{" "}
              {snapshot.latestCycle.contextProjectionId?.slice(0, 8) ?? "not recorded"} · promoted state{" "}
              {snapshot.latestCycle.compoundOutput?.promotedStateRevisionId.slice(0, 8) ?? "not recorded"}
            </p>
            <div className="md:col-span-2">
              <Button asChild size="sm">
                <Link to="/sim-coach">
                  Review in SIM Coach
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state ? (
        <>
          {state.content.learnings.length > 0 ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-base">Promoted learning</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {state.content.learnings.map((learning, index) => (
                    <li key={`${index}-${learning}`} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{learning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <section className="grid gap-4 md:grid-cols-2">
            {Object.entries(state.content.engines).map(([engine, value]) => (
              <Card key={engine}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{ENGINE_LABELS[engine as keyof typeof ENGINE_LABELS]}</CardTitle>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(value.freshness)}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{value.summary}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{value.evidence.length} evidence reference(s)</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">Active constraint hypothesis</CardTitle>
              </CardHeader>
              <CardContent>
                {state.content.activeConstraint ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{ENGINE_LABELS[state.content.activeConstraint.engine]}</Badge>
                      <Badge variant="outline">{state.content.activeConstraint.confidence} confidence</Badge>
                      <Badge variant={state.content.activeConstraint.decision === "accepted" ? "secondary" : "outline"}>
                        {state.content.activeConstraint.decision}
                      </Badge>
                    </div>
                    <p className="leading-relaxed">{state.content.activeConstraint.hypothesis}</p>
                    {state.content.activeConstraint.decisionNote ? (
                      <p className="text-sm text-muted-foreground">{state.content.activeConstraint.decisionNote}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No constraint has been chosen yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Next bounded move</CardTitle>
              </CardHeader>
              <CardContent>
                {state.content.nextMove ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <p className="font-medium">{state.content.nextMove.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{state.content.nextMove.rationale}</p>
                    {state.content.nextMove.approvalRequired ? (
                      <Badge variant="outline">Founder approval required</Badge>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">The guided cycle will establish the next move.</p>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-3 font-medium">Ready to map the venture</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              The guided SIM Cycle will record Product, Customer, Cash, and Skills state before asking you to choose a constraint.
            </p>
          </CardContent>
        </Card>
      )}

      {currentDraft ? (
        <div className="border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Constitution v{currentDraft.version} is waiting for founder approval in the history below.
        </div>
      ) : null}

      {revisionsQuery.error ? (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-3 py-5">
            <CircleAlert className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium">Constitution history could not load.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The active Constitution remains visible, but revision actions are temporarily unavailable.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <RevisionHistory revisions={revisionsQuery.data ?? []} companyId={selectedCompanyId} />
      )}
    </div>
  );
}
