# SimOne Architecture

Last updated: 2026-07-08

## North Star

SimOne is the hosted product shell and operating layer for the Systems
Intelligence Model (SIM).

The product should help a nontechnical founder or operator avoid the default
agentic failure mode: "Here is an agentic setup, good luck." SimOne should
protect the user from unmanaged agent sprawl by giving them:

- a sign-in-first workspace
- a guided setup that can draft the first company map from messy input
- familiar roles and teams in the UI
- SIM engines, drivers, and governance underneath
- human judgment and approval gates
- a SIM Coach that explains methodology only when it is useful

Paperclip remains the closest reference/base system. SimOne should keep
Paperclip's strong control-plane patterns where possible, then add the SIM
product shell, templates, coaching, and growth loops on top.

## Product Positioning

SimOne is being productized. The caution is not "do not productize SimOne"; the
caution is "do not productize the wrong thing too early."

Current product boundary:

- SimOne: the multi-tenant product vehicle.
- Tissuu: Han's stable, single-tenant Customer Engine for now.
- Tissuu-to-SimOne bridge: read-only v1 integration by reference.
- Paperclip: upstream base and execution/control-plane reference.
- Dify: existing knowledge/RAG service used by Tissuu and possibly SimOne later.
- Hermes and other local/gateway agents: optional execution layer, not the first
  user-facing concept.

Do not migrate Tissuu into SimOne yet. Do not rebuild Tissuu pipelines inside
Paperclip unless the bridge proves insufficient.

## PLG And Barnum Layer

The current growth direction is product-led growth with a Barnum-style
translation layer: make deep SIM ideas feel simple, useful, memorable, and
shareable before asking users to care about the theory.

Borrowed framing:

- The book and course are the fundamental treatment.
- SimOne and Tissuu provide immediate pain relief.
- The product should introduce SIM vocabulary through useful outputs, not
  lectures.

Near-term PLG features:

- shareable Venture Architecture Map
- Systems Bottleneck Scanner
- Sprint Zero Brief
- Customer Engine Readout
- contextual "Ask SIM Coach" / "Learn why" moments

Avoid generic in-app course ads. Use methodology links when users are already
asking why something works or why a boundary matters.

Relevant Linear issues:

- SYS-198: Customer Engine live Tissuu bridge wiring
- SYS-199: Shareable SimOne venture artifacts
- SYS-200: Public Systems Bottleneck Scanner
- SYS-201: Contextual methodology loop from SIM Coach to book/course
- SYS-202: Auditable SimOne model routing and escalation lanes

Current product source docs:

- `doc/product/simone-prd.md`
- `doc/product/simone-docs-index.md`
- `doc/product/simone-alpha-flow-blueprint.html`
- `doc/product/simone-milestone-tracker.md`
- `doc/product/simone-workbench-field-guide.md`
- `doc/product/simone-evidence-map.md`
- `doc/product/simone-glossary.md`
- `doc/product/simone-agent-flows.md`
- `doc/product/simone-model-routing.md`

## Main Runtime

Production app:

- URL: https://sim.sysdom.org/app
- Host: Hostinger KVM2
- Public host: sim.sysdom.org
- Service: Docker Compose `paperclip` service
- Deployment script: `scripts/deploy-simone-kvm.sh`
- Remote root: `/root/simone-workbench`
- Compose env file on KVM: `/root/simone-workbench/docker/.env.simone-public`

The deploy script is intentionally narrow:

- rsyncs the workbench repo to the KVM
- rebuilds only the `paperclip` Docker service
- recreates only the `paperclip` service
- checks app health
- checks `/app` and landing page titles
- checks signup validation
- checks Dify availability without changing Dify

Do not touch Dify, Tissuu, or other KVM services unless the task explicitly
requires it.

## DNS And Routing

The desired public routing is:

- `https://sim.sysdom.org/`: SimOne landing page
- `https://sim.sysdom.org/app`: SimOne app

