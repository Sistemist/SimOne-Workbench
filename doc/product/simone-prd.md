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
| Paperclip control-plane reuse | 60% | Paperclip app deployed as SimOne Workbench; starter direction and UI copy partially adapted; PRD/glossary/field-guide/wiki seeds now translate inherited terms and screens into SimOne language |
| PLG/Barnum layer | 66% | Public scanner, shareable venture maps, methodology loop beginnings; share artifacts now have safer public readouts with proof context, a plain public preview, and a generated review package; scanner results now include lived example notes, signal strength, secondary engine watch, calibration status, diagnosis signals, a direct SIM Coach handoff, and a structured Sprint Zero brief that carries into SIM Starter |
| Customer Engine bridge | 80% | Read-only Tissuu bridge live; Dashboard and Customer Engine frame it as a native Customer Signal loop; Customer Engine page can promote a proof readout into SIM Wiki without mutating Tissuu |
| SIM Coach and SIM Wiki | 63% | Product direction documented; public scanner now offers a contextual Coach handoff before map creation; contextual coach loop explains scanner results; Coach now explains the operating role stack in-app; Coach can queue an auditable SIM Wiki maintainer retrieval from scanner context, stream the returned answer back into Coach, preserve structured wiki/raw answer source refs, and save useful answers as durable SIM Wiki syntheses; SIM Starter now stores source-note and first-map draft provenance in the first Sprint Zero work item and can save the reviewed first map as a durable SIM Wiki page; Coach and Customer Engine can save and reopen promoted syntheses in SIM Wiki; new wiki roots include SimOne product-language, PRD snapshot, glossary, and agent-flow pages |
| Model routing and auditability | 48% | Strategy documented; Workbench has an initial `model_route_decisions` ledger; route decisions can now attach a compressed context envelope, record post-run output confidence/review state, link heartbeat adapter execution to the route ledger before a run spends, link spend rows back to the route that caused them, link out to recorded runs and output artifacts when present, explain Fusion/Fugu-style lane evidence requirements, add initial route-boundary eval cases, and be filtered/reviewed from an advanced settings audit surface; broader provider orchestration remains |
| Compression/headroom | 8% | External Headroom/SmartCrusher not integrated; SimOne now has a local audited JSON compression envelope for route-decision context payloads |
| Full SIM operating system | 35% | Engines and governance are defined, SIM Starter now has a protected first-map review path, can seed bounded child tasks, can create a reviewed map artifact record, and can save the reviewed map into SIM Wiki, but durable operating loops, routing, evaluations, and production polish remain |

Overall: SimOne is roughly 45-55% complete as a coherent alpha product shell and
about 35% complete as the full SIM operating system.

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

The companion field guide `doc/product/simone-workbench-field-guide.md` explains
how to read inherited Dashboard, Tasks, Projects, Agents, Teams, Skills,
Adapters, Runs, Costs, Approvals, Recovery, Documents, Artifacts, Routines,
Settings, and Secrets surfaces in SimOne language.

The companion evidence map `doc/product/simone-evidence-map.md` links major PRD
claims to their current docs, code, tests, deploy proof, Linear issues, and
remaining proof gaps.

SimOne adds:

- SimOne branding and product direction
- authenticated KVM deployment
- SIM Starter direction
- PLG surfaces
- Tissuu Customer Engine bridge
- SIM Coach methodology loop beginnings

### Paperclip Concepts Translated For SimOne

Paperclip is the control plane. SimOne is the product experience on top of that
control plane. When an inherited Paperclip term appears in the Workbench, read
it through this SimOne translation:

