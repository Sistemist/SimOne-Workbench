# SimOne Documentation Index

Status: Living reader map
Date: 2026-07-08
Owner: Han

This page answers: "Where do I start if I want to understand SimOne without
already knowing Paperclip, SIM Coach, SIM Wiki, or the agent-routing plan?"

## Read In This Order

1. `ARCHITECTURE.md`
   - Start here for the north star, product boundary, deployment posture,
     Tissuu bridge rule, model strategy, and current guardrails.
2. `doc/product/simone-prd.md`
   - Use this as the main product source of truth: completion snapshot,
     target user, scope, definitions, surface ownership, milestones, and
     success criteria.
3. `doc/product/simone-milestone-tracker.md`
   - Use this for the short operator view: what is done, what remains, and
     which Linear issues own the work.
4. `doc/product/simone-workbench-field-guide.md`
   - Use this when you want to understand inherited Paperclip screens such as
     Dashboard, Tasks, Agents, Runs, Costs, Approvals, Recovery, Settings, and
     Secrets in SimOne language.
5. `doc/product/simone-evidence-map.md`
   - Use this when you want to know which PRD claims are backed by docs, code,
     tests, deploy smoke, and Linear.
6. `doc/product/simone-glossary.md`
   - Use this when you are confused by a Paperclip term, SIM term, routing
     term, or product-surface name.
7. `doc/product/simone-agent-flows.md`
   - Use this to understand how human judgment, SIM Coach, SIM Wiki,
     Paperclip, Tissuu, and model-routing lanes interact.
8. `doc/product/simone-model-routing.md`
   - Use this to understand Fable 5, Fusion, Fugu/Fugu Ultra, Headroom, lane
     boundaries, and why dev mode is sovereignty-first.
9. `doc/product/simone-alpha-flow-blueprint.html`
   - Use this for the visual alpha flow and screen-behavior sketch.

## What Each Document Answers

| Question | Read |
| --- | --- |
| What is SimOne, and what is not SimOne? | `ARCHITECTURE.md`, PRD section 1 and 5 |
| How complete is the project? | PRD section 2, milestone tracker |
| What did SimOne add on top of Paperclip? | PRD sections 6 and 8, Workbench field guide |
| What are Dashboard, Tasks, Agents, Runs, Costs, Approvals, and Recovery for? | Workbench field guide |
| Which claims are shipped, tested, design-only, or deferred? | Evidence map |
| What do SIM Coach and SIM Wiki mean? | PRD sections 6, glossary Product Surfaces, agent flows section 5 |
| Which surface owns which job? | PRD "Surface Ownership Map", agent flows section 4 |
| Why are we not defaulting to Fugu/Fusion/black-box routing yet? | Model-routing strategy, PRD section 7, milestone tracker product stance, architecture model strategy |
| What is Headroom status? | Model-routing strategy, PRD section 7, milestone tracker M4, architecture model strategy |
| What remains before productization? | PRD milestones, milestone tracker next sequence |

## Vocabulary Rule

When a Paperclip term appears in the UI or docs, translate it before making a
product decision:

- Company -> protected venture workspace.
- Project -> workstream, sprint, or operating area.
- Task / issue -> protected work item.
- Agent -> bounded helper role.
- Skill -> reusable capability.
- Adapter -> hidden execution pipe.
- Run -> audit trail and receipt.
- Recovery state -> visible stuck-work state that asks for help.

## Source-Of-Truth Rule

The PRD is the product source of truth. The architecture file is the operating
source of truth. The milestone tracker is the short status source of truth. The
glossary and agent-flow map are the alignment aids. SIM Wiki seeds should mirror
the same definitions so Coach/Wiki answers do not drift away from the repo.