The app and landing page now live behind the KVM deployment. Earlier confusion
around Vercel/Wix/DNS was resolved in favor of serving the SimOne experience
from the KVM so app routes and API routes can share one origin.

## Auth And Workspace

SimOne currently runs in authenticated deployment mode.

Expected unauthenticated behavior:

- `/app` redirects to `/auth?next=%2Fapp`
- `/api/auth/get-session` may return 401 for anonymous users

The production health endpoint currently reports:

```json
{
  "status": "ok",
  "deploymentMode": "authenticated",
  "deploymentExposure": "private",
  "bootstrapStatus": "ready",
  "bootstrapInviteActive": false
}
```

## Tissuu Customer Engine Bridge

Bridge v1 is live and confirmed end to end.

Base URL:

```text
https://app.tissuu.ai/api/simone/customer-engine
```

Endpoints:

- `/digest`
- `/actions`
- `/metrics`
- `/ops`

Auth:

- `Authorization: Bearer <SIMONE_BRIDGE_TOKEN>`
- The token is stored on the KVM env file only.
- Do not commit, print, or document the token value.

SimOne server route:

```text
GET /api/companies/:companyId/customer-engine/bridge
```

Implementation:

- `server/src/services/customer-engine-bridge.ts`
- `server/src/routes/customer-engine-bridge.ts`
- `ui/src/api/customerEngine.ts`
- `ui/src/components/CustomerEngineBridgeCard.tsx`
- `ui/src/pages/Dashboard.tsx`
- `ui/src/pages/CustomerEngine.tsx`

Behavior:

- If the token is configured and accepted, SimOne renders live Tissuu data.
- If the token is missing or invalid, SimOne renders a clear unavailable state.
- SimOne must not invent Customer Engine status.
- v1 is strictly read-only.
- Approval and action still happen in Tissuu via deep links.

Confirmed live on 2026-07-07 from inside the SimOne container:

```json
{
  "status": "live",
  "headline": "35 items waiting on you (10 high-priority)",
  "actions": 35,
  "waitlistTotal": 11,
  "ops": "healthy"
}
```

Claude independently confirmed that Tissuu was serving the same numbers.

Bridge v2 is deferred. Possible v2 actions:

- acknowledge an item
- create a follow-up task
- write a decision note
- mark something reviewed

Do not build v2 until Han has lived with the read-only bridge and wants action
from inside SimOne.

## SIM Starter And Onboarding Direction

The old alpha flow was too manual and form-like. The desired flow is:

1. sign in
2. protect the user's work
3. let agents draft the first SIM map from messy input
4. run research/analysis from the SIM/book playbook
5. ask the human for judgment and approval

Do not ask founders/students to hand-fill engines and drivers at the start.

UI may use familiar titles like CEO, CTO, CMO, and Customer Lead, but internally
these should map to SIM engines, drivers, and controller boundaries.

Current small UI nudge:

- Empty operating-team dashboard state points users to SIM Starter instead of
  manual agent setup.

## Model Strategy

Default posture:

- Hide model/provider complexity from nontechnical users.
- Offer sensible defaults by role/workflow.
- Expose advanced model settings later for expert users.

Use models by task:

- cheap/background models for routine agent ticks
- stronger workhorse models for drafting and synthesis
- frontier models only for high-stakes strategy, architecture, code review, and
  SIM methodology audits

Routing audit spine:

- `model_route_decisions` records the intended lane, provider/model, reason,
  risk level, context summary, approval gate, and metadata before execution.
- Route decisions can be updated after execution with output summary, output
  confidence, review status, and review note so the ledger records whether the
  result was accepted, rejected, or needs revision.
- Use `deliberation_audit` for OpenRouter Fusion-style high-risk review where
  disagreement and blind spots are valuable.
- Use `external_specialist` for future Fugu/Fugu Ultra-style specialist
  execution experiments.
