# SimOne Milestone Tracker

Status: Living operator tracker
Date: 2026-07-08
Owner: Han

This is the short companion to `doc/product/simone-prd.md`. Use it when you
want the current completion picture without rereading the full PRD.

## Current Read

SimOne is currently:

- **45-55% complete as a coherent alpha product shell.**
- **25-35% complete as the full SIM operating system.**

The product has enough structure to continue building directly in the live
Workbench, but not enough routing/memory/evaluation infrastructure to trust
black-box orchestration as the root controller.

## Product Stance

During dev mode, sovereignty and auditability win over orchestration cleverness.
If SimOne cannot show who routed work, why it was routed, what context was used,
what model/adapter ran, what it cost, and where the human approved, the system
is not yet trustworthy enough to hide behind an automatic router.

Experimentation is still part of the plan. Fusion, Fugu/Fugu Ultra, Headroom,
and other provider/router layers belong after the sovereign spine is strong
enough to evaluate them.

## Completion By Layer

| Layer | State | What Is Done | Remaining Work |
| --- | ---: | --- | --- |
| Hosted alpha shell | 65% | Authenticated KVM app, one-origin app/API, deploy smoke path | More authenticated visual QA, release checklist |
| Paperclip control-plane reuse | 55% | Companies, agents, tasks, skills, adapters, runs, costs, recovery inherited | Better Thomasina-facing labels, fewer raw control-plane concepts in first run |
| PLG/Barnum layer | 53% | Public scanner, safer share summaries, shareable map interpretation, scanner-to-starter handoff | Stronger Sprint Zero brief, richer share previews, less generic public copy |
| Customer Engine bridge | 78% | Read-only Tissuu bridge live, native dashboard/page card, SIM Wiki proof promotion | More visual QA, lived use, defer write-back v2 |
| SIM Coach and SIM Wiki | 54% | Coach scanner explanations, scanner-to-wiki maintainer retrieval with streamed answer return, inline source-path rendering, returned-answer promotion to wiki, SIM method seed pages, product glossary/flow seed pages | Structured citation metadata, better wiki navigation, broader review promotion |
| Model routing and auditability | 32% | `model_route_decisions` ledger, lane vocabulary, local context compression envelope | Real provider execution, route/run linking, cost review UI, evaluations |
| Compression/headroom | 8% | Local `simone_json_headroom_v0` envelope for bulky JSON route context | Evaluate Headroom/SmartCrusher, compare quality, support RAG/log/transcript payloads |
| Full SIM operating system | 30% | Engines, drivers, governance, bridge, coach/wiki beginnings | SIM Starter, durable operating loops, production hardening |

## Milestone Board

### M0: Foundation And Bridge

Status: mostly complete.

Owned by: `SYS-198`, deployment docs, architecture notes.

Done:

- SimOne Workbench deployed at `https://sim.sysdom.org/app`.
- Authenticated/private app mode works.
- Tissuu Customer Engine bridge v1 is live and read-only.
- KVM deploy script rebuilds only the `paperclip` service and smoke-checks the app.

Remaining:

- Continue authenticated visual QA.
- Keep Tissuu write-back deferred until read-only v1 has lived with Han.

### M1: Native Alpha Experience

Status: in progress.

Owned by: `SYS-181`, `SYS-199`, `SYS-200`, `SYS-201`.

Review artifact: `doc/product/simone-alpha-flow-blueprint.html`.

Done:

- Dashboard and Customer Engine surfaces have native bridge readouts.
- Public scanner and share artifacts have safer public summaries.
- The public scanner now tells users the scan will carry into SIM Starter after
  sign-in and routes them into onboarding with the saved scan context.
- Shareable Venture Architecture Maps now include a public Sprint Zero brief
  for what is clear, what needs proof, and what requires human review.
- SIM Coach explains scanner results with contextual method language.
- The repo now has a PRD, glossary, agent-flow map, and milestone tracker.
- The alpha product-flow blueprint now maps landing, sign-in, messy venture
  intake, guided draft, SIM map, Sprint Zero, diagnosis, next action, settings
  placement, and incomplete-data behavior.

Remaining:

- Review and adjust the first product-flow/wireframe artifact for `SYS-181`.
- Keep improving share previews with richer proof and next-action context.
- Make the Systems Bottleneck Scanner diagnosis richer without exposing private
  notes in public summaries.