| Paperclip term | What it means in SimOne | Thomasina-facing meaning |
| --- | --- | --- |
| Company | Tenant/workspace boundary | The protected place where my venture lives |
| Project | A scoped body of work | A workstream, sprint, or operating area |
| Task / issue | Assignable unit of work with review state | A protected work item that can be drafted, reviewed, approved, or delegated |
| Agent | Bounded actor with instructions and tools | A role that can help, not an autonomous executive |
| Team | Reusable group of agents/roles | A small operating team for a workflow |
| Skill | Reusable instruction/tool package | A capability the system can use when asked |
| Adapter | Runtime bridge to an agent/model/tool | The execution pipe, hidden from first-run users |
| Run | One execution attempt | The audit trail of what the helper did |
| Cost/usage record | Spend and token/accounting event | The receipt for delegated work |
| Recovery state | Blocked/failed/stalled execution state | A visible place where the system asks for help instead of hiding failure |

The product goal is not to erase Paperclip's terms everywhere immediately. The
goal is to make first-run SimOne screens speak in ventures, maps, decisions,
proof, review, and next moves, while keeping Paperclip's stronger work ledger
available underneath.

### Surface Ownership Map

The main SimOne surfaces should have clean jobs:

| Surface | Owns | Does not own |
| --- | --- | --- |
| SIM Starter | First protected map, source note, Sprint Zero task, provenance | Ongoing chat, hidden model setup, unapproved execution |
| Venture Architecture Map | Operating picture of engines, roles, assumptions, risks, and decisions | Live customer queues or private raw notes in public views |
| Systems Bottleneck Scanner | One bounded diagnosis, one next move, safe public handoff | Full company crawl or uncontrolled agent research |
| Customer Engine Readout | Read-only live Tissuu signal and deliberate proof promotion | Mutating Tissuu or inventing bridge health |
| SIM Coach | Contextual explanation, review, and "what does this mean?" support | Becoming the root execution engine |
| SIM Wiki | Durable memory, source material, concepts, synthesis, provenance | Silently absorbing every ephemeral live signal |
| Paperclip control plane | Tasks, agents, runs, approvals, costs, recovery | First-screen product language for nontechnical users |

### Operating Role Stack

SimOne can use familiar role names such as CEO, Product Lead, Customer Lead,
Cash Lead, and Skills Lead, but those names should never imply unmanaged
autonomy. The role stack is:

| Layer | Plain meaning | Examples | Boundary |
| --- | --- | --- | --- |
| Human owner | Final judgment and values | Han now; Thomasina/account owner later | Cannot be replaced by a model or router |
| Boardroom brain | High-level reviewer or strategic synthesizer | Fable 5 for planning, SIM Coach deep review, architecture/audit | Advises and reviews; does not own the company |
| Engine steward | Keeps one SIM engine legible and connected to work | Product, Customer, Cash, Skills leads | Converts signals into bounded work; does not bypass cross-engine approval |
| Specialist adapter | Bounded execution helper for hard work | Fugu/Fugu Ultra later, Codex/Claude/process adapters today | Returns candidate output with evidence, cost, fallback, and review state |
| Task agent | Performs one protected work item | Paperclip agent running a task | Must leave a task/run receipt and obey approvals |

This is the compromise behind the Fable/Fugu discussion: Fable 5 can be a
boardroom brain or reviewer when access and cost policy allow it; Fugu/Fugu
Ultra can later be an external specialist lane for bounded hard execution; the
human still keeps meta-stewardship; and Paperclip remains the work ledger.

### State Ownership Contract

When SimOne feels confusing, ask which layer owns the state. A surface can
display another layer's state, but it should not silently become the owner of
that state.

