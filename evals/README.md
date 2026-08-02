# Paperclip Evals

Eval framework for testing Paperclip agent behaviors across models and prompt versions.

See [the evals framework plan](../doc/plans/2026-03-13-agent-evals-framework.md) for full design rationale.

## Quick Start

### Deterministic Sysdom routing and experiment checks

The default Sysdom evaluation path is provider-free. It uses versioned fixtures
and makes no model or provider request:

```bash
pnpm exec vitest run \
  server/src/__tests__/model-route-engine-benchmark.test.ts \
  server/src/services/model-route-experiment.test.ts \
  --project @paperclipai/server
```

The Experiment Lane corpus compares a sovereign frontier control with one
deliberation/audit challenger and one external-specialist challenger. Synthetic
results prove only that the comparison and safety gates work. They cannot
nominate a model, create adoption authority, activate a portfolio, or dispatch
a provider.

### Prerequisites

Promptfoo is an optional live-provider path, not the default check. Running it
requires the repository's current paid-AI approval and hard-cap rules, an exact
pinned provider/model configuration, and separate authorization for that run.

```bash
pnpm add -g promptfoo
```

You need an API key for at least one provider. Set one of:

```bash
export OPENROUTER_API_KEY=sk-or-...    # OpenRouter (recommended - test multiple models)
export ANTHROPIC_API_KEY=sk-ant-...     # Anthropic direct
export OPENAI_API_KEY=sk-...            # OpenAI direct
```

### Run evals

```bash
# Smoke test (default models)
pnpm evals:smoke

# Or run promptfoo directly
cd evals/promptfoo
promptfoo eval

# View results in browser
promptfoo view

# Structural YAML check without calling models
ruby -e 'require "yaml"; Dir["evals/promptfoo/**/*.yaml"].each { |f| YAML.load_file(f); puts "ok #{f}" }'
```

### What's tested

Phase 0 covers narrow behavior evals for the Paperclip heartbeat skill:

| Case | Category | What it checks |
|------|----------|---------------|
| Assignment pickup | `core` | Agent picks up todo/in_progress tasks correctly |
| Progress update | `core` | Agent writes useful status comments |
| Blocked reporting | `core` | Agent recognizes and reports blocked state |
| Approval required | `governance` | Agent requests approval instead of acting |
| Company boundary | `governance` | Agent refuses cross-company actions |
| No work exit | `core` | Agent exits cleanly with no assignments |
| Checkout before work | `core` | Agent always checks out before modifying |
| 409 conflict handling | `core` | Agent stops on 409, picks different task |
| Fusion-style high-risk routing | `model_routing` | Router chooses deliberation/audit for critical uncertain public claims |
| Fugu-style bounded specialist routing | `model_routing` | Router chooses external specialist only for bounded hard execution |
| Hidden root router rejection | `model_routing` | Router preserves the route ledger and human approval gates |
| Experiment fairness | `model_routing` | Control and challenger share task/context hashes and complete telemetry |
| Synthetic authority boundary | `model_routing` | Provider-free fixtures cannot nominate, adopt, activate, or dispatch |

### Adding new cases

1. Add a YAML file to `evals/promptfoo/cases/`
2. Follow the existing case format (see `core-assignment-pickup.yaml` for reference)
3. Run `promptfoo eval` to test

### Phases

- **Phase 0 (current):** Promptfoo bootstrap - narrow behavior evals with deterministic assertions, now including initial SimOne model-routing boundary cases
- **Phase 1:** TypeScript eval harness with seeded scenarios and hard checks
- **Phase 2:** Pairwise and rubric scoring layer (provider-free M5 baseline complete)
- **Phase 3:** Efficiency metrics integration
- **Phase 4:** Production-case ingestion
