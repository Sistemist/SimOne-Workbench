import { describe, expect, it } from "vitest";
import {
  buildHeartbeatRouteRecommendation,
  buildPaperclipTaskMarkdown,
  buildVentureContextProjectionRouteMetadata,
  mergeCoalescedContextSnapshot,
  summarizeHeartbeatRunContextSnapshot,
  summarizeHeartbeatRunListResultJson,
} from "../services/heartbeat.js";

describe("buildPaperclipTaskMarkdown", () => {
  it("adds planning directives for assignment and comment task context", () => {
    const assignment = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-1",
        identifier: "PAP-3404",
        title: "Plan first",
        workMode: "planning",
        description: null,
      },
    });

    expect(assignment).toContain("- Work mode: \"planning\"");
    expect(assignment).toContain("Make the plan only. Do not write code or perform implementation work.");

    const commentWake = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-1",
        identifier: "PAP-3404",
        title: "Plan first",
        workMode: "planning",
        description: null,
      },
      wakeComment: {
        id: "comment-1",
        body: "Please revise the plan.",
      },
    });

    expect(commentWake).toContain("Update the plan only. Do not write code or perform implementation work.");

    const acceptedConfirmation = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-1",
        identifier: "PAP-3404",
        title: "Plan first",
        workMode: "planning",
        description: null,
      },
      interaction: {
        kind: "request_confirmation",
        status: "accepted",
      },
    });

    expect(acceptedConfirmation).toContain("Create child issues from the approved plan only");
    expect(acceptedConfirmation).not.toContain("Make the plan only.");
  });

  it("adds accepted-plan continuation guidance for standard-work issues when the wake is flagged as a plan continuation", () => {
    const acceptedConfirmation = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-2",
        identifier: "PAP-415",
        title: "Implement the fix",
        workMode: "standard",
        description: null,
      },
      acceptedPlanContinuation: true,
    });

    expect(acceptedConfirmation).toContain("Accepted plan directive:");
    expect(acceptedConfirmation).toContain("Create child issues from the approved plan only");
    expect(acceptedConfirmation).not.toContain("- Work mode: \"planning\"");
  });

  it("adds answer-only guidance for ask-mode issues", () => {
    const assignment = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-ask",
        identifier: "PAP-416",
        title: "Explain the tradeoff",
        workMode: "ask",
        description: null,
      },
    });

    expect(assignment).toContain("- Work mode: \"ask\"");
    expect(assignment).toContain("Ask mode directive:");
    expect(assignment).toContain("Answer the question directly in the issue thread.");
    expect(assignment).toContain("Do not write implementation code");
    expect(assignment).toContain("do not produce an implementation plan");
  });

  it("prefers ordinary comment planning guidance over stale accepted confirmation state", () => {
    const commentWake = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-1",
        identifier: "PAP-3404",
        title: "Plan first",
        workMode: "planning",
        description: null,
      },
      wakeComment: {
        id: "comment-1",
        body: "Please revise the plan.",
      },
      interaction: {
        kind: "request_confirmation",
        status: "accepted",
      },
    });

    expect(commentWake).toContain("Update the plan only. Do not write code or perform implementation work.");
    expect(commentWake).not.toContain("Create child issues from the approved plan only");
  });

  it("renders the exact bounded Venture Context Projection pinned to delegated work", () => {
    const assignment = buildPaperclipTaskMarkdown({
      issue: {
        id: "issue-1",
        identifier: "SYS-101",
        title: "Run one founder onboarding session",
        workMode: "standard",
        description: "Capture the observed outcome.",
      },
      ventureContextProjection: {
        id: "11111111-1111-4111-8111-111111111111",
        version: 4,
        constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
        ventureStateRevisionId: "33333333-3333-4333-8333-333333333333",
        creationReason: "Founder committed the LEVERAGE intervention.",
        createdAt: "2026-08-01T10:00:00.000Z",
        content: {
          purpose: "Keep the founder in control.",
          nonNegotiables: ["No paid model use without approval."],
          approvalBoundaries: ["Public commitments"],
          ventureSummary: "Sysdom AI is preparing a controlled founder cohort.",
          engines: {
            product: { summary: "Founder Cockpit is ready.", freshness: "2026-08-01T10:00:00.000Z" },
            customer: { summary: "Cohort recruitment is constrained.", freshness: "2026-08-01T10:00:00.000Z" },
            cash: { summary: "Spend is blocked.", freshness: "2026-08-01T10:00:00.000Z" },
            skills: { summary: "Core capability is present.", freshness: "2026-08-01T10:00:00.000Z" },
          },
          activeConstraint: null,
          nextMove: null,
        },
        sourceRefs: [{ kind: "founder_session", label: "Founder review" }],
      },
    });

    expect(assignment).toContain("Founder-approved venture context:");
    expect(assignment).toContain("Projection: v4");
    expect(assignment).toContain("Keep the founder in control.");
    expect(assignment).toContain("No paid model use without approval.");
    expect(assignment).toContain("Public commitments");
    expect(assignment).toContain("Provenance references: 1");
  });

  it("records exact projection identifiers in the route ledger receipt", () => {
    expect(buildVentureContextProjectionRouteMetadata({
      id: "11111111-1111-4111-8111-111111111111",
      version: 4,
      constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
      ventureStateRevisionId: "33333333-3333-4333-8333-333333333333",
      creationReason: "Founder committed the LEVERAGE intervention.",
      createdAt: "2026-08-01T10:00:00.000Z",
      content: {
        purpose: "Keep the founder in control.",
        nonNegotiables: [],
        approvalBoundaries: [],
        ventureSummary: "Sysdom AI",
        engines: {
          product: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
          customer: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
          cash: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
          skills: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
        },
        activeConstraint: null,
        nextMove: null,
      },
      sourceRefs: [],
    })).toEqual({
      contextProjectionId: "11111111-1111-4111-8111-111111111111",
      contextProjectionVersion: 4,
      constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
      ventureStateRevisionId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("records a conservative shadow recommendation without changing the configured route", () => {
    const recommendation = buildHeartbeatRouteRecommendation({
      issue: {
        title: "Decide the customer launch promise",
        priority: "medium",
        workMode: "planning",
      },
      contextProjection: {
        id: "11111111-1111-4111-8111-111111111111",
        version: 4,
        constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
        ventureStateRevisionId: "33333333-3333-4333-8333-333333333333",
        creationReason: "Founder committed the next move.",
        createdAt: "2026-08-01T10:00:00.000Z",
        content: {
          purpose: "Keep the founder in control.",
          nonNegotiables: [],
          approvalBoundaries: ["Founder approval is required before public commitments."],
          ventureSummary: "Sysdom AI",
          engines: {
            product: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
            customer: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
            cash: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
            skills: { summary: "Ready", freshness: "2026-08-01T10:00:00.000Z" },
          },
          activeConstraint: {
            engine: "customer",
            hypothesis: "The launch promise is not yet evidenced.",
            confidence: "medium",
            evidence: [],
            decision: "accepted",
            decisionNote: "Test before publishing.",
            decidedByUserId: "user-1",
            decidedAt: "2026-08-01T10:00:00.000Z",
          },
          nextMove: {
            title: "Approve one launch promise.",
            rationale: "Keep public claims bounded.",
            engine: "customer",
            approvalRequired: true,
          },
        },
        sourceRefs: [{ kind: "founder_session", label: "Founder review" }],
      },
      evaluatedAt: "2026-08-01T10:00:00.000Z",
      portfolio: {
        id: "44444444-4444-4444-8444-444444444444",
        version: 1,
        candidates: [{
          provider: "synthetic-provider",
          model: "synthetic/workhorse-v1",
          lane: "workhorse",
          billingType: "free",
          costRank: 1,
          qualityRank: 1,
          enabled: true,
          supportsTools: true,
          supportsStructuredOutput: true,
          supportsConfidentialData: false,
          supportsRestrictedData: false,
          evidence: {
            sourceKind: "manual_review",
            sourceLabel: "Synthetic test catalog",
            sourceUrl: null,
            verifiedAt: "2026-07-31T00:00:00.000Z",
            expiresAt: "2026-08-31T00:00:00.000Z",
          },
        }],
      },
      posture: "cost_conscious",
    });

    expect(recommendation).toMatchObject({
      version: "sysdom_model_route_recommendation_v1",
      mode: "shadow",
      status: "blocked",
      posture: "cost_conscious",
      portfolio: {
        revisionId: "44444444-4444-4444-8444-444444444444",
        version: 1,
      },
      lane: "frontier",
      riskLevel: "high",
      selectedCandidate: null,
      approvalGate: "founder_review_before_execution",
      signals: {
        source: "derived",
        activeEngine: "customer",
        projectionVersion: 4,
        approvalRequired: true,
      },
    });
    expect(recommendation.reason).toContain("no permitted exact model");
  });

  it("uses versioned explicit task signals instead of issue heuristics", () => {
    const recommendation = buildHeartbeatRouteRecommendation({
      issue: {
        title: "Publish a customer commitment",
        priority: "low",
        workMode: "standard",
        executionPolicy: {
          stages: [],
          modelRouteSignals: {
            version: "sysdom_model_route_task_signals_v1",
            taskClass: "specialist",
            criticality: "critical",
            reversible: false,
            externalEffects: ["public", "customer"],
            dataSensitivity: "confidential",
            evidenceRequirement: "independent_review",
            requiresTools: true,
            requiresStructuredOutput: false,
            approvalRequired: true,
          },
        },
      },
      contextProjection: null,
      evaluatedAt: "2026-08-02T10:00:00.000Z",
      portfolio: null,
    });

    expect(recommendation.signals).toMatchObject({
      source: "explicit",
      taskClass: "specialist",
      criticality: "critical",
      reversible: false,
      externalEffects: ["public", "customer"],
      dataSensitivity: "confidential",
      evidenceRequirement: "independent_review",
      approvalRequired: true,
    });
    expect(recommendation.riskLevel).toBe("critical");
    expect(recommendation.approvalGate).toBe("founder_approval_before_external_effect");
  });
});

describe("mergeCoalescedContextSnapshot", () => {
  it("clears stale accepted-plan interaction state when merging a later ordinary comment wake", () => {
    const merged = mergeCoalescedContextSnapshot(
      {
        issueId: "issue-1",
        interactionId: "interaction-1",
        interactionKind: "request_confirmation",
        interactionStatus: "accepted",
        continuationPolicy: "wake_assignee_on_accept",
        wakeReason: "issue_commented",
      },
      {
        issueId: "issue-1",
        commentId: "comment-1",
        wakeCommentId: "comment-1",
        wakeReason: "issue_commented",
      },
    );

    expect(merged.interactionId).toBeUndefined();
    expect(merged.interactionKind).toBeUndefined();
    expect(merged.interactionStatus).toBeUndefined();
    expect(merged.continuationPolicy).toBeUndefined();
    expect(merged.commentId).toBe("comment-1");
    expect(merged.wakeCommentId).toBe("comment-1");
  });

  it("preserves accepted-plan interaction state for the interaction wake itself", () => {
    const merged = mergeCoalescedContextSnapshot(
      {
        issueId: "issue-1",
      },
      {
        issueId: "issue-1",
        interactionId: "interaction-1",
        interactionKind: "request_confirmation",
        interactionStatus: "accepted",
        continuationPolicy: "wake_assignee_on_accept",
        wakeReason: "issue_commented",
      },
    );

    expect(merged.interactionId).toBe("interaction-1");
    expect(merged.interactionKind).toBe("request_confirmation");
    expect(merged.interactionStatus).toBe("accepted");
    expect(merged.continuationPolicy).toBe("wake_assignee_on_accept");
  });
});

describe("summarizeHeartbeatRunContextSnapshot", () => {
  it("keeps only the small retry/linking fields needed by the client", () => {
    const summarized = summarizeHeartbeatRunContextSnapshot({
      issueId: "issue-1",
      taskId: "task-1",
      taskKey: "PAP-1",
      commentId: "comment-1",
      wakeCommentId: "comment-2",
      wakeReason: "retry_failed_run",
      wakeSource: "on_demand",
      wakeTriggerDetail: "manual",
      paperclipWake: {
        comments: [
          {
            body: "x".repeat(50_000),
          },
        ],
      },
      executionStage: {
        summary: "large nested object that should not be sent back in run lists",
      },
    });

    expect(summarized).toEqual({
      issueId: "issue-1",
      taskId: "task-1",
      taskKey: "PAP-1",
      commentId: "comment-1",
      wakeCommentId: "comment-2",
      wakeReason: "retry_failed_run",
      wakeSource: "on_demand",
      wakeTriggerDetail: "manual",
    });
  });

  it("returns null when no allowed fields are present", () => {
    expect(
      summarizeHeartbeatRunContextSnapshot({
        paperclipWake: { comments: [{ body: "hello" }] },
      }),
    ).toBeNull();
  });
});

describe("summarizeHeartbeatRunListResultJson", () => {
  it("keeps only summary fields and parses numeric cost aliases", () => {
    expect(
      summarizeHeartbeatRunListResultJson({
        summary: "Completed the task",
        result: "Updated three files",
        message: "",
        error: null,
        totalCostUsd: "1.25",
        costUsd: "0.75",
        costUsdCamel: "0.5",
      }),
    ).toEqual({
      summary: "Completed the task",
      result: "Updated three files",
      total_cost_usd: 1.25,
      cost_usd: 0.75,
      costUsd: 0.5,
    });
  });

  it("returns null when projected fields are empty", () => {
    expect(
      summarizeHeartbeatRunListResultJson({
        summary: "",
        result: null,
        message: undefined,
        error: "   ",
        totalCostUsd: "abc",
      }),
    ).toBeNull();
  });
});
