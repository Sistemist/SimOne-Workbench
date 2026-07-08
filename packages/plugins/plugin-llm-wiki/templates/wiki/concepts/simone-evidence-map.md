---
title: SimOne Evidence Map
type: concept
tags: [simone, evidence, traceability, auditability]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Evidence Map

This page helps SIM Coach and the wiki maintainer separate shipped behavior,
tested implementation, documented direction, and deferred experiments.

## Evidence labels

- Confirmed live: deployed and smoke-checked, or otherwise verified against the
  live service.
- Implemented and tested: code exists with focused tests or build/typecheck
  coverage.
- Documented direction: product or architecture direction exists, but runtime
  implementation is incomplete.
- Deferred: explicitly not part of the current alpha path.
- Needs stronger evidence: plausible or partially present, but not enough proof
  to call done.

## Current anchors

- The Tissuu bridge is live read-only v1 and is framed as native Customer
  Signal in SimOne. Code lives in
  `server/src/services/customer-engine-bridge.ts`,
  `server/src/routes/customer-engine-bridge.ts`,
  `ui/src/api/customerEngine.ts`, the Customer Engine/Dashboard UI, and their
  focused UI tests.
- The Systems Bottleneck Scanner, Coach handoff, and Sprint Zero handoff are
  productized enough to carry scanner context into SIM Coach and SIM Starter.
  Scanner results include lived example notes, signal strength, secondary
  engine watch, calibration status, and public-safe diagnosis signals;
  real-submission score tuning remains.
- Shareable Venture Architecture Maps include public preview and proof context
  for the opening line, first thing to notice, suggested follow-up ask,
  evidence strength, public-safe omissions, and the next assumption to test.
- SIM Coach and SIM Wiki have first scanner handoff, retrieval, and promotion
  loops, with source refs and maintainer-task provenance.
- `model_route_decisions` is the first auditable route ledger. It now records
  heartbeat adapter execution before an adapter runs, post-run output
  confidence and review status, and cost events can link back to the route
  decision that caused the spend. Operators also have Model routing audit
  filters/actions, run links, and output artifact links in instance settings;
  broader provider orchestration and evals remain.
- `simone_json_headroom_v0` is the local compression baseline. External
  Headroom/SmartCrusher is not wired yet.
- OpenRouter Fusion and Fugu/Fugu Ultra are design lanes, not production roots.
- KVM deploy smoke is the production proof path for runtime changes.
- Linear is the operating trace for issue-level status: `SYS-181`, `SYS-198`,
  `SYS-199`, `SYS-200`, `SYS-201`, and `SYS-202`.

## Rule

If a claim cannot point to a source doc, code path, test or smoke check, deploy
state, and Linear trail when appropriate, treat it as incomplete or design-only
until evidence is added.