| User question | SimOne surface | Durable owner | Paperclip backing | Promotion rule |
| --- | --- | --- | --- | --- |
| "What is my venture, and where is it blocked?" | SIM Starter, Venture Architecture Map, Scanner | Venture map and Sprint Zero brief | Company, project, first task, documents/artifacts | Save map/brief only after the user accepts the protected workspace context |
| "Why does this matter?" | SIM Coach | Usually ephemeral explanation | Optional maintainer task/run when retrieval is needed | Promote only useful answers into SIM Wiki |
| "What do we know for later?" | SIM Wiki | Wiki page, synthesis page, source refs, provenance | Documents, wiki plugin files, maintainer task/run | Human chooses to save or promote |
| "What customer signal needs me?" | Customer Engine Readout | Tissuu for live signal; SIM Wiki for durable proof | Bridge readout, optional synthesis page | Live queues stay in Tissuu; only decisions/proof are promoted |
| "Who is doing the work?" | Paperclip control plane through SimOne language | Tasks, agents, runs, approvals, costs, recovery | Issues, agents, heartbeat runs, cost events, approvals | Delegation starts only after the approval boundary is clear |
| "Which model or router handled this?" | Advanced model routing audit | Route decision, run, cost event, review state | `model_route_decisions`, heartbeat runs, cost events | First-run users do not choose this; operators can audit it |

This contract is why SIM Coach is not the memory layer, SIM Wiki is not a live
automation loop, Tissuu is not being migrated, and Paperclip remains the
inspectable work ledger underneath SimOne.

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
task page. The same work item stores where the founder note came from, when it
was captured, whether it came from a public scanner handoff, and the initial
first-map draft status so the first map has provenance before stronger agents
or model routes act on it. When the user arrives from the public scanner, the
starter task also carries the scanner's Sprint Zero brief: what is clear, what
needs proof, the human review boundary, and the first move. The first-map guide
now includes a review checklist so the user can distinguish what is clear
enough to act on, what still needs proof, what requires human judgment, and what
the first move should be before delegation. After review, the task offers clear
promotion exits for saving trusted decisions to SIM Wiki, creating bounded next
tasks, or turning the reviewed map into a shareable artifact. The bounded-task
path now writes three child tasks directly under the first-map task: proof-gap
validation, human-judgment boundary confirmation, and a shareable Venture
Architecture Map draft. Each child task keeps the Sprint Zero source and
approval boundary visible. The shareable artifact path now writes a reviewed
Venture Architecture Map work product on the task so it appears in the
Artifacts surface with source and approval metadata. When SIM Wiki is ready,
the same guide can save the reviewed first map as a durable wiki synthesis with
source-task provenance and the approval boundary preserved.

### Tissuu Bridge

Bridge v1 is live and read-only. SimOne reads:

- `/digest`
- `/actions`
- `/metrics`
- `/ops`

SimOne must not invent bridge status. If the bridge is unavailable, the UI shows
an unavailable state. All action still happens in Tissuu through deep links.
The Dashboard and Customer Engine page frame the bridge as a SimOne Customer
Signal loop: live customer signal, next human judgment, and company memory.
Tissuu remains visible as the live source and review destination rather than
the product headline.
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
  brief for what is clear, what needs proof, and what requires human review,
  adds a public preview with an opening line, first thing to notice, and
  suggested follow-up ask, adds a generated review package for why the map is
  shareable, what is still unproven, and what to ask before acting, adds proof
  context for evidence strength, what was withheld, and the next question to
  ask, and omits adapter/runtime/model setup details.
- The public Systems Bottleneck Scanner produces a safe share summary containing
  the likely bottleneck, engine focus, next move, and public-safe diagnosis
  signals explaining why that engine was selected while excluding the raw
  founder note and startup URL. The scanner now offers lived example notes for
  customer follow-up, cash runway, skills capacity, and product proof so a
  curious user can try the tool without inventing a perfect prompt. The result
  now shows signal strength and, when a messy note points to more than one
  engine, a secondary engine to watch next. It also labels the result as an
  early pattern match, states that real submission review is still needed, and
  records that raw notes and URLs are excluded from public summaries. After a
  scan, it offers a direct "Ask SIM Coach why" handoff through sign-in so the
  saved scan context can become a method explanation before work is assigned.
  It also tells the user the scan will carry into SIM Starter after sign-in and
  routes them to onboarding with the saved scan context in protected browser
  storage. The scan now also generates a structured Sprint Zero Brief with what
  is clear, what needs proof, human review boundaries, and the first move, then
  passes that brief into the protected starter map task.

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
- Receives the public scanner's "Ask SIM Coach why" handoff through sign-in so
  the method explanation starts from the user's actual scan result.
