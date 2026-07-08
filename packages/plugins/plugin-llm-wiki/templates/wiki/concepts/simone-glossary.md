---
title: SimOne Glossary
type: concept
tags: [simone, glossary, thomasina]
sources: []
created: 2026-07-08
updated: 2026-07-08
---

# SimOne Glossary

This glossary keeps SimOne product language short, durable, and friendly for
nontechnical review.

## People And Product

**Thomasina** is the reference user: capable, nontechnical, curious about agents,
and easily discouraged by provider setup, CTO language, or raw control-plane
details.

**Han** is the product owner and final SIM authority for the current alpha.

**SimOne** is the hosted product shell and operating layer for SIM.

**Paperclip** is the base and reference control plane. It keeps agents, tasks,
budgets, approvals, runs, and work products inspectable.

**Tissuu** is Han's stable personal Customer Engine for now. SimOne reads from
it through a read-only bridge and should not mutate it in bridge v1.

## SIM Surfaces

**SIM Coach** explains what a signal means, what the user should decide, what is
safe to delegate, and what SIM concept is underneath the moment.

**SIM Wiki** is the inspectable memory layer for source material, product
doctrine, methodology pages, venture context, durable decisions, synthesis, and
provenance.

**Venture Architecture Map** is the shareable map of roles, engines, constraints,
risks, and next decisions for a venture.

**Systems Bottleneck Scanner** is the lightweight diagnostic that names the
likely bottleneck, engine focus, and safe next move.

**Sprint Zero Brief** is the first operating brief produced from messy input:
what is clear, what needs proof, the human review boundary, and the first move.
Public scanner briefs carry into the protected SIM Starter task after sign-in.

## Routing And Context

**Sovereign routing** means SimOne records who routed work, why, what context was
used, which lane or provider was selected, what it cost, and where approval was
needed.

**Context compression** means reducing bulky JSON, tool output, RAG chunks, logs,
or transcripts before they hit a model context window. Current SimOne status:
local audited JSON compression exists for route-decision context payloads;
external Headroom/SmartCrusher is not wired yet.

**Deliberation lane** means a slow, expensive review path for high-risk or
uncertain decisions. OpenRouter Fusion belongs here if it is adopted.

**Specialist adapter** means an optional execution lane for hard work that
SimOne can judge after the fact. Fugu/Fugu Ultra belongs here if it is adopted.

## Safety Rule

Live bridge counts, customer queues, and private operational details stay live
unless a human deliberately promotes a durable synthesis into SIM Wiki.
