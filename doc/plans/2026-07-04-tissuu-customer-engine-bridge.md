# Tissuu Customer Engine Bridge

Status: Proposed for course alpha
Date: 2026-07-04
Related:
- `doc/plans/2026-07-02-simone-memory-coach-layer.md`
- SimOne Starter team catalog package
- Tissuu v3 operating brief and launch coordinator docs

## Decision

For the course alpha, SimOne should integrate Tissuu by reference instead of
migrating Tissuu's working execution pipeline into the Paperclip runtime.

Tissuu remains the live Customer Engine. SimOne consumes a small read-only signal
feed from Tissuu and presents it inside the company control plane as operating
judgment, priorities, and human review prompts.

Do not rebuild Tissuu's X API jobs, scoring, draft generation, approval queues,
Dify retrieval, waitlist mirror, or channel crons inside SimOne before the course
launch. Revisit migration only after the live launch cycle is no longer the
primary constraint.

## Why

Tissuu already has tuned production workflows for the course launch:

- voice and thread watching
- problem-grounded post drafts
- HN and Indie Hackers discovery
- Gemini grounding and Dify knowledge retrieval
- human approval rails
- waitlist and proof tracking
- launch coordinator guidance
- operating digests

Recreating those workflows in SimOne would spend launch time on migration risk
instead of customer signal, course enrollment, and product proof.

Paperclip's product shape already supports the better boundary: the control plane
coordinates external agents and services through adapters, webhooks, HTTP
surfaces, and plugins. Tissuu should therefore appear as a live Customer Engine
service, not as code that SimOne must swallow immediately.

## Product Shape

### SimOne Responsibility

SimOne is the judgment surface and operating layer:

- show the Customer Engine's current state in the company dashboard
- route human review items into a daily priority list
- connect customer signal to Product, Cash, Skills, and CEO decisions
- preserve decisions and durable learnings in SIM Wiki
- keep Paperclip's existing tasks, agents, approvals, costs, and activity
  surfaces intact

### Tissuu Responsibility

Tissuu remains the execution system for customer-discovery work:

- run scheduled channel and voice-watch jobs
- draft social replies, posts, and nurture material
- maintain its own approval and publishing surfaces
- track prospects, waitlist, proof, and operations
- expose compact read-only summaries to SimOne

### Human Responsibility

Han remains the judgment bottleneck on purpose:

- approve public language
- decide which relationships matter
- choose offer and positioning changes
- decide when customer signal changes the company map

The bridge should reduce Han's review burden. It must not create more parallel
queues.

## Bridge Contract

The first bridge should be read-only from SimOne to Tissuu.

Recommended endpoints or equivalent payloads:

| Surface | Purpose | Example fields |
| --- | --- | --- |
| `GET /api/simone/customer-engine/digest` | Daily executive readout | `date`, `headline`, `summary`, `wins`, `risks`, `nextActions`, `sourceLinks` |
| `GET /api/simone/customer-engine/actions` | Human review queue | `id`, `kind`, `title`, `priority`, `reason`, `deepLink`, `dueAt`, `source` |
| `GET /api/simone/customer-engine/metrics` | Funnel and quality signals | `waitlistTotal`, `weeklyNew`, `qualifiedLeads`, `sourceMix`, `replyRate`, `proofEvents` |
| `GET /api/simone/customer-engine/ops` | Agent and job health | `jobs`, `lastRunAt`, `status`, `failures`, `staleSignals`, `costNotes` |

All payloads should be bounded, human-readable, and safe to show in a board UI.
Prefer summaries plus deep links over raw prospect dumps or large transcript
payloads.

## Data Rules

- SimOne stores only derived summaries, decisions, and links unless a specific
  workflow needs a durable copy.
- Tissuu remains source of truth for prospect records, drafts, and channel job
  details.
- Deep links should take the operator back to Tissuu for approval or publishing.
- No public posting, following, emailing, or prospect mutation should originate
  from SimOne in the first version.
- If bridge data is unavailable, SimOne should show a clear stale/unavailable
  state rather than silently inventing Customer Engine status.

## UI Implications

Do not replace Paperclip's dashboard. Add a Customer Engine card or section that
answers:

- What customer signal changed?
- What needs Han's judgment?
- Which Product, Cash, or Skills assumptions are affected?
- Which Tissuu surface should Han open next?

The first usable version can be a compact dashboard panel plus a fuller Customer
Engine detail page. The panel should fit Paperclip's existing dashboard structure
instead of becoming a separate marketing-command-center UI.

## Future Writes

Only after the read-only bridge proves useful should SimOne write back into
Tissuu. Candidate write operations:

- mark a digest item acknowledged
- create a Tissuu follow-up task from a SimOne decision
- attach a SimOne decision note to a Tissuu prospect or draft
- request a bounded one-off Tissuu run

Each write should have a visible human action, audit trail, and failure state.

## Non-Goals

- Do not migrate Tissuu's implementation into SimOne during the course alpha.
- Do not add a large new agent roster to compensate for unclear priorities.
- Do not make SimOne the publishing surface for X, email, or community channels
  yet.
- Do not turn the dashboard into a complete replacement for Tissuu's operational
  screens.

## Open Questions

- Which Tissuu endpoints are cheapest for Claude to expose from the current app?
- Should SimOne poll Tissuu live, cache the latest digest, or both?
- What auth token or shared secret should protect the bridge between the two
  self-hosted services?
- Which Customer Engine signals belong in SIM Wiki as durable memory rather than
  only dashboard state?
