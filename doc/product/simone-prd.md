# SimOne Product Requirements Document

Status: Living alpha PRD
Date: 2026-07-08
Owner: Han
Primary workspace: `/Users/sistemist/Desktop/SimOne-Workbench`

## 1. Purpose

SimOne is the hosted product shell and operating layer for the Systems
Intelligence Model (SIM). It turns SIM from a book/course/body of theory into a
usable workspace where a nontechnical founder can understand, improve, and
delegate work across a venture without being dropped into model/provider setup,
agent sprawl, or abstract systems diagrams on day one.

Paperclip remains the base/reference control plane. SimOne keeps Paperclip's
useful company, task, agent, skill, adapter, run, cost, and recovery mechanics,
then adds a SIM-native product shell, templates, coaching, memory, growth
artifacts, and human judgment gates on top.

## 2. Current Completion Snapshot

These percentages are ballpark product-completion estimates, not engineering
certifications.

| Layer | Completion | Evidence |
| --- | ---: | --- |
| Hosted alpha shell | 65% | KVM deployment, auth-gated app, health checks, SimOne routes, deploy script |
| Paperclip control-plane reuse | 55% | Paperclip app deployed as SimOne Workbench; starter direction and UI copy partially adapted |
| PLG/Barnum layer | 52% | Public scanner, shareable venture maps, methodology loop beginnings; share artifacts now have safer public readouts |
| Customer Engine bridge | 78% | Read-only Tissuu bridge live; Customer Engine page can promote a proof readout into SIM Wiki without mutating Tissuu |
| SIM Coach and SIM Wiki | 48% | Product direction documented; contextual coach loop explains scanner results; Coach can queue an auditable SIM Wiki maintainer retrieval from scanner context; Coach and Customer Engine can save and reopen promoted syntheses in SIM Wiki; new wiki roots include SimOne product-language, PRD snapshot, glossary, and agent-flow pages |
| Model routing and auditability | 32% | Strategy documented; Workbench has an initial `model_route_decisions` ledger; route decisions can now attach a compressed context envelope; actual provider orchestration and evaluations remain |
| Compression/headroom | 8% | External Headroom/SmartCrusher not integrated; SimOne now has a local audited JSON compression envelope for route-decision context payloads |
| Full SIM operating system | 30% | Engines and governance are defined, but onboarding, memory, routing, evaluations, and product polish remain |

Overall: SimOne is roughly 45-55% complete as a coherent alpha product shell and
25-35% complete as the full SIM operating system.

## 3. Target User

The primary target user remains Thomasina: nontechnical, curious about agents,
and easily scared by CTO words. She wants help building, teaching, selling, or
operating a venture, but she does not want to begin by choosing models, setting
adapter profiles, drawing engine diagrams, or learning a new control-plane
taxonomy.

For Thomasina, SimOne should feel like:

- "I can put my messy idea here."
- "The system drafts a first useful map."
- "It shows me what needs my judgment."
- "It explains the method only when I ask or when the explanation helps."
- "Agents work in bounded roles; they do not become an unmanaged swarm."

## 4. Product Principles

1. Useful output before theory.
2. Sign in first; protect the user's work.
3. Hide model/provider complexity by default.
4. Keep human judgment at public, financial, customer, governance, and
   cross-engine boundaries.
5. Prefer inspectable, sovereign routing while SimOne is in dev mode.
6. Use black-box orchestration only as a bounded experiment or specialist
   adapter until it proves itself under evaluation.
7. Keep Tissuu stable and read-only from SimOne until bridge v1 has earned a
   write-back phase.
8. Preserve upstream Paperclip conventions where they reduce maintenance cost.

## 5. Product Boundary

### In Scope

