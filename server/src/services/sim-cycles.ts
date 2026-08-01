import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  simCycleEvents,
  simCycles,
  issues,
  ventureConstitutionRevisions,
  ventureContextProjections,
} from "@paperclipai/db";
import type {
  CommitSimCycleLeverage,
  CompleteSimCycleCompound,
  DecideSimCycleDiagnosis,
  PauseSimCycle,
  StartSimCycle,
  SubmitSimCycleMap,
  VentureConstraintHypothesis,
  VentureSourceRef,
  VentureStateContent,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { ventureOperatingStateService } from "./venture-operating-state.js";
import { issueService } from "./issues.js";

function uniqueSourceRefs(refs: VentureSourceRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.id ?? ""}:${ref.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function simCycleService(db: Db) {
  const ventureState = ventureOperatingStateService(db);
  const issueSvc = issueService(db);

  async function getCycle(companyId: string, id: string) {
    const cycle = await db
      .select()
      .from(simCycles)
      .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
      .then((rows) => rows[0] ?? null);
    if (!cycle) throw notFound("SIM Cycle not found");
    return cycle;
  }

  async function requireActivePhase(
    companyId: string,
    id: string,
    phase: "map" | "diagnose" | "leverage" | "compound",
  ) {
    const cycle = await getCycle(companyId, id);
    if (cycle.status === "paused") throw conflict("Resume the SIM Cycle before continuing");
    if (cycle.status !== "active") throw conflict("Only an active SIM Cycle can continue");
    if (cycle.phase !== phase) {
      throw conflict(`SIM Cycle is in ${cycle.phase}; expected ${phase}`);
    }
    return cycle;
  }

  async function addEvent(input: {
    companyId: string;
    cycleId: string;
    type: string;
    phase: "map" | "diagnose" | "leverage" | "compound" | "complete";
    actorUserId: string;
    payload?: Record<string, unknown>;
  }) {
    await db.insert(simCycleEvents).values({
      companyId: input.companyId,
      cycleId: input.cycleId,
      type: input.type,
      phase: input.phase,
      actorUserId: input.actorUserId,
      payload: input.payload ?? {},
    });
  }

  async function updateStateAndProjection(input: {
    companyId: string;
    cycleId: string;
    userId: string;
    content: VentureStateContent;
    sourceRefs: VentureSourceRef[];
    stateReason: string;
    projectionReason: string;
  }) {
    const state = await ventureState.createState(
      input.companyId,
      {
        content: input.content,
        sourceRefs: uniqueSourceRefs(input.sourceRefs),
        creationReason: input.stateReason,
      },
      { agentId: null, userId: input.userId },
      { basedOnCycleId: input.cycleId },
    );
    const projection = await ventureState.createProjection(
      input.companyId,
      {
        ventureStateRevisionId: state.id,
        creationReason: input.projectionReason,
      },
      { agentId: null, userId: input.userId },
    );
    return { state, projection };
  }

  return {
    active: (companyId: string) =>
      db
        .select()
        .from(simCycles)
        .where(
          and(
            eq(simCycles.companyId, companyId),
            inArray(simCycles.status, ["active", "paused"]),
          ),
        )
        .then((rows) => rows[0] ?? null),

    list: (companyId: string) =>
      db
        .select()
        .from(simCycles)
        .where(eq(simCycles.companyId, companyId))
        .orderBy(desc(simCycles.createdAt)),

    events: async (companyId: string, id: string) => {
      await getCycle(companyId, id);
      return db
        .select()
        .from(simCycleEvents)
        .where(and(eq(simCycleEvents.companyId, companyId), eq(simCycleEvents.cycleId, id)))
        .orderBy(asc(simCycleEvents.createdAt));
    },

    start: async (companyId: string, data: StartSimCycle, userId: string) => {
      const constitution = await db
        .select()
        .from(ventureConstitutionRevisions)
        .where(
          and(
            eq(ventureConstitutionRevisions.companyId, companyId),
            eq(ventureConstitutionRevisions.status, "active"),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!constitution) {
        throw unprocessable("Activate a Venture Constitution before starting a SIM Cycle");
      }
      const open = await db
        .select({ id: simCycles.id })
        .from(simCycles)
        .where(
          and(
            eq(simCycles.companyId, companyId),
            inArray(simCycles.status, ["active", "paused"]),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (open) throw conflict("Finish or resume the open SIM Cycle before starting another");

      const startingState = await ventureState.currentState(companyId);
      const cycle = await db
        .insert(simCycles)
        .values({
          companyId,
          status: "active",
          phase: "map",
          constitutionRevisionId: constitution.id,
          startingStateRevisionId: startingState?.id ?? null,
          currentStateRevisionId: startingState?.id ?? null,
          startReason: data.startReason,
          startedByUserId: userId,
        })
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: cycle.id,
        type: "cycle_started",
        phase: "map",
        actorUserId: userId,
        payload: {
          startReason: data.startReason,
          constitutionRevisionId: constitution.id,
          startingStateRevisionId: startingState?.id ?? null,
        },
      });
      return cycle;
    },

    submitMap: async (
      companyId: string,
      id: string,
      data: SubmitSimCycleMap,
      userId: string,
    ) => {
      await requireActivePhase(companyId, id, "map");
      const { state, projection } = await updateStateAndProjection({
        companyId,
        cycleId: id,
        userId,
        content: data.content,
        sourceRefs: data.sourceRefs,
        stateReason: "Founder completed the MAP phase of a guided SIM Cycle.",
        projectionReason: "Bounded context after the guided SIM Cycle MAP phase.",
      });
      const completedAt = new Date().toISOString();
      const cycle = await db
        .update(simCycles)
        .set({
          phase: "diagnose",
          currentStateRevisionId: state.id,
          contextProjectionId: projection.id,
          mapOutput: { ventureStateRevisionId: state.id, completedAt },
          updatedAt: new Date(),
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: "map_completed",
        phase: "map",
        actorUserId: userId,
        payload: {
          ventureStateRevisionId: state.id,
          contextProjectionId: projection.id,
        },
      });
      return cycle;
    },

    decideDiagnosis: async (
      companyId: string,
      id: string,
      data: DecideSimCycleDiagnosis,
      userId: string,
    ) => {
      await requireActivePhase(companyId, id, "diagnose");
      const current = await ventureState.currentState(companyId);
      if (!current) throw unprocessable("Complete the MAP phase before diagnosing a constraint");
      const decidedAt = new Date().toISOString();
      const constraint: VentureConstraintHypothesis = {
        engine: data.engine,
        hypothesis: data.hypothesis,
        confidence: data.confidence,
        evidence: data.evidence,
        decision: data.decision,
        decisionNote: data.decisionNote,
        decidedByUserId: userId,
        decidedAt,
      };
      const { state, projection } = await updateStateAndProjection({
        companyId,
        cycleId: id,
        userId,
        content: {
          ...current.content,
          activeConstraint: constraint,
          nextMove: null,
          refreshedAt: decidedAt,
        },
        sourceRefs: [...current.sourceRefs, ...data.evidence],
        stateReason: `Founder ${data.decision} the DIAGNOSE constraint hypothesis.`,
        projectionReason: `Bounded context after the founder ${data.decision} a DIAGNOSE hypothesis.`,
      });
      const accepted = data.decision === "accepted";
      const cycle = await db
        .update(simCycles)
        .set({
          phase: accepted ? "leverage" : "diagnose",
          currentStateRevisionId: state.id,
          contextProjectionId: projection.id,
          diagnoseOutput: {
            constraint,
            approvedByUserId: accepted ? userId : null,
            approvedAt: accepted ? decidedAt : null,
          },
          updatedAt: new Date(),
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: accepted ? "diagnosis_accepted" : "diagnosis_rejected",
        phase: "diagnose",
        actorUserId: userId,
        payload: {
          engine: data.engine,
          confidence: data.confidence,
          ventureStateRevisionId: state.id,
          contextProjectionId: projection.id,
          decisionNote: data.decisionNote,
        },
      });
      return cycle;
    },

    commitLeverage: async (
      companyId: string,
      id: string,
      data: CommitSimCycleLeverage,
      userId: string,
    ) => {
      await requireActivePhase(companyId, id, "leverage");
      const current = await ventureState.currentState(companyId);
      if (!current?.content.activeConstraint || current.content.activeConstraint.decision !== "accepted") {
        throw unprocessable("Accept one constraint hypothesis before committing an intervention");
      }
      const committedAt = new Date().toISOString();
      const intervention = {
        title: data.title,
        rationale: data.rationale,
        engine: data.engine,
        successSignal: data.successSignal,
        approvalRequired: data.approvalRequired,
        evidence: data.evidence,
      };
      const { state, projection } = await updateStateAndProjection({
        companyId,
        cycleId: id,
        userId,
        content: {
          ...current.content,
          nextMove: {
            title: data.title,
            rationale: `${data.rationale} Success signal: ${data.successSignal}`,
            engine: data.engine,
            approvalRequired: data.approvalRequired,
          },
          refreshedAt: committedAt,
        },
        sourceRefs: [...current.sourceRefs, ...data.evidence],
        stateReason: "Founder committed the LEVERAGE intervention.",
        projectionReason: "Bounded context consumed by the committed LEVERAGE intervention.",
      });
      const cycle = await db
        .update(simCycles)
        .set({
          phase: "compound",
          currentStateRevisionId: state.id,
          contextProjectionId: projection.id,
          leverageOutput: {
            intervention,
            commitmentNote: data.commitmentNote,
            committedByUserId: userId,
            committedAt,
          },
          updatedAt: new Date(),
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: "intervention_committed",
        phase: "leverage",
        actorUserId: userId,
        payload: {
          title: data.title,
          successSignal: data.successSignal,
          approvalRequired: data.approvalRequired,
          ventureStateRevisionId: state.id,
          contextProjectionId: projection.id,
          commitmentNote: data.commitmentNote,
        },
      });
      return cycle;
    },

    delegateIntervention: async (
      companyId: string,
      id: string,
      userId: string,
    ) => {
      const cycle = await getCycle(companyId, id);
      if (!cycle.leverageOutput || !cycle.contextProjectionId) {
        throw unprocessable("Commit a LEVERAGE intervention before creating bounded delegated work");
      }

      const existing = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.originKind, "sim_cycle_intervention"),
            eq(issues.originId, cycle.id),
          ),
        )
        .then((rows) => rows[0] ?? null);
      const projection = await db
        .select()
        .from(ventureContextProjections)
        .where(
          and(
            eq(ventureContextProjections.id, cycle.contextProjectionId!),
            eq(ventureContextProjections.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);
      if (!projection) {
        throw unprocessable("The SIM Cycle context projection is unavailable");
      }
      if (existing) {
        return { cycle, issue: existing, contextProjection: projection, created: false };
      }

      const intervention = cycle.leverageOutput.intervention;
      const issue = await issueSvc.create(companyId, {
        title: intervention.title,
        description: [
          "Founder-committed LEVERAGE intervention.",
          "",
          `Rationale: ${intervention.rationale}`,
          `Success signal: ${intervention.successSignal}`,
          `Engine: ${intervention.engine}`,
          `Commitment: ${cycle.leverageOutput.commitmentNote}`,
          "",
          `SIM Cycle: ${cycle.id}`,
          `Venture Context Projection: v${projection.version} (${projection.id})`,
        ].join("\n"),
        status: "backlog",
        workMode: "standard",
        priority: "high",
        assigneeAgentId: null,
        assigneeUserId: null,
        originKind: "sim_cycle_intervention",
        originId: cycle.id,
        originFingerprint: projection.id,
        ventureContextProjectionId: projection.id,
        createdByUserId: userId,
        createdByAgentId: null,
      });

      await addEvent({
        companyId,
        cycleId: cycle.id,
        type: "intervention_delegated",
        phase: cycle.phase,
        actorUserId: userId,
        payload: {
          issueId: issue.id,
          issueIdentifier: issue.identifier,
          contextProjectionId: projection.id,
          contextProjectionVersion: projection.version,
        },
      });

      return { cycle, issue, contextProjection: projection, created: true };
    },

    completeCompound: async (
      companyId: string,
      id: string,
      data: CompleteSimCycleCompound,
      userId: string,
    ) => {
      const cycleBefore = await requireActivePhase(companyId, id, "compound");
      const current = await ventureState.currentState(companyId);
      if (!current) throw unprocessable("Canonical venture state is missing");
      const completedAt = new Date().toISOString();
      const finalState = await ventureState.createState(
        companyId,
        {
          content: {
            ...current.content,
            nextMove: data.nextMove,
            learnings: [...current.content.learnings, data.learning],
            refreshedAt: completedAt,
          },
          sourceRefs: uniqueSourceRefs([...current.sourceRefs, ...data.evidence]),
          creationReason: "Founder promoted COMPOUND evidence and learning into canonical venture state.",
        },
        { agentId: null, userId },
        { basedOnCycleId: id },
      );
      await ventureState.createProjection(
        companyId,
        {
          ventureStateRevisionId: finalState.id,
          creationReason: "Current bounded context after the completed guided SIM Cycle.",
        },
        { agentId: null, userId },
      );
      const cycle = await db
        .update(simCycles)
        .set({
          status: "completed",
          phase: "complete",
          currentStateRevisionId: finalState.id,
          compoundOutput: {
            outcome: data.outcome,
            evidence: data.evidence,
            learning: data.learning,
            promotedStateRevisionId: finalState.id,
            completedAt,
          },
          completedAt: new Date(completedAt),
          updatedAt: new Date(completedAt),
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: "learning_promoted",
        phase: "compound",
        actorUserId: userId,
        payload: {
          outcome: data.outcome,
          learning: data.learning,
          evidence: data.evidence,
          promotedStateRevisionId: finalState.id,
          consumedContextProjectionId: cycleBefore.contextProjectionId,
        },
      });
      await addEvent({
        companyId,
        cycleId: id,
        type: "cycle_completed",
        phase: "complete",
        actorUserId: userId,
        payload: {
          promotedStateRevisionId: finalState.id,
          consumedContextProjectionId: cycleBefore.contextProjectionId,
        },
      });
      return cycle;
    },

    pause: async (companyId: string, id: string, data: PauseSimCycle, userId: string) => {
      const cycle = await getCycle(companyId, id);
      if (cycle.status !== "active") throw conflict("Only an active SIM Cycle can be paused");
      const pausedAt = new Date();
      const updated = await db
        .update(simCycles)
        .set({
          status: "paused",
          pausedReason: data.reason,
          pausedAt,
          updatedAt: pausedAt,
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: "cycle_paused",
        phase: cycle.phase,
        actorUserId: userId,
        payload: { reason: data.reason },
      });
      return updated;
    },

    resume: async (companyId: string, id: string, userId: string) => {
      const cycle = await getCycle(companyId, id);
      if (cycle.status !== "paused") throw conflict("Only a paused SIM Cycle can be resumed");
      const resumedAt = new Date();
      const updated = await db
        .update(simCycles)
        .set({
          status: "active",
          pausedReason: null,
          resumedAt,
          updatedAt: resumedAt,
        })
        .where(and(eq(simCycles.id, id), eq(simCycles.companyId, companyId)))
        .returning()
        .then((rows) => rows[0]!);
      await addEvent({
        companyId,
        cycleId: id,
        type: "cycle_resumed",
        phase: cycle.phase,
        actorUserId: userId,
      });
      return updated;
    },
  };
}
