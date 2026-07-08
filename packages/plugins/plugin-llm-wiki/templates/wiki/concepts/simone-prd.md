---
title: SimOne PRD Snapshot
type: concept
tags: [simone, product, prd, alpha]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne PRD Snapshot

This page keeps the product state close to SIM Wiki so the Coach and future
maintainer agent can answer from inspectable memory, not only from repository
documents.

## Overall SimOne alpha state

SimOne is roughly halfway to a coherent alpha product shell and about one-third
of the way to the full SIM operating system. This is a product estimate, not an
engineering certification.

Current strongest pieces:

- hosted authenticated Workbench shell
- Paperclip control-plane reuse
- read-only Tissuu Customer Engine bridge
- public scanner with lived examples, signal strength, scanner-to-Coach, and shareable artifact beginnings
- first SIM Coach and SIM Wiki promotion paths
- first auditable model-route ledger and local JSON compression envelope
- plain Workbench field guide for inherited Paperclip surfaces
- evidence map connecting claims to docs, code, tests, deploy proof, and Linear
- dedicated model-routing strategy page for Fable, Fusion, Fugu, and Headroom

Current weakest pieces:

- messy-input SIM Starter
- real provider orchestration and evaluations
- complete SIM Wiki promotion loops
- durable cost and routing review surfaces
- product polish for nontechnical recurring use

## Paperclip concepts translated for SimOne

Paperclip concepts translated for SimOne:

- Company: the protected workspace where a venture lives.
- Project: a workstream, sprint, or operating area.
- Issue/task: a protected work item that can be drafted, reviewed, approved, or delegated.
- Agent: a bounded helper role with instructions and tools.
- Skill: a reusable capability the system can use when asked.
- Adapter: the hidden execution pipe to a model, tool, or agent runtime.
- Run: the audit trail and receipt for one helper execution.
- Recovery state: the visible place where stuck work asks for help instead of hiding failure.

SimOne should keep Paperclip's ledger, assignment, run, cost, and recovery
machinery while translating first-run screens into maps, proof, decisions,
review, and next moves.

The Workbench field guide is the best page for translating inherited Dashboard,
Tasks, Projects, Agents, Teams, Skills, Adapters, Runs, Costs, Approvals,
Recovery, Documents, Artifacts, Routines, Settings, and Secrets surfaces into
SimOne language.

## Milestone Shape

**M0 Foundation and Bridge** is mostly complete: SimOne is deployed, authenticated,
and connected to Tissuu through a read-only bridge.

**M1 Native Alpha Experience** is in progress: live Customer Engine signal,
public scanner results with lived examples and signal strength,
scanner-to-Coach handoff, share artifacts, and Coach explanations should feel
like native SimOne surfaces.

**M2 SIM Starter and SIM Wiki** is next: a user should bring messy input, get a
first protected map, and save useful answers into inspectable memory.

**M3 Sovereign Model Routing** builds the explicit routing spine before relying
on black-box orchestration.

**M4 Compression and Context Infrastructure** evaluates Headroom-style context
compression against SimOne payloads. External Headroom is not wired yet; the
current implementation is a local audited JSON envelope.

**M5 Experiment Lane** tests optional specialist routers after the sovereign
route ledger exists.

## Routing Notes

The dedicated model-routing page is the best place to answer "which model or
router should do what?" without exposing provider setup to first-run users.

Fable 5 is a candidate boardroom brain for high-level strategy, SIM Coach,
architecture review, and audits when API access is available.

OpenRouter Fusion is reserved for high-risk deliberation where disagreement,
blind spots, and second opinions are more valuable than speed.

Fugu/Fugu Ultra is best treated as a specialist execution adapter first, not as
the root SimOne controller.

## Product Rule

If a feature makes the user choose providers, routers, or adapter details before
they have received a useful output, it is probably in the wrong layer.