- Explains the bottleneck in plain language.
- Names the method underneath the moment, such as a customer review loop,
  money decision loop, ownership loop, or product proof loop.
- Points to SIM Wiki/course methodology only after the user has context for why
  the explanation matters.
- Shows a SIM Wiki Seed Map naming the first durable memory buckets: method
  pages, venture memory, and explicit promotion rules.
- Shows a plain "Who does what" orientation strip so the user can distinguish
  SIM Coach, SIM Wiki, and the control plane before delegating work.
- Shows the operating role stack in-app so the user can distinguish human owner,
  boardroom brain, engine stewards, specialist adapters, and task agents before
  assigning work.
- When SIM Wiki is enabled, can promote a saved scanner/coach synthesis into a
  dated page under `wiki/synthesis/` through the existing SIM Wiki plugin
  `write-page` action.
- When SIM Wiki retrieval is queued from Coach, streams the returned SIM Wiki
  answer back into the Coach surface while keeping the maintainer task
  inspectable.
- Uses structured wiki/raw answer source refs from SIM Wiki query completion
  events, with answer-text path extraction as a fallback, so the answer is
  easier to inspect.
- Lets the user save a returned SIM Wiki answer as a dated synthesis page with
  scanner context, answer source refs, the maintainer task reference, and
  source refs.
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
  `wiki/concepts/simone-workbench-field-guide.md`,
  `wiki/concepts/simone-evidence-map.md`,
  `wiki/concepts/simone-prd.md`, `wiki/concepts/simone-glossary.md`,
  `wiki/concepts/simone-agent-flows.md`, and
  `wiki/concepts/simone-model-routing.md` so product direction, milestone
  state, inherited Workbench screen translations, traceability evidence,
  Thomasina-facing vocabulary, hidden provider choices, Fusion/Fugu experiment
  boundaries, Headroom status, and human-in-the-loop agent flow have durable
  first definitions.
- Accepts the first Coach-driven promotion path: scanner syntheses can become
  durable pages while live bridge counts remain ephemeral.
- Lets SIM Coach queue a SIM Wiki Maintainer query from saved scanner context
  before stronger advice or agent assignment, with the generated maintainer task
  visible for inspection and the returned answer streamed back into Coach.
- Accepts returned Coach retrieval answers as deliberate synthesis pages when
  the human chooses to preserve them, including structured wiki/raw source refs
  returned by the answer stream.
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

Route decisions can now be updated after execution with an output summary,
output confidence, review status, and review note. This gives future Fable,
Fusion, and Fugu experiments a place to record whether a result was accepted,
rejected, or sent back for revision instead of only logging the intended route.

Cost events can now carry `modelRouteDecisionId`, with company and agent
ownership checks before the row is accepted. This gives the audit spine its
first route-to-cost link without making a black-box router the root of trust.

Heartbeat adapter execution now creates a route decision before the adapter is
called, records the post-run output confidence/review state, and passes that
route decision id into automatic cost events when usage or spend is reported.
This is the first real route-to-run-to-cost execution hook, not yet a full
provider router.

Operators can now inspect recent route decisions in `Company Settings >
Instance settings > Model routing`. This first review surface shows the chosen
lane, provider/model, risk level, approval boundary, context summary, output
summary, review state, linked cost count/cents, review-status filters,
run-detail links when the decision has a recorded `heartbeatRunId`, and output
artifact links when review metadata points to generated Artifacts work products.
The surface also lets an operator mark the result approved, rejected, or in need
of revision with a review note. It is intentionally an advanced audit surface,
not first-run onboarding.

