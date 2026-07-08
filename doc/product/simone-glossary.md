# SimOne Glossary

Status: Living glossary
Date: 2026-07-08

## SimOne Terms

**SimOne**
: The hosted product shell and operating layer for SIM. SimOne is the product
that turns SIM into guided workspaces, artifacts, coaching, memory, and bounded
agent delegation.

**SIM**
: Systems Intelligence Model. The theory and methodology beneath SimOne. In the
product, SIM appears through useful maps, bottleneck diagnoses, coach nudges,
approval gates, and explanations rather than lectures.

**Thomasina**
: The target-user lens: a capable nontechnical user who is curious about agents
but does not want CTO language, provider setup, or uncontrolled automation.

**Venture**
: The company, project, offer, course, product, or business system being mapped
inside SimOne.

**Venture Architecture Map**
: A shareable or private map of the venture's engines, drivers, assumptions,
risks, and next decisions.

**Systems Bottleneck Scanner**
: A lightweight public or authenticated diagnostic that identifies one major
system bottleneck, the affected engine/driver, and one next action.

**Sprint Zero**
: The first structured pass through a venture. Sprint Zero drafts the initial
map, assumptions, decision gates, and first useful actions before heavy agent
execution.

**Sprint Zero Brief**
: A concise artifact summarizing the first map, bottleneck, assumptions, open
questions, and recommended next move.

**Barnum Layer**
: The translation layer that makes deep SIM concepts feel simple, personally
relevant, and immediately useful without becoming shallow or misleading.

**PLG Layer**
: Product-led growth loop. In SimOne this means public scanners, safe share
artifacts, useful readouts, and contextual "learn why" moments.

## SIM Operating Terms

**Human Meta-Controller**
: The human remains the final steward for judgment, values, public claims,
customer promises, spending, governance, and cross-engine tradeoffs.

**Supervisory Controller**
: SimOne's role: route attention, frame decisions, keep state coherent, and
decide what can be delegated versus what needs human judgment.

**Embodied Controller**
: A bounded agent or tool that executes a specific task within explicit limits.
Agents are not autonomous executives in the product story.

**Engine**
: A core value-producing system in the venture. The current product language
centers Product, Customer, Cash, and Skills, with Innovation, Governance,
Interaction, and Culture as supporting/extended engines or drivers depending on
the map.

**Driver**
: A force or control loop that shapes how an engine behaves. Drivers help explain
why a bottleneck exists and what change may unlock the system.

**Judgment Boundary**
: A point where automation should stop and ask the human. Examples: public
claims, customer outreach, cash commitments, deletions, governance changes,
cross-engine tradeoffs, and model-spend policy changes.

## Product Surfaces

**SIM Coach**
: The contextual explainer, reviewer, and guide. SIM Coach helps the user
understand what a signal means, why a bottleneck matters, what is safe to
delegate, and when to keep judgment. It can retrieve from SIM Wiki and let the
user save useful returned answers as durable synthesis. It can appear as cards,
a panel, or chat.

**SIM Wiki**
: The inspectable memory/knowledge layer for SIM concepts, source material,
venture context, durable decisions, synthesis, and provenance. The first alpha
path is to reframe Paperclip's LLM Wiki plugin as SIM Wiki.

**SIM Wiki Maintainer**
: The bounded wiki agent role that retrieves, compiles, or writes SIM Wiki
material. In SimOne, its work should stay inspectable through Paperclip tasks
and only become durable memory through explicit promotion.

**Customer Engine**
: The relationship/customer-intelligence engine. For now, Han's Customer Engine
lives in Tissuu and sends read-only signal into SimOne.

**Customer Engine Readout**
: A compact SimOne artifact or card showing what changed in customer signal,
what needs human review, whether the engine is healthy, and whether numbers are
moving.

**Tissuu Bridge**
: The read-only integration from Tissuu to SimOne. It exposes digest, actions,
metrics, and ops. It does not mutate Tissuu in v1.

**Methodology Loop**
: The pattern where a product moment offers "Ask SIM Coach" or "Learn why" when
the user is already looking at a bottleneck, missing feedback loop, or judgment
boundary.

## Paperclip Terms

**Paperclip**
: The upstream/base control plane for agent companies. SimOne uses Paperclip as
the reference foundation instead of rebuilding companies, agents, tasks,
adapters, costs, and recovery from scratch.

**Company**
: The top-level Paperclip workspace boundary. Most runtime entities are scoped to
a company.

**Agent**
: A Paperclip actor with instructions, adapter configuration, skills, and task
assignments. In SimOne, agents should map to bounded roles under SIM governance.

**Team**
: A reusable group or org subtree of agents, often represented in markdown-first
company packages.

**Project**
: A workspace area or package unit that contains tasks, context, source material,
and work product.

**Task / Issue**
: A unit of work that can be assigned, checked out, worked, reviewed, blocked,
or completed. Paperclip's single-assignee mechanics protect tasks from
conflicting agent work.

**Skill**
: A reusable instruction/tooling package, usually centered on `SKILL.md`.

**Adapter**
: The bridge from Paperclip to an agent runtime such as Claude Code, Codex,
shell process, HTTP webhook, or future specialist endpoints.

**Run**
: One execution attempt by an agent/adapter. Runs should preserve transcript,
status, cost/usage, and recoverability.

**Run Ledger**
: The audit trail of what ran, why, under which model/adapter, with which
context/cost, and what happened.

**Agent Company Package**
: A markdown-first package format for describing companies, teams, agents,
projects, tasks, and skills using files such as `COMPANY.md`, `TEAM.md`,
`AGENTS.md`, `PROJECT.md`, `TASK.md`, and `SKILL.md`.

## Model And Infrastructure Terms

**Model Lane**
: A SimOne-internal category of model use, such as background, workhorse,
frontier, deliberation/audit, or external specialist. Users should not need to
see this in first-run onboarding.

**Sovereign Router**
: SimOne's own inspectable routing layer. It records routing decisions, context
summaries, model/adapter choices, costs, outputs, and human approvals.

**Fable 5**
: Candidate high-level "boardroom brain" model for strategy, SIM Coach,
architecture review, and audits when current access is verified and keys are
available. Not for routine background ticks.

**Fugu / Fugu Ultra**
: Sakana's OpenAI-compatible orchestration models. Useful as future optional
specialist adapters for hard tasks, but not the default root controller while
SimOne needs full auditability in dev mode.

**OpenRouter Fusion**
: OpenRouter's multi-model deliberation router. Candidate escalation lane for
critical, high-risk, uncertain, or disagreement-sensitive tasks where the cost
of being wrong outweighs extra cost and latency.

**OpenRouter**
: A provider path used in the older alpha for model roles and potentially useful
for BYOK/provider abstraction. In SimOne's product UI it belongs in advanced
settings, not first-run.

**Headroom**
: A candidate compression layer for tool outputs, JSON, code, RAG chunks, files,
logs, and conversation history. External Headroom is not wired into SimOne yet;
SimOne currently has a local audited JSON compression envelope for bulky route
decision context payloads.

**SmartCrusher**
: Headroom's JSON compression component. Candidate first use: Tissuu bridge
payloads, scanner payloads, wiki retrieval results, and run transcripts. The
current local baseline is `simone_json_headroom_v0`, which can later be compared
against SmartCrusher.

**Dify**
: Existing knowledge/RAG service used by Tissuu and possibly SimOne. It remains
production-adjacent and should not be disrupted during SimOne work.

**Hermes**
: Optional local/gateway execution layer. Useful later, not the first user-facing
concept for Thomasina.