- Authenticated SimOne workspace at `https://sim.sysdom.org/app`.
- SIM Starter onboarding that drafts an initial venture map from messy input.
- Venture Architecture Map.
- Systems Bottleneck Scanner.
- Sprint Zero Brief.
- Customer Engine Readout from the read-only Tissuu bridge.
- SIM Coach contextual guidance.
- SIM Wiki inspectable memory/knowledge layer.
- Shareable public artifacts with private-data protection.
- Model routing policy, audit ledger, costs, evaluations, and advanced settings.
- Headroom-style compression layer for large JSON/tool/RAG contexts.

### Out Of Scope For Current Alpha

- Migrating Tissuu into SimOne.
- Writing back to Tissuu from SimOne.
- Making model/provider selection part of first-run onboarding.
- Treating Fugu, Fusion, or another black-box router as the root controller.
- Rebuilding Paperclip's core control plane unless SimOne needs a narrow product
  adaptation.
- Generic course ads inside the product.

## 6. What Exists Today

### Workbench Foundation

SimOne Workbench is based on Paperclip. Paperclip supplies:

- company-scoped workspaces
- authenticated app shell
- tasks/issues
- agents and teams
- skills
- adapters
- runs and transcripts
- cost/usage capture
- recovery states
- embedded or external PostgreSQL
- deployment-compatible Docker runtime

SimOne adds:

- SimOne branding and product direction
- authenticated KVM deployment
- SIM Starter direction
- PLG surfaces
- Tissuu Customer Engine bridge
- SIM Coach methodology loop beginnings

### SIM Starter

The authenticated starter path now begins with a company name and messy venture
context rather than model/provider setup. On creation, SimOne installs the
bundled SIM Starter team and Sprint Zero project, then attaches the messy input
to the first "Draft the first SIM map" work item. That task asks for a plain
venture map, Product/Customer/Cash/Skills assumptions, unknowns that need proof,
the first Sprint Zero move, and approval before agents act on customers, money,
public claims, or company structure. After setup, the user lands on that seeded
Sprint Zero work item instead of a generic dashboard whenever the task can be
resolved. That work item now shows a compact first-map guide above the editable
description so the first workspace feels guided rather than like a standard
task page.

### Tissuu Bridge

Bridge v1 is live and read-only. SimOne reads:

- `/digest`
- `/actions`
- `/metrics`
- `/ops`

SimOne must not invent bridge status. If the bridge is unavailable, the UI shows
an unavailable state. All action still happens in Tissuu through deep links.
When the SIM Wiki plugin is ready, the Customer Engine page can promote a
deliberate proof/readout page into `wiki/synthesis/`; this records the
review-worthy pattern and provenance while leaving live counts and Tissuu
operations in Tissuu.

### PLG/Barnum Layer

SimOne should use simple language and shareable outputs to make SIM useful
before the user understands the theory. Current PLG directions:

- shareable Venture Architecture Map
- public Systems Bottleneck Scanner
- Sprint Zero Brief
- Customer Engine Readout
- contextual "Ask SIM Coach" and "Learn why"

Current share artifact behavior:

- The Artifacts surface can create a shareable Venture Architecture Map.
- The generated link uses the current public origin so it can be handed to
  another person directly.
- The public page explains what the map means in plain language, summarizes
  operating roles, work streams, and next moves, includes a public Sprint Zero
  brief for what is clear, what needs proof, and what requires human review, and
  omits adapter/runtime/model setup details.
- The public Systems Bottleneck Scanner produces a safe share summary containing
  the likely bottleneck, engine focus, and next move while excluding the raw
  founder note and startup URL. After a scan, it tells the user the scan will
  carry into SIM Starter after sign-in and routes them to onboarding with the
  saved scan context in protected browser storage.

### SIM Coach

SIM Coach is the contextual explainer and reviewer. It should answer:

- What does this mean?
- Why is this a bottleneck?
- What should I decide?
- What is safe to delegate?
- What is the SIM concept underneath this moment?

SIM Coach is not a generic chatbot and not the top-level execution engine. It is
a product surface that helps the human keep judgment.

Current Coach behavior:

- Reads the latest public scanner result from local protected browser state.
- Explains the bottleneck in plain language.
- Names the method underneath the moment, such as a customer review loop,
  money decision loop, ownership loop, or product proof loop.
- Points to SIM Wiki/course methodology only after the user has context for why
  the explanation matters.
- Shows a SIM Wiki Seed Map naming the first durable memory buckets: method
  pages, venture memory, and explicit promotion rules.
- When SIM Wiki is enabled, can promote a saved scanner/coach synthesis into a
  dated page under `wiki/synthesis/` through the existing SIM Wiki plugin
  `write-page` action.
- Shows an "Open saved page" link after promotion so saved memory is immediately
  inspectable.

### SIM Wiki

SIM Wiki is the inspectable memory/knowledge substrate. The first alpha path is
to reframe Paperclip's LLM Wiki plugin as SIM Wiki instead of adopting a new
memory vendor first.

SIM Wiki should store:

- uploaded founder/source material
- SIM/book/course concepts
- venture/project standing context
- durable decisions and synthesis
- provenance and change history

It should not silently absorb ephemeral live bridge counts or private customer
queues without a deliberate promotion action.

Current SIM Wiki template behavior:

- Bootstraps SIM method pages for engines, drivers, system laws, archetypes, and
  coaching guidance.
- Bootstraps `wiki/concepts/simone-product-language.md`,
  `wiki/concepts/simone-prd.md`, `wiki/concepts/simone-glossary.md`, and
  `wiki/concepts/simone-agent-flows.md` so product direction, milestone state,
  Thomasina-facing vocabulary, hidden provider choices, Fusion/Fugu experiment
  boundaries, and human-in-the-loop agent flow have durable first definitions.
- Accepts the first Coach-driven promotion path: scanner syntheses can become
  durable pages while live bridge counts remain ephemeral.
- Lets SIM Coach queue a SIM Wiki Maintainer query from saved scanner context
  before stronger advice or agent assignment, with the generated maintainer task
  visible for inspection.
- Accepts the first Customer Engine promotion path: a live read-only Tissuu
  readout can become a dated SIM Wiki synthesis page when the human chooses to
  preserve it.

## 7. Model And Agent Strategy

### Dev Mode Stance

During dev mode, sovereignty and auditability matter more than orchestration
cleverness. SimOne needs to know:

- who routed the work
- why that route was chosen
- what context was supplied
- which model/adapter/agent ran
- what it cost
- what output was accepted or rejected
- where the human approved or overrode the result

The root routing layer should therefore be explicit and inspectable.

Workbench now has an initial `model_route_decisions` table and company-scoped
API for recording the chosen lane, provider/model, reason, risk level, context
summary, approval gate, and metadata before execution. This is the first
concrete routing ledger primitive, not a full router yet.

Route decisions can also accept an optional bulky JSON `contextPayload`. SimOne
compresses that payload into `metadata.contextCompression` using the local
`simone_json_headroom_v0` strategy, recording source kind, input/output byte
counts, input/output hashes, redacted keys, omitted array items, and the
compressed JSON string. This keeps the audit spine explicit before model calls
consume large bridge/tool/RAG payloads.

### Fable 5

Fable 5 is a candidate "boardroom brain" or meta-controller for high-level SIM
Coach, strategy, architecture review, and audits when an API key is available
and current model access is verified. It should not run routine background agent
ticks.

### OpenRouter Fusion

OpenRouter Fusion is a candidate high-risk deliberation lane. Official
OpenRouter docs describe it as a multi-model deliberation router: a panel of
models answers in parallel, a judge compares consensus, contradictions,
coverage gaps, unique insights, and blind spots, and the outer model uses that
analysis to produce the final answer.

Use Fusion when the cost of being wrong is higher than the cost and latency of
extra model calls:

- public positioning or claims
- high-risk architecture decisions
- security, privacy, or data-loss review
- conflicting source interpretation
- final review before paid/customer-facing outputs
- model-router audits where disagreement itself is valuable

