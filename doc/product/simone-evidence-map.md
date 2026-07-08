# SimOne Evidence Map

Status: Living traceability map
Date: 2026-07-08
Owner: Han

This page answers: "Which SimOne claims are backed by current docs, code,
tests, deploy evidence, or Linear notes?"

It is intentionally blunt. A claim can be useful and still be design-only. A
claim can be implemented and still need better visual QA. The goal is to keep
SimOne auditable while we build it.

## 1. Evidence Labels

| Label | Meaning |
| --- | --- |
| Confirmed live | Deployed and smoke-checked, or otherwise verified against the live service |
| Implemented and tested | Code exists with focused tests or build/typecheck coverage |
| Documented direction | Product/architecture direction exists, but runtime implementation is incomplete |
| Deferred | Explicitly not part of the current alpha path |
| Needs stronger evidence | Plausible or partially present, but not enough current proof to treat as done |

## 2. Product And Docs Traceability

| Claim | Current evidence | Status | Next proof needed |
| --- | --- | --- | --- |
| SimOne is the hosted product shell and SIM operating layer | `ARCHITECTURE.md`, `doc/product/simone-prd.md` | Documented direction | Continue aligning runtime screens with product language |
| Paperclip remains the base/reference control plane | `ARCHITECTURE.md`, `doc/product/simone-workbench-field-guide.md`, inherited Paperclip routes/UI | Implemented and documented | Keep reducing raw control-plane language in first-run flows |
| The docs now explain PRD, architecture, terms, flows, routing, and Workbench surfaces | `doc/product/simone-docs-index.md`, PRD, glossary, flow map, routing strategy, field guide | Implemented and tested through SIM Wiki seed coverage | Add this evidence map to SIM Wiki seed and keep it current |
| SIM Wiki can bootstrap durable SimOne definitions | `packages/plugins/plugin-llm-wiki/src/templates.ts`, `packages/plugins/plugin-llm-wiki/templates/wiki/concepts/*`, `packages/plugins/plugin-llm-wiki/tests/plugin.spec.ts` | Implemented and tested | Broaden wiki navigation and refresh routines around new concept pages |

## 3. Runtime Feature Traceability

| Claim | Code / evidence | Status | Next proof needed |
| --- | --- | --- | --- |
| KVM deployment is the current production path | `scripts/deploy-simone-kvm.sh`, `ARCHITECTURE.md` | Confirmed live | Keep release checklist and rollback notes current |
| Authenticated app mode is expected | Production health response in deploy smoke; `ARCHITECTURE.md` | Confirmed live | Authenticated visual QA inside the app |
| Tissuu bridge is live read-only v1 and framed as native Customer Signal | `server/src/services/customer-engine-bridge.ts`, `server/src/routes/customer-engine-bridge.ts`, `ui/src/api/customerEngine.ts`, `ui/src/components/CustomerEngineBridgeCard.tsx`, `ui/src/pages/CustomerEngine.tsx`, `ui/src/pages/Dashboard.tsx`, `ui/src/pages/CustomerEngine.test.tsx`, `ui/src/pages/Dashboard.test.tsx` | Confirmed live / implemented and tested | More authenticated visual QA and lived use |
| Tissuu bridge write-back is deferred | `ARCHITECTURE.md`, PRD, milestone tracker | Deferred | Revisit only after Han has lived with read-only v1 |
| Public Systems Bottleneck Scanner includes lived examples, signal strength, calibration status, safe diagnosis signals, and handoffs to Coach and Starter | `ui/src/components/FrontDoor.tsx`, `ui/src/pages/SystemsBottleneckScanner.tsx`, `ui/src/pages/SystemsBottleneckScanner.test.tsx`, `ui/src/pages/SimCoach.tsx`, `ui/src/components/OnboardingWizard.tsx`, scanner-related tests, PRD | Implemented and tested | Tune scoring against real submissions without exposing private notes |
| Sprint Zero Brief carries into SIM Starter | `ui/src/components/OnboardingWizard.tsx`, `ui/src/components/OnboardingWizard.simone-starter.test.tsx`, `ui/src/components/SimOneSprintZeroGuide.tsx` | Implemented and tested | Better first-map review workflow |
| Shareable Venture Architecture Map includes public preview and proof context | `ui/src/pages/Artifacts.tsx`, `ui/src/pages/VentureShare.tsx`, `ui/src/pages/VentureShare.test.tsx`, PRD | Implemented and tested | Stronger visual previews and lived public feedback |
| Customer Engine proof/readout can be promoted into SIM Wiki | `ui/src/pages/CustomerEngine.tsx`, SIM Wiki plugin actions, PRD | Implemented and tested in product path | Broader review/decision promotion paths |
| SIM Coach explains scanner results and distinguishes Coach/Wiki/control plane | `ui/src/pages/SimCoach.tsx`, `ui/src/pages/SimCoach.test.tsx`, scanner handoff in `ui/src/pages/SystemsBottleneckScanner.tsx`, PRD | Implemented and tested | More contextual Coach entry points beyond scanner |
| SIM Coach can retrieve from SIM Wiki and save returned answers | `ui/src/pages/SimCoach.tsx`, `ui/src/pages/SimCoach.test.tsx`, plugin query/write actions | Implemented and tested | Stronger source graph and broader answer promotion |