- Build a first strong Sprint Zero Brief.

### M2: SIM Starter And SIM Wiki

Status: early.

Owned by: `SYS-181`, `SYS-201`, future starter/wiki issues.

Done:

- SIM Wiki template seeds SIM method pages and SimOne product-language pages.
- Scanner/Coach and Customer Engine readouts can be deliberately promoted into
  durable wiki synthesis pages.
- SIM Coach can queue saved scanner context as an auditable SIM Wiki Maintainer
  retrieval before stronger advice or agent assignment.
- SIM Coach streams returned SIM Wiki answers back into the Coach surface after
  retrieval is queued.
- SIM Coach can save a returned SIM Wiki answer as a dated synthesis page with
  scanner context and maintainer-task provenance.
- SIM Coach renders explicit wiki/raw source paths mentioned in returned answers
  and carries them into saved answer pages.
- Product definitions now exist in repo docs and in future wiki root templates.
- SIM Starter now carries messy venture context into the first Sprint Zero
  "Draft the first SIM map" work item before opening the dashboard.
- The seeded first-map task now shows a compact guide above the editable
  description.

Remaining:

- Store founder source notes and first map drafts with provenance.
- Add structured citation metadata beyond answer-text path extraction.
- Add broader review/decision promotion paths beyond scanner-derived answers.

### M3: Sovereign Model Routing

Status: started.

Owned by: `SYS-202`.

Done:

- Lane vocabulary exists: background, workhorse, frontier,
  deliberation/audit, external specialist.
- Route decision records exist.
- Route decisions can attach compressed JSON context envelopes.

Remaining:

- Connect route decisions to actual model/provider execution.
- Link route decisions to run records, costs, outputs, confidence, and review
  status.
- Add advanced routing/cost review surfaces.
- Add evaluation cases before relying on any router.

### M4: Compression And Context Infrastructure

Status: proof of baseline only.

Owned by: `SYS-202` or a future dedicated compression issue.

Done:

- Local audited JSON context compression exists for route-decision
  `contextPayload`.
- Compression metadata records hashes, byte counts, redactions, omissions, and
  compressed JSON.

Remaining:

- Evaluate external Headroom/SmartCrusher on real SimOne payloads.
- Compare compressed-context answer quality against uncompressed baselines.
- Extend beyond JSON route payloads to wiki retrieval, logs, transcripts, and
  scanner context.

### M5: Experiment Lane

Status: design only.

Owned by: `SYS-202`.

Done:

- OpenRouter Fusion is defined as the high-risk deliberation/audit lane.
- Fusion is specifically reserved for critical, high-risk, or uncertain tasks
  where disagreement and blind-spot detection are useful.
- Fugu/Fugu Ultra is defined as an optional specialist execution adapter, not
  the root controller.
- Fable 5 is defined as a possible boardroom brain/meta-review model.

Remaining:

- Add provider credentials and execution wrappers when Han decides to test.
- Build evaluation harnesses before using these lanes in production workflows.
- Compare explicit frontier routes against Fusion and Fugu outputs.
- Keep all experiment output behind SimOne review and approval gates.

### M6: Productization

Status: future.

Owned by: future release/product issues.

Remaining:

- Onboarding polish.
- Recurring workflows.
- Billing/cost visibility.
- Tenant isolation hardening.
- Secret-handling review.
- Support/documentation flow.
- Release and rollback checklist.

## Next Best Sequence

1. Finish `SYS-181`: product-flow blueprint and first-screen behavior map.
2. Push M1 polish: share artifacts, scanner, Customer Engine, Coach handoffs.
3. Build the messy-input SIM Starter path.
4. Expand SIM Wiki/SIM Coach retrieval and answer promotion.
5. Build M3 provider execution behind the sovereign route ledger.
6. Evaluate Headroom/SmartCrusher against the local compression baseline.
7. Test Fusion and Fugu/Fugu Ultra as optional lanes, not foundations.

## Decision Register

- SimOne is the product shell and SIM operating layer.
- Paperclip remains the base/reference control plane.
- Tissuu remains Han's stable Customer Engine for now.
- Tissuu bridge v1 stays read-only.
- Model/provider complexity stays hidden from Thomasina by default.
- Dev mode favors sovereignty and auditability.
- Experiment mode comes after SimOne can evaluate and log routing behavior.