Fusion should be an escalation layer above normal routing, not the default path
for routine extraction, summarization, or background agent ticks.

### Fugu And Fugu Ultra

Sakana Fugu is a candidate specialist adapter, not the default SimOne root
controller. Official Sakana docs describe Fugu as an OpenAI-compatible API that
dynamically coordinates a model pool. Fugu Ultra routes between one and three
agents for hard tasks and has fixed token pricing. Sakana also documents
provider/model opt-out controls.

This is useful, but it is still not a full SimOne audit ledger. SimOne should
use Fugu/Fugu Ultra later for bounded experiments such as deep coding,
multi-step research, or hard execution/verification, with outputs judged by
SimOne's own controller/evaluation layer.

Fusion and Fugu solve different problems. Fusion is best treated as a
deliberation/audit lane when disagreement and blind spots matter. Fugu is best
treated as a specialist execution-orchestration lane when the system wants one
API to coordinate workers on a hard task.

### Headroom

Headroom is a strong candidate for compression before large JSON, code, log,
tool-output, RAG, and transcript payloads hit model context. Its documented
pipeline includes content routing, SmartCrusher for JSON, code-aware
compression, local reversible storage, and cache-aligned prefixes.

SimOne has not implemented Headroom yet. It belongs in the model/context
infrastructure milestone, not in the public first-use UI.

Current implementation status: the external Headroom/SmartCrusher provider is
not wired. SimOne now has a local, deterministic JSON compression envelope for
route-decision context payloads. It is lossy, redacts obvious secret-bearing
keys, samples long arrays, truncates long strings, and stores hashes and byte
counts so later Headroom or SmartCrusher integration can be compared against a
known internal baseline.

## 8. Required Product Surfaces

### Public

- Landing page.
- Public Systems Bottleneck Scanner.
- Shareable Venture Architecture Map.
- Shareable Systems Bottleneck Scan.
- Early access / signup path.

### Authenticated

- Dashboard.
- SIM Starter.
- Venture Architecture Map workspace.
- Customer Engine page/card.
- Sprint Zero Brief.
- SIM Coach contextual panel or cards.
- SIM Wiki/Knowledge browser.
- Agent/task execution surfaces inherited from Paperclip.
- Advanced model/routing settings hidden from default onboarding.

### Admin/Advanced

- Model provider keys and policies.
- Routing lane definitions.
- Run ledger and cost review.
- Compression status.
- Memory/wiki provider configuration.
- Bridge configuration status without secrets.

## 9. Milestones

### M0: Foundation And Bridge

Status: Mostly complete.

- Deploy SimOne Workbench on KVM.
- Keep app and API on one origin.
- Preserve authenticated app behavior.
- Wire read-only Tissuu Customer Engine bridge.
- Keep deployment script narrow and safe.

Remaining:

- Push or otherwise reconcile local commits with remote release process.
- Continue live visual verification inside authenticated app.

### M1: Native Alpha Experience

Goal: make the current live signals feel native to SimOne.

- Reviewable artifact: `doc/product/simone-alpha-flow-blueprint.html`.

- Improve Dashboard and Customer Engine surfaces around the Tissuu bridge.
  The Customer Engine page now includes a deliberate SIM Wiki promotion action
  for proof readouts while keeping Tissuu write-back deferred.
- Make public scanner and share artifacts feel like coherent SimOne outputs.
  The Venture Architecture Map share page now has a first plain-language
  interpretation layer, and the scanner now exposes a safe share summary plus a
  scanner-to-SIM-Starter handoff after sign-in.
- Make SIM Coach contextual explanations feel helpful, not academic. Scanner
  handoff now includes a "Method underneath" card instead of a generic course
  prompt, and the Coach page now shows the first SIM Wiki seed map.
- Add a first useful PRD/glossary/docs bundle for human and future wiki use.
- Map the first alpha product flow from landing through next action. The first
  reviewable HTML blueprint now covers landing, sign-in, venture intake, guided
  draft, SIM map, Sprint Zero, diagnosis, settings placement, and incomplete
  data behavior.

