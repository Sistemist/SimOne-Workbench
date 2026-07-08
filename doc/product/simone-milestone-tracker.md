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
| Paperclip control-plane reuse | 60% | Companies, agents, tasks, skills, adapters, runs, costs, recovery inherited; PRD/glossary/field guide now translate Paperclip terms and screens into SimOne language | Keep reducing raw control-plane concepts in first run |
| PLG/Barnum layer | 65% | Public scanner, lived example notes, signal strength, secondary engine watch, calibration status, safer share summaries, diagnosis signals, shareable map interpretation, public preview, public proof context, scanner-to-coach and scanner-to-starter handoffs, structured Sprint Zero brief | Visual share polish, score tuning against real submissions |
| Customer Engine bridge | 80% | Read-only Tissuu bridge live, native Customer Signal framing on dashboard/page, SIM Wiki proof promotion | More authenticated visual QA, lived use, defer write-back v2 |
| SIM Coach and SIM Wiki | 60% | Scanner-to-Coach handoff, Coach scanner explanations, scanner-to-wiki maintainer retrieval with streamed answer return, structured answer source refs, returned-answer promotion to wiki, SIM Starter source-note provenance, SIM method/product seed pages | Better wiki navigation, broader review promotion |
| Model routing and auditability | 44% | `model_route_decisions` ledger, lane vocabulary, local context compression envelope, output confidence/review fields, cost-event route links, run-detail links, settings audit page with review filters/actions | Real provider execution, output artifact linking, evaluations |
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

- Dashboard and Customer Engine surfaces frame the bridge as native Customer
  Signal: live customer signal, next human judgment, and company memory.
- Public scanner and share artifacts have safer public summaries.
- Public scanner results now explain why an engine was selected through
  public-safe diagnosis signals rather than raw founder-note quotes.
- Public scanner results now offer an `Ask SIM Coach why` handoff through
  sign-in so method explanation starts from the saved scan context before work
  is assigned.
- Public scanner now includes four lived example notes for customer follow-up,
  cash runway, skills capacity, and product proof so users can try the scanner
  without writing a perfect first prompt.
- Public scanner results now show signal strength and a secondary engine to
  watch when a messy note points to more than one engine.
- Public scanner results now show a calibration status that names the result as
  an early pattern match, says real submission review is still needed, and
  confirms raw notes and URLs stay out of public summaries.
- The public scanner now tells users the scan will carry into SIM Starter after
  sign-in and routes them into onboarding with the saved scan context.
- Shareable Venture Architecture Maps now include a public Sprint Zero brief
  for what is clear, what needs proof, and what requires human review.
- Shareable Venture Architecture Maps now include proof context: evidence
  strength, public-safe omissions, and the next assumption to test.
- Shareable Venture Architecture Maps now include a public preview with an
  opening line, the first thing to notice, and the suggested follow-up ask.
- The public Systems Bottleneck Scanner now produces a structured Sprint Zero
  brief with what is clear, what needs proof, human review boundaries, and the
  first move; that brief carries into SIM Starter after sign-in.
- SIM Coach explains scanner results with contextual method language.
- SIM Coach now explains in-app that Coach explains/protects judgment, SIM Wiki
  preserves durable memory, and the control plane tracks delegated work.
- The repo now has a PRD, glossary, agent-flow map, and milestone tracker.
- The PRD, glossary, and SIM Wiki seeds now translate inherited Paperclip
  concepts into SimOne/Thomasina language and define which surface owns which
  job.
- The Workbench field guide now explains inherited Paperclip dashboard, tasks,
  agents, runs, costs, approvals, recovery, settings, secrets, documents,
  artifacts, and routines in SimOne language.
- The evidence map now links major PRD claims to docs, code paths, tests,
  deploy proof, Linear issues, and remaining proof gaps.
- The repo and SIM Wiki seeds now include a SimOne documentation index that
  tells Han, Coach, and future wiki maintainers what to read first and which
  document answers which kind of question.
- The repo and SIM Wiki seeds now include a dedicated model-routing strategy
  page for sovereignty-first dev mode, Fable 5, Fusion, Fugu/Fugu Ultra, and
  Headroom status.
- The alpha product-flow blueprint now maps landing, sign-in, messy venture
  intake, guided draft, SIM map, Sprint Zero, diagnosis, next action, settings
  placement, and incomplete-data behavior.

Remaining:

- Review and adjust the first product-flow/wireframe artifact for `SYS-181`.
- Keep improving share previews with stronger visual treatment and lived public
  feedback.
- Tune Systems Bottleneck Scanner scoring against real submissions without
  exposing private notes in public summaries.

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
- SIM Wiki query completion events now carry structured wiki/raw answer source
  refs, and SIM Coach preserves those refs in rendered answers and saved-page
  provenance.
- Product definitions now exist in repo docs and in future wiki root templates.
- SIM Starter now carries messy venture context into the first Sprint Zero
  "Draft the first SIM map" work item before opening the dashboard.
- SIM Starter first-map work items now store source-note provenance, capture
  time, optional scanner handoff context, and first-map draft provenance in the
  task itself.
- The seeded first-map task now shows a compact guide above the editable
  description, including a reminder to check source provenance.

Remaining:

- Add broader review/decision promotion paths beyond scanner-derived answers.

### M3: Sovereign Model Routing

Status: started.

Owned by: `SYS-202`.

Done:

- Lane vocabulary exists: background, workhorse, frontier,
  deliberation/audit, external specialist.
- Route decision records exist.
- Route decisions can attach compressed JSON context envelopes.
- Route decisions can be updated after execution with output summary,
  confidence, review status, and review note.
- Operators can review recent route decisions from instance settings and mark
  them approved, rejected, or in need of revision with a note.
- Operators can filter the audit surface by review status.
- Route decisions with a recorded heartbeat run now link to that run detail.

Remaining:

- Connect route decisions to actual model/provider execution.
- Deepen route decisions into provider/run output artifacts.
- Add richer routing/cost review surfaces.
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
- `doc/product/simone-model-routing.md` now keeps the model/router decision
  logic in one reader-friendly source.

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
