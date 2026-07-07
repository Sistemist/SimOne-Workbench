# SimOne Agent And Product Flows

Status: Living flow map
Date: 2026-07-08

## 1. Layer Map

```mermaid
flowchart TD
  H["Human meta-controller\nHan or Thomasina"] --> S["SimOne supervisory layer\nproduct shell, routing, coach, approvals"]
  S --> P["Paperclip control plane\ncompanies, agents, tasks, skills, adapters, runs"]
  S --> W["SIM Wiki\nsource, concepts, venture memory, synthesis"]
  S --> C["SIM Coach\ncontextual explanation and review"]
  S --> T["Tissuu bridge\nread-only Customer Engine signal"]
  P --> A["Bounded agents and adapters\nCodex, Claude, process, HTTP, future specialist"]
  S --> R["Sovereign model router\nroute ledger, costs, context, evaluations"]
  R --> M["Model lanes\nbackground, workhorse, frontier, deliberation/audit, specialist"]
  M --> OR["Optional OpenRouter Fusion deliberation lane"]
  M --> F["Optional Fugu/Fugu Ultra execution lane"]
  M --> HR["Optional Headroom compression before model context"]
```

Principle: the human keeps judgment, SimOne supervises and explains, Paperclip
coordinates work, agents execute bounded tasks.

## 2. SIM Starter Flow

```mermaid
sequenceDiagram
  participant U as User
  participant S as SimOne
  participant W as SIM Wiki
  participant C as SIM Coach
  participant P as Paperclip

  U->>S: Signs in and describes the venture messily
  S->>S: Drafts first venture map
  S->>W: Stores source note and draft context with provenance
  S->>C: Requests contextual review
  C-->>S: Explains one bottleneck and one judgment boundary
  S-->>U: Shows map, brief, next action, and approval choice
  U->>S: Approves or edits
  S->>P: Creates bounded tasks only after approval
```

Product rule: do not start by asking the user to manually fill all engines,
drivers, adapters, and model settings.

## 3. Tissuu Customer Engine Bridge Flow

```mermaid
sequenceDiagram
  participant T as Tissuu
  participant B as SimOne bridge service
  participant S as SimOne UI
  participant U as Han
  participant W as SIM Wiki

  S->>B: Request Customer Engine bridge state
  B->>T: Read digest, actions, metrics, ops
  T-->>B: Return live read-only data
  B-->>S: Normalize bridge card/page payload
  S-->>U: Show readout and deep links
  U->>T: Approves or reviews inside Tissuu
  U->>S: Optionally promotes durable insight
  S->>W: Store promoted proof or decision only
```

Product rule: live counts and pending queues are ephemeral. Durable proof,
positioning, or relationship decisions may be promoted to SIM Wiki by an
explicit user action.

## 4. SIM Coach And SIM Wiki Interaction

```mermaid
flowchart LR
  X["User action or system signal"] --> D{"Is there a useful teaching moment?"}
  D -- "No" --> Q["Keep UI focused on the task"]
  D -- "Yes" --> C["Show SIM Coach nudge"]
  C --> A{"User asks why or needs judgment?"}
  A -- "No" --> Q
  A -- "Yes" --> W["Retrieve from SIM Wiki"]
  W --> E["Explain in plain language"]
  E --> P{"Worth preserving?"}
  P -- "No" --> Q
  P -- "Yes" --> L["Promote synthesis to SIM Wiki with provenance"]
```

Product rule: the coach should explain the method when it helps the user act,
not turn the app into a course ad.

## 5. Sovereign Model Routing Flow

```mermaid
sequenceDiagram
  participant S as SimOne
  participant R as Sovereign Router
  participant H as Headroom candidate
  participant M as Model or Adapter
  participant L as Run Ledger
  participant U as Human

  S->>R: Submit task intent, risk level, context summary
  R->>R: Choose lane and required approval gate
  R->>H: Optionally compress large JSON/code/RAG context
  H-->>R: Compressed context plus retrieval references
  R->>M: Run explicit provider/model/adapter
  M-->>R: Return output and usage
  R->>L: Record route, context summary, model, cost, output, confidence
  R-->>S: Return result and review requirements
  S-->>U: Ask approval when boundary requires judgment
```

Dev-mode rule: every important route should be inspectable before SimOne depends
on black-box orchestration.

## 6. Optional OpenRouter Fusion Deliberation Flow

```mermaid
sequenceDiagram
  participant R as SimOne sovereign router
  participant O as OpenRouter Fusion
  participant J as Judge analysis
  participant L as Run Ledger
  participant U as Human

  R->>O: Send high-risk or uncertain prompt
  O->>O: Panel models answer in parallel
  O->>J: Compare consensus, contradictions, gaps, blind spots
  J-->>R: Return structured deliberation analysis
  R->>L: Record Fusion route, cost, disagreement, final synthesis
  R-->>U: Present result with uncertainty and approval gate
```

Escalation rule: use Fusion when disagreement is informative and the cost of
being wrong is higher than the extra cost/latency of multiple model calls.

## 7. Optional Fugu Experiment Flow

```mermaid
sequenceDiagram
  participant R as SimOne sovereign router
  participant F as Fugu or Fugu Ultra
  participant L as Run Ledger
  participant V as Evaluator or frontier reviewer

  R->>F: Send bounded specialist task
  F-->>R: Return synthesized result and usage fields
  R->>V: Compare or review result
  V-->>R: Accept, reject, or request fallback
  R->>L: Record external specialist route and evaluation outcome
```

Experiment rule: Fugu can be useful without becoming the root of trust. It must
sit behind SimOne's logs, evaluations, fallback rules, and human approval gates.

## 8. Paperclip Control-Plane Flow

```mermaid
sequenceDiagram
  participant P as Paperclip scheduler or user action
  participant A as Adapter
  participant G as Agent runtime
  participant API as Paperclip API
  participant L as Run record

  P->>A: Invoke adapter for assigned task
  A->>G: Spawn or call agent runtime
  G->>API: Check assignment and context
  G->>API: Update task, comments, artifacts, or status
  A-->>P: Return stdout, status, usage
  P->>L: Store run result, transcript, cost, recovery state
```

SimOne product rule: keep this proven control-plane machinery where it works;
adapt the user's conceptual experience around it.

## 9. Approval Gates

Require human approval before:

- public claims or publishable artifacts
- customer/prospect outreach or mutation
- money, pricing, budget, or contract commitments
- deletion or irreversible data changes
- cross-engine tradeoffs
- governance or permissions changes
- model/provider spend-policy changes
- Tissuu bridge write-back, if v2 is ever built

Safe to delegate when:

- the task is bounded
- the context is scoped
- the output is reversible
- the route and cost are logged
- the result can be reviewed before external impact