Related Linear:

- SYS-181
- SYS-198
- SYS-199
- SYS-200
- SYS-201

### M2: SIM Starter And SIM Wiki

Goal: let a founder arrive with messy input and leave with a protected,
inspectable first map.

- Draft first SIM map from messy founder input.
- Replace manual engine/driver setup as the first action.
- Install or wrap the LLM Wiki plugin as SIM Wiki.
- Seed SIM Wiki structure and glossary. The plugin template already carries SIM
  pages plus SimOne product-language, PRD snapshot, glossary, and agent-flow
  pages; the Coach page explains the first seed buckets to the user.
- Promote useful coach answers and Customer Engine proof readouts into durable
  wiki pages. First scanner synthesis and Customer Engine readout promotion
  paths exist; broader answer/review promotion remains.

### M3: Sovereign Model Routing

Goal: build an auditable routing spine before experimenting with black-box
delegation.

- Define routing lanes: cheap/background, workhorse, frontier, external
  specialist, deliberation/audit.
- Add route decision records. Initial `model_route_decisions` API exists.
- Log model/provider/adapter/cost/context summaries.
- Add human approval gates for risky boundaries.
- Add evaluation cases for routing quality.
- Keep provider/model settings out of first-run onboarding.

### M4: Compression And Context Infrastructure

Goal: preserve useful context without bloating model calls.

- Evaluate Headroom locally against SimOne payloads.
- Start with JSON bridge payloads, wiki retrieval chunks, run transcripts, and
  scanner context.
- Store compression metadata and original retrieval references. The first local
  implementation stores audited JSON compression metadata on model route
  decisions.
- Confirm that compressed context does not degrade answer quality.

### M5: Experiment Lane

Goal: test black-box or ensemble routers safely after sovereign routing exists.

- Add Fugu/Fugu Ultra as optional specialist adapter.
- Add OpenRouter Fusion as optional high-risk deliberation/audit lane.
- Compare against explicit frontier routes.
- Use evaluation harnesses before production workflows rely on it.
- Keep Fusion/Fugu output behind SimOne quality checks and human approval
  gates.

### M6: Productization

Goal: move from alpha workbench to reliable product.

- Polish onboarding and recurring workflows.
- Improve workspace navigation for Thomasina.
- Harden billing/cost visibility.
- Harden tenant isolation and secret handling.
- Add support/documentation flow.
- Create a release/deploy checklist.

## 10. Success Criteria

SimOne alpha succeeds when a nontechnical founder can:

1. Sign in.
2. Describe a venture messily.
3. Receive a useful first map and bottleneck diagnosis.
4. See what needs their judgment.
5. Ask why without being forced into theory.
6. Share a safe artifact.
7. Let agents work in bounded roles.
8. Review model/agent cost and provenance when needed.

SimOne is not done until its routing, memory, bridge, and approval behavior are
auditable enough that Han can trust the system while building it.

## 11. Source Documents

- `ARCHITECTURE.md`
- `doc/product/simone-alpha-flow-blueprint.html`
- `doc/product/simone-milestone-tracker.md`
- `doc/product/simone-glossary.md`
- `doc/product/simone-agent-flows.md`
- `doc/plans/2026-07-07-simone-plg-barnum-layer.md`
- `doc/plans/2026-07-02-simone-memory-coach-layer.md`
- `doc/plans/2026-07-07-tissuu-bridge-response.md`
- `docs/start/architecture.md`
- `docs/companies/companies-spec.md`
- Sakana Fugu docs checked 2026-07-08: `https://sakana.ai/fugu/`,
  `https://console.sakana.ai/models`, `https://console.sakana.ai/pricing`
- OpenRouter Fusion docs checked 2026-07-08:
  `https://openrouter.ai/docs/guides/routing/routers/fusion-router`
- Headroom docs checked 2026-07-08:
  `https://github.com/headroomlabs-ai/headroom`