## 4. Model, Routing, And Compression Traceability

| Claim | Code / evidence | Status | Next proof needed |
| --- | --- | --- | --- |
| Dev mode favors sovereignty and auditability | `ARCHITECTURE.md`, `doc/product/simone-model-routing.md`, milestone tracker | Documented direction | Keep model settings out of first-run UI while adding advanced review surfaces |
| Route decisions have an initial ledger | `packages/db/src/schema/model_route_decisions.ts`, `server/src/routes/costs.ts`, `packages/shared/src/validators/model-route-decision.ts`, `server/src/__tests__/model-route-decisions-routes.test.ts` | Implemented and tested | Link decisions to actual provider execution, runs, outputs, confidence, and review status |
| Local JSON context compression exists | `server/src/services/context-compression.ts`, `server/src/__tests__/model-route-decisions-routes.test.ts` | Implemented and tested | Evaluate answer quality against uncompressed baselines |
| External Headroom/SmartCrusher is wired | PRD and architecture explicitly say not wired | Deferred | Evaluate on Tissuu bridge payloads, scanner context, wiki retrieval, logs, and transcripts |
| OpenRouter Fusion is available as a production route | Routing strategy reserves it for future deliberation/audit | Documented direction | Add credentials/wrapper/evals before use |
| Fugu/Fugu Ultra is available as a production route | Routing strategy reserves it for future external specialist experiments | Documented direction | Add credentials/wrapper/evals before use |
| Fable 5 is the default model | Architecture says it is a candidate boardroom brain only | Documented direction | Verify key/access and wire sparingly behind route ledger |

## 5. Linear Traceability

| Workstream | Linear issue | Current map |
| --- | --- | --- |
| Product-flow blueprint, docs, first-screen behavior | `SYS-181` | PRD, docs index, field guide, evidence map, alpha-flow blueprint |
| Tissuu Customer Engine bridge | `SYS-198` | Bridge live/read-only; write-back deferred |
| Shareable venture artifacts | `SYS-199` | Shareable Venture Architecture Map exists with public preview and proof context; stronger visual previews and lived public feedback remain |
| Public Systems Bottleneck Scanner | `SYS-200` | Scanner, lived examples, signal strength, secondary engine watch, calibration status, safe diagnosis signals, and Sprint Zero handoff exist; real-submission score tuning remains |
| SIM Coach methodology loop | `SYS-201` | Scanner-to-Coach handoff, Coach/Wiki definitions, retrieval, answer promotion, wiki seeds |
| Auditable model routing and escalation lanes | `SYS-202` | Route ledger, local compression, routing strategy; provider execution remains |

## 6. How To Use This Map

When a future PRD claim feels fuzzy, do not ask "does this sound right?" Ask:

1. Where is the source-of-truth doc?
2. Where is the code?
3. Which test or smoke check covers it?
4. Is it deployed?
5. Is it reflected in Linear?
6. Is it safe for Thomasina, or is it an advanced/operator surface?

If the answer is missing or indirect, treat the claim as incomplete until the
evidence is added.
