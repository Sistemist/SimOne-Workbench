---
title: SimOne Product Language
type: concept
tags: [simone, product-language, thomasina]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Product Language

This page keeps the first SimOne definitions close to the wiki so the Coach,
starter, and future maintainer agent share one vocabulary.

## Core Terms

**SimOne** is the hosted product shell and operating layer for SIM. It turns the
method into a guided workspace with artifacts, coaching, memory, and bounded
agent delegation.

**SIM** is the Systems Intelligence Model. In the product, SIM should appear
through useful maps, bottleneck diagnoses, approval gates, and contextual
explanations before theory.

**Thomasina** is the reference user: capable, nontechnical, curious about
agents, and not looking for provider setup or CTO language on the first screen.

**SIM Coach** is the contextual explainer and reviewer. It helps the user
understand what a signal means, why a bottleneck matters, what is safe to
delegate, and when human judgment should stay in the loop.

**SIM Wiki** is the inspectable memory layer. It stores source material,
method pages, venture context, durable decisions, synthesis, provenance, and
change history.

## Paperclip Translation

Paperclip supplies the control plane underneath SimOne. SimOne should translate
that machinery into founder-friendly language instead of forcing it onto the
first screen.

**Company** means the protected workspace where the venture lives.

**Project** means a scoped workstream, sprint, or operating area.

**Issue or task means a protected work item** that can be drafted, reviewed,
approved, blocked, completed, or delegated.

**Agent** means a bounded helper role with instructions and tools. It is not an
autonomous executive.

**Run** means the audit trail for one helper execution: what was attempted,
what happened, and what it cost.

## Product Artifacts

**Venture Architecture Map** is the map of engines, roles, constraints, risks,
and next decisions for a venture.

**Systems Bottleneck Scanner** is the lightweight diagnostic that identifies
the likely bottleneck, the affected engine, and a safe next move. Scanner
example notes let a user try customer, cash, skills, or product situations
without writing a perfect first prompt. Results show signal strength and a
secondary engine to watch when the note points in more than one direction.
Scanner results can hand off to SIM Coach for a contextual method explanation
before the user creates a protected map.

**Sprint Zero Brief** is the first useful operating brief: what is clear, what
needs proof, the human review boundary, and the first move. Public scanner
briefs carry into the protected SIM Starter task after sign-in.

## Boundaries

Tissuu is the stable personal Customer Engine for now. SimOne reads it through a
read-only bridge. Live bridge counts stay live. Only durable decisions, proof,
or customer learning should be promoted into SIM Wiki.

Model/provider choices belong in advanced settings, not first-run onboarding.
During development, SimOne should prefer inspectable routing and logged
decisions before relying on black-box orchestration.

## Coach Rule

Use product language first. Introduce SIM vocabulary only when it helps the user
act, decide, or preserve knowledge.