- External Headroom/SmartCrusher integration is not wired yet. SimOne now has a
  local `simone_json_headroom_v0` JSON compression envelope for route-decision
  `contextPayload` input: it records input/output hashes and byte counts,
  source kind, redacted keys, omitted array items, and compressed JSON before a
  future model call consumes bulky bridge/tool/RAG context.

Fable 5 discussion, verified 2026-07-07:

- Anthropic lists Claude Fable 5 as available through the API as
  `claude-fable-5`.
- It is suitable for high-level planning, long-context strategy, and deep
  audits.
- It is expensive enough that SimOne should not use it for default background
  work.
- Treat it as a "boardroom brain" model for SIM Coach, strategy review,
  architecture review, or special audits.

Codex cannot change its own underlying model in this chat, but Codex can call an
external model through an API from the workspace when an API key is available.

## Current Agent Allocation

Han:

- product owner
- final judgment
- course/book/SIM authority
- approves product and positioning choices

Codex:

- primary SimOne/Paperclip engineer
- KVM deploy operator
- product-flow docs and Linear sync
- can call external APIs for audits when keys are provided

Claude:

- primary Tissuu engineer for now
- owns Tissuu production context
- exposed the Tissuu read-only bridge
- should not be moved into SimOne work unless there is a clear handoff need

Tissuu:

- relationship/customer intelligence engine
- keeps running for Han personally
- sends live signal into SimOne by bridge

SimOne:

- product shell
- SIM operating layer
- future hosted SaaS and self-hosted product

## Linear State

Important active/related issues:

- SYS-181: SIM Workbench product-flow blueprint and screen mockups
- SYS-198: Customer Engine live Tissuu bridge wiring
- SYS-199: Shareable SimOne venture artifacts
- SYS-200: Public Systems Bottleneck Scanner
- SYS-201: Contextual methodology loop from SIM Coach to book/course
- SYS-202: Auditable SimOne model routing and escalation lanes

Earlier related issues:

- SYS-184: Paperclip local onboarding and Hermes smoke
- SYS-179/SYS-180/SYS-182/SYS-183: follow-ups from product smoke
- SYS-178: parked SIM-A2A Governance Profile

Keep Linear synced after meaningful code, deploy, or product-direction changes.

## Deployment And Verification Commands

Common checks:

```bash
pnpm --dir server exec vitest run --config ./vitest.config.ts src/__tests__/model-route-decisions-routes.test.ts
pnpm --dir server exec vitest run --config ./vitest.config.ts src/services/customer-engine-bridge.test.ts
pnpm --dir ui exec vitest run --config ./vitest.config.ts src/pages/Dashboard.test.tsx src/pages/CustomerEngine.test.tsx src/components/OnboardingWizard.simone-starter.test.tsx src/components/FrontDoor.test.tsx
pnpm --filter @paperclipai/server typecheck
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/server build
pnpm --filter @paperclipai/ui build
```

Deploy:

```bash
./scripts/deploy-simone-kvm.sh
```

Health:

```bash
curl -fsS https://sim.sysdom.org/api/health
```

Known build warnings:

- CSS `::highlight` warnings in UI build
- large chunk warnings in UI build
- MarkdownEditor dynamic/static import warning

These were already present and are not blockers for the bridge work.

## Recent Commits

- `57ea1ca91`: Wire Tissuu customer engine bridge
- `069ff08c8`: Expose Tissuu bridge env in KVM compose
- `80f300a27`: Make Customer Engine bridge feel native

## Guardrails

- Do not commit secrets.
- Do not print bridge token values in docs or final answers.
- Do not mutate Tissuu from SimOne in bridge v1.
- Do not break Dify; it is used by Tissuu.
- Do not make model/provider setup the default first-run experience.
- Do not rebuild Tissuu inside SimOne until there is evidence the bridge is not
  enough.
- Do not let SIM diagrams and engine drawings become first-use friction.
- Do keep Paperclip conventions where they make upstream updates easier.
