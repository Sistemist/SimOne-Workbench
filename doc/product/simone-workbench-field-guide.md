# SimOne Workbench Field Guide

Status: Living operator guide
Date: 2026-07-08
Owner: Han

This guide answers: "When I see inherited Paperclip surfaces inside SimOne,
what are they for, and how should I think about them?"

## 1. One-Sentence Translation

Paperclip is the work ledger and control plane underneath SimOne. SimOne should
make it feel like a guided venture workspace, but these inherited surfaces are
still the places where work, helpers, runs, cost, and stuck states become
inspectable.

## 2. The Daily Map

| Workbench surface | Plain meaning | Use it when | SimOne posture |
| --- | --- | --- | --- |
| Dashboard | Daily triage surface | You want to know what needs attention now | Show signals, next moves, and review needs before setup detail |
| Tasks / Issues | Protected work items | Something should be drafted, reviewed, approved, delegated, blocked, or finished | Tasks are protected work items, not a generic to-do list |
| Projects | Workstreams or sprints | Work belongs to Sprint Zero, Customer Engine, Product, Cash, Skills, or another focused area | Keep project names business-readable |
| Agents | Bounded helper roles | A role can work on a task inside explicit instructions and limits | Agents are bounded helper roles, not autonomous executives |
| Teams | Reusable operating groups | A workflow needs a small set of roles repeatedly | Prefer familiar role names over engine diagrams at first |
| Skills | Reusable capabilities | The system needs a known method, tool, or instruction package | Skills are capabilities; hide the package mechanics until needed |
| Adapters | Execution pipes | An agent needs a runtime such as Codex, Claude, process, HTTP, or future specialist lane | Keep adapter setup out of first-run onboarding |
| Runs | Receipts for helper work | You need to inspect what happened, what model/tool ran, what it cost, or why it failed | Runs are receipts |
| Costs / usage | Spend record | You need to understand model/tool spend or routing tradeoffs | Cost is part of trust, not an afterthought |
| Inbox / approvals | Human judgment queue | The system needs approval, review, or a decision before external impact | Approval protects public, customer, money, governance, and cross-engine boundaries |
| Recovery states | Visible stuck-work state | A run failed, paused, blocked, or needs help | Recovery states are places where stuck work asks for help |
| Documents / artifacts | Work product and supporting context | A task needs source material, drafts, generated files, or reviewable output | Artifacts should be inspectable and linked back to work |
| Routines | Scheduled or repeated work | A process should recur safely | Recurring automation must stay visible and bounded |
| Settings / secrets | Advanced control surface | You need provider keys, bridge config, model policy, or runtime setup | Keep this away from Thomasina's first useful output |

## 3. The First-Run Rule

Do not start a nontechnical user in Agents, Adapters, Secrets, or model
settings.

Start with:

1. Sign in.
2. Describe the venture messily.
3. Let SimOne draft a first map or readout.
4. Show the first judgment boundary.
5. Use tasks/runs/costs only when delegation needs inspection.

## 4. How To Read A Task

A task is the atomic work item in the control plane.

In SimOne language, a task should answer:

- What are we trying to improve or decide?
- What source material or signal caused this task?
- Who or what is allowed to work on it?
- What should the human review?
- What is blocked or uncertain?
- What output should become durable memory, a public artifact, or a next move?

For SIM Starter, the first task should carry the messy founder note, scanner
handoff when available, first-map draft expectations, and provenance.

## 5. How To Read An Agent

An agent is not a person to trust blindly. It is a bounded helper role.

A good SimOne agent has:

- a narrow purpose
- clear task boundaries
- explicit tools or skills
- an adapter/runtime choice hidden from first-run users
- run receipts
- cost records
- approval gates for public, customer, cash, governance, or irreversible action

When role names sound executive, keep the stack clear:

- CEO is a familiar product label for orientation, not permission to bypass the
  human owner.
- A boardroom brain such as Fable 5 can review strategy or methodology, but it
  does not own the company.
- Engine stewards turn Product, Customer, Cash, or Skills signals into bounded
  work.
- Specialist adapters such as future Fugu/Fugu Ultra return candidate outputs
  for review; they are not supervisors.
- Paperclip task agents leave receipts in tasks, runs, costs, and approvals.

## 6. How To Read A Run

A run is the receipt for one helper attempt.

Use runs when you need to know:

- what was attempted
- which adapter/model/tool ran
- what context was supplied
- what the helper said or changed
- what it cost
- whether it completed, failed, paused, or needs recovery

Runs are where sovereignty becomes practical: SimOne should not ask Han to trust
invisible automation while the system is still being built.

## 7. What SimOne Adds On Top

Paperclip gives the work ledger. SimOne adds:

- product-language onboarding
- Venture Architecture Map
- Systems Bottleneck Scanner
- Sprint Zero Brief
- Customer Engine Readout
- SIM Coach explanations
- SIM Wiki memory and synthesis
- model-routing strategy and approval gates
- shareable artifacts that omit private runtime details

## 8. Where State Lives

When a Workbench surface feels like "the product," separate display from
ownership:

- SIM Coach may explain a signal, but the explanation is ephemeral until the
  user saves it into SIM Wiki or turns it into a task.
- SIM Wiki owns durable memory, synthesis, source refs, and provenance; it
  should not silently absorb every live bridge count or run transcript.
- Tissuu owns the live Customer Engine queue for now; SimOne reads it and can
  preserve selected proof or decisions.
- Paperclip owns protected work: tasks, agents, runs, approvals, costs, recovery
  states, documents, and artifacts.
- The model routing audit owns provider/model/adapter route decisions and spend
  evidence; this stays in advanced review surfaces.

The practical rule: if a piece of information should be trusted later, it needs
a durable owner and a receipt. If it is only helping the user decide now, keep
it lightweight until the human promotes it.

## 9. What To Improve Next

The inherited control-plane surfaces are useful but still too raw for the
target user. As SimOne productizes, improve them by:

- renaming or framing first-run surfaces in venture language
- showing "why this matters" only in context
- making approvals and recovery states feel like help, not errors
- making cost and provenance review easier
- keeping advanced model/provider controls behind expert settings
- linking durable decisions into SIM Wiki
