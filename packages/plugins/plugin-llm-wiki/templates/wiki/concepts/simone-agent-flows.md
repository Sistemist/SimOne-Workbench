---
title: SimOne Agent Flows
type: concept
tags: [simone, agents, routing, governance]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Agent Flows

This page describes the intended agent-control posture without exposing model
plumbing to first-run users.

## Default User Flow

1. The user signs in and their work is protected.
2. The user gives messy input about a venture, customer problem, or operating
   bottleneck.
3. SimOne drafts a first map or readout in plain language.
4. SIM Coach explains the method only where it helps the user decide.
5. The user approves what becomes durable, public, financial, customer-facing,
   or delegated.
6. Useful synthesis can be saved into SIM Wiki with provenance.

## Control Layers

**Human meta-stewardship** stays at the top. Han, or the account owner later,
approves public, financial, customer, governance, and cross-engine boundaries.

**Fable 5 can act as a boardroom brain** for high-level planning, SIM Coach,
strategy, architecture review, and audits when the API key and cost policy allow
it. It should not run routine background ticks and it does not replace the human
owner.

**Engine stewards** keep Product, Customer, Cash, and Skills signals legible and
turn them into bounded work. They are useful role labels, not permission to skip
approval boundaries.

**Specialist adapters** such as future Fugu/Fugu Ultra, Codex, Claude, process,
or HTTP execution lanes do bounded hard work and return candidate outputs for
SimOne to evaluate.

**SimOne route ledger** records the route decision before model execution where
possible, then records output confidence and review status after execution.
This is the spine that lets later routers stay accountable.

**Workhorse and background lanes** handle routine drafting, extraction,
summaries, and bounded maintenance.

**Human approval gates** keep irreversible or trust-sensitive actions from
becoming invisible automation.

## Surface ownership

- SIM Starter owns the first protected map, Sprint Zero work item, and source
  provenance.
- Venture Architecture Map owns the operating picture of engines, roles,
  assumptions, risks, and decisions.
- Systems Bottleneck Scanner owns one bounded diagnosis, one next move, and a
  safe handoff into Starter.
- Customer Engine Readout owns read-only Tissuu signal and deliberate proof
  promotion.
- SIM Coach owns contextual explanation and review, not root execution.
- SIM Wiki owns durable memory, source material, synthesis, and provenance.
- Paperclip control plane owns tasks, agents, runs, approvals, costs, and
  recovery underneath the SimOne product language.

## State Promotion

Ephemeral signals can come from scanner results, Coach answers, bridge counts,
or run output. SimOne should decide what happens next:

- keep it lightweight when it only helps the current decision
- promote it to SIM Wiki when it should become durable knowledge or a decision
- turn it into a Paperclip task when work should be delegated
- record it in the route ledger when it is model/routing evidence
- send the user back to Tissuu when it is live Customer Engine action

SIM Coach can help with that choice, but it should not silently become the
durable owner of every answer.

## Experiment Lanes

OpenRouter Fusion should be reserved for critical, high-risk, uncertain tasks
where parallel disagreement, contradiction checks, and blind-spot detection are
worth the added cost and latency.

Fugu/Fugu Ultra should start as optional specialist adapters for hard execution,
multi-step research, or verification tasks. SimOne should judge the returned
work through its own controller, evidence, and approvals rather than treating
black-box orchestration as the root authority.

## Mapping To Engines

- Product Engine: maps offers, positioning, proof, and product decisions.
- Customer Engine: reads customer signal, Tissuu readouts, and market learning.
- Cash Engine: handles price, revenue, runway, and commercial tradeoffs.
- Skills Engine: coordinates technical execution, code, tools, and repeatable
  operating capabilities.

## UI Rule

The user should see roles, decisions, signals, saved knowledge, and next moves.
Provider names, router names, context compression, and adapter wiring belong in
advanced review surfaces unless the user explicitly asks.
