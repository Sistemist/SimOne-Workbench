# SimOne Model Routing Strategy

Status: Living strategy note
Date: 2026-07-08
Owner: Han

This page answers: "Which model or router should SimOne use for which kind of
work, and how do we avoid losing auditability while building?"

## 1. Current Decision

Dev mode favors sovereignty and auditability over orchestration cleverness.
SimOne should not make a black-box router the root of trust while the product is
still being built.

The default architecture is:

1. Human keeps judgment.
2. SimOne records the route decision.
3. SimOne chooses an explicit lane and approval gate.
4. The selected model, adapter, or experiment lane runs.
5. The result, cost, context, confidence, and human review state are recorded.

That means Fable 5, OpenRouter Fusion, Fugu/Fugu Ultra, and Headroom can all
fit into SimOne, but only behind an inspectable route ledger and quality gate.
The first route-to-cost evidence link now exists: cost events can point back to
the model route decision that caused the spend.
The first operator-facing audit view also exists in instance settings, showing
recent decisions, review state, approval boundary, context/output summaries,
linked cost evidence, and review filters/actions for approved, needs-revision,
or rejected outcomes. When a route decision has a recorded run id, the audit row
links to that run detail. When review metadata includes generated output
artifacts, the audit row links to those Artifacts work products.

## 2. Why This Matters

If SimOne cannot show who routed work, why the route was chosen, what context
was supplied, which model or adapter ran, what it cost, and where the human
approved, then SimOne is not ready to hide the routing layer behind automation.

The goal is not to avoid experimentation. The goal is to run experiments from a
position where SimOne can compare, reject, fallback, and explain.

## 3. Routing Lanes

| Lane | Use For | Not For | Audit Requirement |
| --- | --- | --- | --- |
| Background | Low-risk extraction, summaries, maintenance, housekeeping | Public claims, customer action, money, governance | Log intent, provider/model, context summary, and cost |
| Workhorse | Normal drafting, synthesis, product-flow help, bounded analysis | Final high-risk approval or irreversible action | Log route, output, cost, and review state |
| Frontier | Strategy, architecture, SIM Coach deep review, code review, audits | Routine ticks or cheap background work | Log why a stronger model was justified |
| Deliberation/audit | High-risk or uncertain decisions where disagreement is useful | Routine summarization or quick extraction | Log prompt, disagreement, blind spots, synthesis, and approval gate |
| External specialist | Bounded hard execution where an orchestrator may help | Root control, hidden customer/money/public actions | Log the task boundary, returned result, evaluation, fallback, and review |

## 4. Fable 5

Fable 5 is the candidate boardroom brain. Use it sparingly for:

- high-level planning
- SIM Coach deep methodology review
- architecture review
- product strategy audits
- review of risky routing decisions

Do not use it for routine background agent ticks. It should sit above or beside
the normal workhorse lanes as a reviewer or meta-controller, not burn budget on
low-risk housekeeping.

## 5. OpenRouter Fusion

OpenRouter Fusion is a deliberation and audit lane.

Use it when the value comes from multiple views:

- high-risk public positioning
- security, privacy, or data-loss review
- architecture choices with unclear tradeoffs
- conflicting source interpretation
- model-router evaluations
- final review before paid or customer-facing output

Fusion is not the normal work router. Its cost and latency make sense when
disagreement, blind spots, and second opinions are the point.

## 6. Fugu And Fugu Ultra

Fugu/Fugu Ultra is an external specialist lane.

Use it later for bounded experiments such as:

- difficult coding or verification tasks
- multi-step research
- hard execution where an orchestrator can coordinate workers
- comparison against explicit frontier routes

Do not put Fugu at the root of SimOne in dev mode. If the internals are not
fully auditable, SimOne should treat the result as a candidate output that must
pass its own evaluation and human approval gates.

## 7. Headroom And Context Compression

External Headroom/SmartCrusher is not wired yet.

Current implementation status:

- SimOne has a local `simone_json_headroom_v0` compression envelope for
  route-decision `contextPayload` input.
- The envelope records input and output hashes, byte counts, redacted keys,
  omitted array items, source kind, and compressed JSON.
- This is a baseline so future Headroom/SmartCrusher experiments can be
  compared against known local behavior.

First evaluation targets:

- Tissuu bridge payloads
- scanner context and Sprint Zero briefs
- SIM Wiki retrieval chunks
- run transcripts and logs

The quality check is not "did it save tokens?" alone. The check is whether the
compressed context preserves enough meaning for the model to make the same or a
better decision.

## 8. Routing Decision Checklist

Before a model run matters, SimOne should know:

- What is the user trying to decide or delegate?
- What is the risk level?
- What context is needed, and what was omitted or compressed?
- Which lane is appropriate?
- Which model, provider, adapter, or experiment endpoint will run?
- What would trigger escalation or fallback?
- Does this require human approval before external impact?
- How will the output be evaluated?

## 9. Product UI Rule

Thomasina should not see providers, routers, model IDs, context envelopes, or
adapter settings during first-run onboarding.

She should see:

- what is being worked on
- what the system thinks is safe to delegate
- what needs her judgment
- what it cost when cost matters
- what was saved as memory
- what evidence supports the recommendation

Advanced routing settings belong in admin and review surfaces after the basic
product experience is useful.

## 10. Implementation Sequence

1. Keep improving the route decision ledger.
2. Link route decisions to real model/provider execution. The first heartbeat
   adapter execution hook is now in place: it records the route decision before
   the adapter runs, updates output review state after completion, and links
   automatic spend back to that decision.
3. Link route decisions to run records and output artifacts. Cost links, output
   confidence, review status, run-detail links, output artifact links, and the
   first settings audit/review page are now in place.
4. Add evaluation cases before relying on routers.
5. Evaluate Headroom/SmartCrusher against local compression output.
6. Add Fusion as a high-risk deliberation/audit lane.
7. Add Fugu/Fugu Ultra as optional external specialist lanes.
8. Compare all experiment lanes against explicit frontier routes.