Route decisions can also accept an optional bulky JSON `contextPayload`. SimOne
compresses that payload into `metadata.contextCompression` using the local
`simone_json_headroom_v0` strategy, recording source kind, input/output byte
counts, input/output hashes, redacted keys, omitted array items, and the
compressed JSON string. This keeps the audit spine explicit before model calls
consume large bridge/tool/RAG payloads.

The companion strategy note `doc/product/simone-model-routing.md` is the
reader-friendly source for the Fable 5, Fusion, Fugu/Fugu Ultra, Headroom, and
lane-boundary discussion.

### Fable 5

Fable 5 is a candidate "boardroom brain" or meta-controller for high-level SIM
Coach, strategy, architecture review, and audits when an API key is available
and current model access is verified. It should not run routine background agent
ticks. A boardroom brain is not the company owner; it is a high-context advisor
whose recommendations still pass through route logging, evidence, and human
review.

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
SimOne's own controller/evaluation layer. Specialist adapters are execution
helpers, not supervisors.

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
  The Dashboard card and Customer Engine page now use a native Customer Signal
  framing and the Customer Engine page includes a deliberate SIM Wiki promotion
  action for proof readouts while keeping Tissuu write-back deferred.
- Make public scanner and share artifacts feel like coherent SimOne outputs.
  The Venture Architecture Map share page now has a plain-language
  interpretation layer, a public preview, a public Sprint Zero brief, and
  a generated review package plus proof-context guidance for evidence strength,
  privacy boundaries, and the next assumption to test.
  The scanner now exposes lived example notes, signal strength, secondary
  engine watch, safe diagnosis signals, a safe share summary, and a
  scanner-to-SIM-Coach and scanner-to-SIM-Starter handoff after sign-in. The
  scanner also produces the first structured Sprint Zero Brief and carries it
  into the protected Starter task.
- Make SIM Coach contextual explanations feel helpful, not academic. Scanner
  results now offer an "Ask SIM Coach why" path before map creation; the Coach
  handoff includes a "Method underneath" card instead of a generic course
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
- Give the first-map task a review workflow before delegation.
- Give the reviewed first map clear promotion exits into SIM Wiki, bounded next
  tasks, and shareable artifacts.
- Seed bounded child tasks directly from the reviewed first map.
- Create a reviewed Venture Architecture Map artifact record from the first map.
- Save the reviewed first map into SIM Wiki with source and approval metadata.
- Install or wrap the LLM Wiki plugin as SIM Wiki.
- Seed SIM Wiki structure and glossary. The plugin template already carries SIM
  pages plus SimOne product-language, PRD snapshot, glossary, and agent-flow
  pages; the Coach page explains the first seed buckets to the user.
- Promote useful coach answers and Customer Engine proof readouts into durable
  wiki pages. First scanner synthesis, streamed Coach retrieval answer, and
  Customer Engine readout promotion paths exist; broader review promotion
  remains.

### M3: Sovereign Model Routing

Goal: build an auditable routing spine before experimenting with black-box
delegation.

- Define routing lanes: cheap/background, workhorse, frontier, external
  specialist, deliberation/audit.
- Add route decision records. Initial `model_route_decisions` API exists.
- Log model/provider/adapter/context summaries, output confidence, and review
  state.
- Link cost events to the route decision that caused the spend.
- Add an initial routing audit page in instance settings with review actions.
- Show special evidence requirements when a decision uses the deliberation/audit
  or external-specialist lane.
- Add human approval gates for risky boundaries.
- Add evaluation cases for routing quality. Initial promptfoo route-boundary
  cases now cover Fusion-style deliberation, Fugu/Fugu Ultra-style bounded
  specialist execution, and rejection of hidden root routing.
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
- `doc/product/simone-docs-index.md`
- `doc/product/simone-milestone-tracker.md`
- `doc/product/simone-workbench-field-guide.md`
- `doc/product/simone-evidence-map.md`
- `doc/product/simone-glossary.md`
- `doc/product/simone-agent-flows.md`
- `doc/product/simone-model-routing.md`
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
