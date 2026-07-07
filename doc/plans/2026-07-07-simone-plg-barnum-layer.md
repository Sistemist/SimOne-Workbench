# SimOne PLG And Barnum Layer

Status: Product direction for alpha
Date: 2026-07-07
Related:
- `doc/plans/2026-07-04-tissuu-customer-engine-bridge.md`
- `doc/plans/2026-07-07-tissuu-bridge-response.md`
- Linear `SYS-198`, `SYS-199`, `SYS-200`, `SYS-201`

## Decision

Keep building SimOne as the main product and operating layer. Do not turn Tissuu
into a multi-tenant SaaS right now.

Tissuu remains Han's working Customer Engine and connects to SimOne by reference
through the read-only bridge. SimOne becomes the broader product surface for the
Systems Intelligence Model, the book, and the course.

## Product-Led Growth Frame

SimOne should become the approachable "colored hats" version of SIM:

- simple enough for a nontechnical founder to try
- useful before the user understands the theory
- rigorous underneath, with SIM Coach explaining the method when relevant
- shareable enough to become a growth loop

The product and authority loops should reinforce each other:

- personal authority, book, and course send people into SimOne
- SimOne usage naturally points back to SIM, the book, and the course
- Tissuu provides proof and live Customer Engine signal without becoming the next
  product rebuild

## What To Borrow

### Shareable Artifacts

SimOne should produce public/read-only artifacts that are useful on their own:

- Venture Architecture Map
- Systems Bottleneck Scan
- Sprint Zero Brief
- Customer Engine Readout

These outputs should carry subtle attribution such as "Built with SimOne" and
avoid exposing private company data by default.

### Public Micro-Tool

Create a lightweight public Systems Bottleneck Scanner:

- input: startup URL, founder note, or both
- output: one bottleneck, affected engine/driver, and one next action
- CTA: create a SimOne account for the full map

This should be bounded and cheap in v1, not an uncontrolled agent crawl.

### Methodology Loop

Do not add generic course ads inside the app. Instead, add contextual
methodology moments:

- "Learn why" when a feedback loop is missing
- "Ask SIM Coach" when a judgment boundary appears
- SIM Wiki links before book/course links
- book/course pointers only when the user is already asking why the system works

## Tissuu Boundary

Tissuu is not a productization target in this phase.

Use Tissuu to:

- keep Han's Customer Engine running
- provide live customer signal to SimOne
- dogfood relationship intelligence and aligned-node language
- deep-link back to Tissuu for approvals

Do not use SimOne to post, follow, email, mutate prospects, or approve drafts in
v1. Writes are a later bridge phase only after the read-only bridge proves
useful.

## Linear Follow-Ups

- `SYS-198`: Customer Engine live Tissuu bridge wiring
- `SYS-199`: Shareable SimOne venture artifacts
- `SYS-200`: Public Systems Bottleneck Scanner
- `SYS-201`: Methodology loop from SIM Coach to book/course
