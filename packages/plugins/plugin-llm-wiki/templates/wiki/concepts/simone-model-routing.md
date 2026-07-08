---
title: SimOne Model Routing Strategy
type: concept
tags: [simone, routing, models, auditability]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Model Routing Strategy

This page keeps the model-routing posture close to SIM Wiki so SIM Coach can
explain why SimOne favors auditability during dev mode.

## Current decision

Dev mode favors sovereignty and auditability over orchestration cleverness.
SimOne should record route decisions before depending on black-box routing.
Route decisions should also capture post-run output confidence and review state
so later routers can be compared, rejected, or approved from evidence.
Cost events can now link back to the route decision that caused the spend, which
turns model cost from a loose metric into route-level evidence.
The first operator-facing audit page lives in instance settings and shows recent
decisions, review state, approval boundary, context/output summaries, and linked
cost evidence.

The default order is:

1. Human keeps judgment.
2. SimOne records the route decision.
3. SimOne chooses a lane and approval gate.
4. The selected model, adapter, or experiment lane runs.
5. The result, cost, context, confidence, and human review state are recorded.

## Lanes

- Background: low-risk extraction, summaries, and maintenance.
- Workhorse: normal drafting, synthesis, and bounded analysis.
- Frontier: high-stakes strategy, architecture, SIM Coach review, and audits.
- Deliberation/audit: high-risk or uncertain choices where disagreement matters.
- External specialist: bounded hard execution where an orchestrator may help.

## Fable 5

Fable 5 is the candidate boardroom brain for high-level planning, SIM Coach
deep review, architecture review, product strategy audits, and review of risky
routing decisions. It should not run routine background ticks.

## OpenRouter Fusion

OpenRouter Fusion is a deliberation and audit lane. Use it when parallel
disagreement, contradiction checks, and blind-spot detection are worth the extra
cost and latency.

Good uses: public positioning, security/privacy review, architecture tradeoffs,
conflicting source interpretation, model-router audits, and final review before
paid or customer-facing output.

## Fugu And Fugu Ultra

Fugu/Fugu Ultra is an external specialist lane. Use it later for bounded hard
execution, multi-step research, coding, verification, and comparison against
explicit frontier routes.

Do not put Fugu at the root of SimOne in dev mode. SimOne should judge the
returned work through its own evidence, evaluation, fallback, and human approval
gates.

## Headroom

External Headroom/SmartCrusher is not wired yet.

SimOne currently has a local `simone_json_headroom_v0` JSON compression
envelope for route-decision context payloads. It records hashes, byte counts,
redactions, omitted array items, source kind, and compressed JSON so future
Headroom/SmartCrusher experiments can be compared against a local baseline.

## Product rule

Thomasina should not see providers, routers, model IDs, context envelopes, or
adapter settings during first-run onboarding. She should see what is being
worked on, what is safe to delegate, what needs judgment, what it cost when cost
matters, what was saved as memory, and what evidence supports the recommendation.
