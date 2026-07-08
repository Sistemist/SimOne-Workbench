---
title: SimOne Documentation Index
type: concept
tags: [simone, docs, prd, orientation]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Documentation Index

This page helps SIM Coach and the wiki maintainer orient a reader before giving
answers about SimOne.

## Read in this order

1. `ARCHITECTURE.md` for north star, product boundary, deployment posture,
   bridge rules, model strategy, and guardrails.
2. `doc/product/simone-prd.md` for the main product source of truth:
   completion snapshot, scope, definitions, surface ownership, milestones, and
   success criteria.
3. `doc/product/simone-milestone-tracker.md` for the short operator view of
   what is done, what remains, and which Linear issues own the work.
4. `doc/product/simone-glossary.md` when you are confused by a Paperclip term,
   SIM term, routing term, or product-surface name.
5. `doc/product/simone-agent-flows.md` for how human judgment, SIM Coach,
   SIM Wiki, Paperclip, Tissuu, and routing lanes interact.
6. `doc/product/simone-model-routing.md` for Fable 5, Fusion, Fugu/Fugu Ultra,
   Headroom, lane boundaries, and the sovereignty-first dev-mode rule.
7. `doc/product/simone-alpha-flow-blueprint.html` for the visual alpha flow.

## What to read by question

- "What is SimOne?" Read the architecture and PRD.
- "How complete is the project?" Read the PRD snapshot and milestone tracker.
- "What did SimOne add on top of Paperclip?" Read the PRD foundation section
  and glossary Paperclip terms.
- "What do SIM Coach and SIM Wiki mean?" Read the PRD current behavior,
  glossary Product Surfaces, and agent-flow interaction section.
- "Which surface owns which job?" Read the PRD surface ownership map and
  agent-flow ownership map.
- "Why not Fugu or Fusion by default yet?" Read the model-routing strategy,
  PRD model strategy, milestone tracker product stance, and architecture model
  strategy.
- "What is Headroom status?" Read the PRD Headroom section, milestone tracker
  M4, and architecture model strategy.

## Vocabulary rule

When you are confused by a Paperclip term, translate it before making a product
decision: company means protected venture workspace; project means workstream;
task or issue means protected work item; agent means bounded helper role; skill
means reusable capability; adapter means hidden execution pipe; run means audit
trail and receipt; recovery state means visible stuck-work state that asks for
help.

## Source-of-truth rule

The PRD is the product source of truth. The architecture file is the operating
source of truth. The milestone tracker is the short status source of truth. The
glossary and agent-flow map are alignment aids. SIM Wiki answers should mirror
these definitions and cite source pages when possible.
