# SimOne Memory And Coach Layer

Status: Proposed for alpha
Date: 2026-07-02
Related:
- `doc/memory-landscape.md`
- `doc/plans/2026-03-17-memory-service-surface-api.md`
- `packages/plugins/plugin-llm-wiki/README.md`
- `packages/plugins/plugin-llm-wiki/templates/AGENTS.md`
- Linear `SYS-181`

## Decision

For the course alpha, SimOne should make Paperclip's LLM Wiki plugin the first
memory/knowledge substrate and reframe it as the SIM Coach/SIM Wiki layer.

Do not introduce Mem0, Graphiti, Cognee, Hindsight, or another dedicated memory
backend as the default alpha path yet. Treat them as provider candidates for the
later Paperclip memory service contract.

## Why

Thomasina does not need to choose a memory architecture. She needs SimOne to
protect her from an agentic setup that starts with "define tools, pick models,
wire providers, good luck."

Paperclip already has the closest fit for SimOne's immediate need:

- local-file wiki root with `raw/`, `wiki/`, `AGENTS.md`, `IDEA.md`, index, log,
  and provenance
- wiki browse/search/read/write tools
- ingest, query, lint, index refresh, and Paperclip distillation skills
- a managed Wiki Maintainer agent and maintenance routines
- explicit source caps and security gates around issue/document ingestion
- project standups and durable project pages that can become SIM operating memory

That gives SimOne a human-auditable memory layer before adding a black-box
personalization or graph-memory backend.

## Alpha Product Shape

### V0: SIM Wiki As Coach Content

Rebrand and seed the LLM Wiki pattern as a SIM Wiki:

- `raw/`: uploaded source material, book excerpts, research notes, founder input
- `wiki/sim/`: SIM concepts, system laws, archetypes, engine/driver guidance
- `wiki/projects/<slug>/standup.md`: current operating state of the venture
- `wiki/projects/<slug>/index.md`: durable venture context
- `wiki/synthesis/`: coach answers worth preserving
- `wiki/log.md`: append-only memory/change record

In the UI, lead with "SIM Coach" and "Knowledge" rather than "LLM Wiki".

### V1: Contextual Coach Nudges

Use the wiki as the source for local contextual guidance:

- During starter setup: "You are missing Customer. That usually weakens demand
  learning."
- During task planning: "This is a Product task, but it depends on Customer
  signal. Add a research step?"
- During org changes: "Removing feedback/culture/governance removes a control
  loop. Continue, but record the tradeoff."
- During agent execution: "This work is safe to delegate, but the final judgment
  should stay with the human."

The coach can be a right/left panel, not only a chat. The first useful version is
contextual cards with "Ask SIM Coach" and "Learn why" actions.

### V2: Memory Provider Contract

When the alpha needs persistent personalization, cross-session agent memory, or
multi-hop entity reasoning, connect provider backends through the Paperclip
memory service plan instead of hard-coding one vendor.

Provider candidates from the 2026-07-02 GitHub/API sweep:

| Candidate | Current signal | Fit | Alpha decision |
| --- | ---: | --- | --- |
| `mem0ai/mem0` | ~60k stars, Apache-2.0 | clean agent memory API; user/agent/run scopes | evaluate after SIM Wiki is active |
| `getzep/graphiti` / Zep | ~28k stars, Apache-2.0 | temporal knowledge graph for evolving facts | evaluate for company/market/entity memory |
| `topoteretes/cognee` | ~26.6k stars, Apache-2.0 | self-hosted graph/RAG memory platform | evaluate if graph browsing becomes important |
| `vectorize-io/hindsight` | ~17.9k stars, MIT | structured retain/recall/reflect memory | watch; not default until integration surface is clearer |
| `langchain-ai/langmem` | smaller, MIT | library-level memory experiments | useful reference, not product default |

Open-source counts are directional and should be refreshed before adoption.

## Research Notes

Recent memory research and systems converge on a layered pattern:

- RAG retrieves documents at query time.
- Wiki/compiled knowledge turns source material into durable, inspectable pages.
- Agent memory persists user/session/task context across interactions.
- Temporal graphs help when relationships change over time and multi-hop reasoning
  matters.

Relevant sources inspected on 2026-07-02:

- Karpathy LLM Wiki gist:
  https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Mem0 paper:
  https://arxiv.org/abs/2504.19413
- Zep/Graphiti temporal knowledge graph paper:
  https://arxiv.org/abs/2501.13956
- A-MEM agentic memory paper:
  https://arxiv.org/abs/2502.12110
- Hindsight paper:
  https://arxiv.org/abs/2512.12818
- OpenRouter rankings and app usage pages:
  https://openrouter.ai/rankings
  https://openrouter.ai/apps

## Implementation Implications

1. Add a SimOne/SIM Wiki product wrapper around `plugin-llm-wiki` before adding a
   new memory dependency.
2. Seed the SimOne Starter template with SIM Wiki-ready structure now, then add
   automatic SIM Wiki Maintainer installation once the plugin install path is
   confirmed on the KVM instance.
3. Use SIM-specific pages and coach copy as the adaptation layer; leave upstream
   wiki mechanics intact where possible.
4. Keep Dify as a document/RAG source for existing Tissuu work and optional
   SimOne book retrieval, but do not make Dify the only memory story.
5. Revisit Mem0/Graphiti/Cognee after the coach layer proves where memory is
   actually needed in the user journey.

## Open Questions

- Should the SIM Wiki be installed by default for every company, or offered as
  part of the SimOne Starter template?
- Should the first coach surface be a sidebar panel, a chat, or contextual cards
  in setup/task/org screens?
- Which SIM book/paper excerpts are safe and useful to seed in `raw/` for the
  public alpha?
- Should SimOne expose self-hosted memory provider configuration at all in alpha,
  or keep it behind an admin/advanced area?
