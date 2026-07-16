# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Purpose

Paperclip is a control plane for AI-agent companies.
The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`.

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

`doc/SPEC.md` is long-horizon product context.
`doc/SPEC-implementation.md` is the concrete V1 build contract.

## 3. Repo Map

- `server/`: Express REST API and orchestration services
- `ui/`: React + Vite board UI
- `packages/db/`: Drizzle schema, migrations, DB clients
- `packages/shared/`: shared types, constants, validators, API path constants
- `packages/adapters/`: agent adapter implementations (Claude, Codex, Cursor, etc.)
- `packages/adapter-utils/`: shared adapter utilities
- `packages/plugins/`: plugin system packages
- `doc/`: operational and product docs

## 4. Dev Setup (Auto DB)

Use embedded PGlite in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. Core Engineering Rules

1. Keep changes company-scoped.
Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. Keep contracts synchronized.
If you change schema/API behavior, update all impacted layers:
- `packages/db` schema and exports
- `packages/shared` types/constants/validators
- `server` routes/services
- `ui` API clients and pages

3. Preserve control-plane invariants.
- Single-assignee task model
- Atomic issue checkout semantics
- Approval gates for governed actions
- Budget hard-stop auto-pause behavior
- Activity logging for mutating actions

4. Do not replace strategic docs wholesale unless asked.
Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. Keep repo plan docs dated and centralized.
When you are creating a plan file in the repository itself, new plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames. This does not replace Paperclip issue planning: if a Paperclip issue asks for a plan, update the issue `plan` document per the `paperclip` skill instead of creating a repo markdown file.

6. Attach inspectable generated artifacts.
When your task produces a user-inspectable deliverable file, follow the Paperclip skill's "Generated Artifacts and Work Products" workflow before final disposition. In this repo, prefer the self-contained skill helper at `skills/paperclip/scripts/paperclip-upload-artifact.sh` so the file is available through the Paperclip API, create/update an artifact work product when the file is the deliverable, link the uploaded artifact in the final issue comment, and then set status. Do not rely on local filesystem paths as the only access path. If an important file intentionally remains workspace-only, create/update a work product with `metadata.resourceRef.kind: "workspace_file"` and a workspace-relative path, then name that work product and path in the final comment. Treat browse/search as a fallback for recovering workspace files, not the preferred deliverable path. See `doc/AGENT-ARTIFACTS.md` for details and `.mp4`/`.webm` examples.

## 5.1 AI Spend Safety (Mandatory)

These rules apply to every contributor and every SimOne/Paperclip agent. They cover paid model calls, live provider probes, agent heartbeats, evaluation runs, browser tests that invoke a model, and multi-agent workflows. Normal deterministic unit, type, lint, and build checks do not count as paid-model tests.

1. Default to no paid model calls.
Use deterministic mocks, recorded fixtures, local models, subscription-included tools with no metered overage, or a currently verified free/next-to-free OpenRouter route. Model availability and pricing must be rechecked at the time of use.

2. Anthropic API usage is forbidden by default.
Do not run a paid Anthropic API test or agent unless the user explicitly approves it in the current conversation after seeing the exact model, purpose, and maximum dollar exposure. Prior approval, an existing key, or available account credit is not authorization. Never enable automatic credit reload.

3. Never rely on an adapter or provider's default model.
Pin the exact provider and model before any live model call. An omitted model is a failed safety check, especially for Claude adapters whose default may be Opus.

4. No paid run starts without independent hard limits.
Before execution, establish and verify all applicable limits: provider/account hard cap, per-run dollar or token cap, maximum turns, timeout, heartbeat/run limit, and concurrency of one. A Paperclip monthly budget alone is insufficient because it is evaluated from Paperclip's own cost ledger and may only react after a run completes.

5. Treat zero, missing, delayed, or unpriced cost as unknown and unsafe.
Do not interpret `$0`, `cost_cents = 0`, absent pricing, subscription billing, or missing usage as free. Stop further runs until the provider's actual usage is reconciled and cost accounting is proven. A configured budget of `0` means unlimited and is not acceptable for a paid agent.

6. Paid multi-agent fan-out and autonomous feedback loops are prohibited.
Use one agent and one bounded run at a time. A second paid run requires reconciliation of the first. Do not allow paid agents to hire, delegate to, wake, retry, or review one another autonomously.

7. Prove safeguards without spending first.
Exercise cap, timeout, cancellation, retry, and pause behavior with mocks or a free route before attaching a paid key. The proof must show fail-closed behavior when price or usage telemetry is absent.

8. Reconcile after every authorized paid run.
Compare Paperclip's ledger with the provider dashboard or response-level usage before continuing. Stop immediately on any discrepancy, unexpected retry, repeated heartbeat, token spike, or no-progress loop. Record the model, run count, observed usage, actual cost, and stop reason without recording secrets.

9. Keep paid keys out of automation by default.
Do not add paid provider keys to GitHub Actions, scheduled jobs, fixtures, committed files, logs, docs, or memory. LLM-enabled CI must remain manual, skip live models by default, use a dedicated capped key, and require explicit approval for each run.

10. Secrets are never evidence.
Do not print, quote, commit, document, or save API keys or passwords in memory. Report only whether a secret is configured and where its lifecycle is controlled.

Temporary SimOne development-login exception: when the user explicitly asks in
the current conversation, an agent may generate or rotate a SimOne-owned,
development-only login password and show it to that user once for immediate
testing. The exception does not apply to provider API keys, access tokens,
database/SSH/deployment credentials, shared accounts, or production passwords.
The temporary password must not be committed, written to files, logs, Linear,
CI, docs, or memory, and it must be rotated before production access expands.

## 6. Database Change Workflow

When changing data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

## 7. Verification Before Hand-off

Default local/agent test path:

```sh
pnpm test
```

This is the cheap default and only runs the Vitest suite. Browser suites stay opt-in:

```sh
pnpm test:e2e
pnpm test:release-smoke
```

Run the browser suites only when your change touches them or when you are explicitly verifying CI/release flows.

For normal issue work, run the smallest relevant verification first. Do not default to repo-wide typecheck/build/test on every heartbeat when a narrower check is enough to prove the change.

Run this full check before claiming repo work done in a PR-ready hand-off, or when the change scope is broad enough that targeted checks are not sufficient:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 7.1 SimOne Linear Operating Rules

- Treat `/Users/sistemist/Developer/SimOne-Workbench-Active` as the canonical active SimOne product and app repository. The distinct `-Active` name is intentional: never infer that an iCloud-restored `~/Desktop/SimOne-Workbench` copy is authoritative. This repo owns `/app`, `/scanner`, `/auth`, onboarding, SIM Coach, Customer Engine, share artifacts, model/routing surfaces, and product behavior.
- The old `/Users/sistemist/Desktop/SimOne` repo is a temporary public landing container only. Do not edit it for product/app behavior. A landing-only patch there is allowed only when the user explicitly approves the exception, and the Linear update must call out that it touched the landing container.
- Do not move the live public root (`https://sim.sysdom.org/`) into Workbench unless the full landing experience, assets, signup API, docker image, nginx routes, deploy path, and visual verification plan are migrated together.
- Prefer finishing a milestone when the next task is self-contained.
- Allow a cross-milestone slice only when it completes a visible first-user path or unblocks a real dependency.
- Use parent/child issues for breakdown and related/blocking links for dependency clarity.
- Avoid fake blockers; use blockers only when the next task truly cannot proceed without the prior one.
- Treat Linear reconciliation as part of the work, not optional reporting after it.
- At the start of every SimOne work session, read the live SimOne project, milestones, and relevant issues before selecting the next slice. Reconcile them with the current branch and recent commits instead of trusting an older tracker or recreating existing work.
- When a meaningful bug, reliability gap, product decision, or follow-up is identified, create or update the relevant Linear issue in the same slice. Do not leave discoveries only in chat, local notes, or commit messages.
- Move the active issue to In Progress when implementation begins. After every meaningful code, deploy, or product-direction slice, comment with the commit SHA when applicable, verification evidence, deploy evidence when applicable, and specific remaining gaps.
- Before ending a session, perform a final Linear reconciliation: issue statuses must match the repository, completed work must have evidence, new findings must be captured, duplicate or superseded issues must be linked or closed, and the project status update must describe the current next slice.
- If milestone completion or sequencing materially changed, update `doc/product/simone-milestone-tracker.md` in the same slice so it and Linear tell the same story.
- A Linear connector failure is an explicit hand-off blocker for reporting, not permission to forget the update. Record what remains to be synchronized and make that reconciliation the first task after access returns.

## 8. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- apply company access checks
- enforce actor permissions (board vs agent)
- write activity log entries for mutations
- return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 9. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 10. Pull Request Requirements

When creating a pull request (via `gh pr create` or any other method), you **must** read and fill in every section of [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Do not craft ad-hoc PR bodies — use the template as the structure for your PR description. Required sections:

- **Thinking Path** — trace reasoning from project context to this change (see `CONTRIBUTING.md` for examples)
- **What Changed** — bullet list of concrete changes
- **Verification** — how a reviewer can confirm it works
- **Risks** — what could go wrong
- **Model Used** — the AI model that produced or assisted with the change (provider, exact model ID, context window, capabilities). Write "None — human-authored" if no AI was used.
- **Checklist** — all items checked

## 11. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
5. PR description follows the [PR template](.github/PULL_REQUEST_TEMPLATE.md) with all sections filled in (including Model Used)
6. Linear is reconciled: issue state, evidence comment, newly discovered follow-ups, project status, and milestone tracker all match the shipped repository state

## 11. Fork-Specific: HenkDz/paperclip

This is a fork of `paperclipai/paperclip` with QoL patches and a **built-in** Hermes adapter story on branch `feat/externalize-hermes-adapter` ([tree](https://github.com/HenkDz/paperclip/tree/feat/externalize-hermes-adapter)).

### Branch Strategy

- `feat/externalize-hermes-adapter` now ships `hermes_local` and `hermes_gateway` as built-in core adapters.
- Older fork branches may still document plugin-only Hermes; treat this file as authoritative for the current branch.

### Hermes (built-in)

- `hermes_local` is available without Adapter manager installation and runs the local Hermes CLI.
- `hermes_gateway` is available without Adapter manager installation and calls an already-running Hermes API server.
- Operators may still install external Hermes packages through Adapter manager to override/shadow the built-ins.
- Optional: `file:` entry in `~/.paperclip/adapter-plugins.json` remains useful for local development of override packages.

### Local Dev

- Fork runs on port 3101+ (auto-detects if 3100 is taken by upstream instance)
- `npx vite build` hangs on NTFS — use `node node_modules/vite/bin/vite.js build` instead
- Server startup from NTFS takes 30-60s — don't assume failure immediately
- Kill ALL paperclip processes before starting: `pkill -f "paperclip"; pkill -f "tsx.*index.ts"`
- Vite cache survives `rm -rf dist` — delete both: `rm -rf ui/dist ui/node_modules/.vite`

### Fork QoL Patches (not in upstream)

These are local modifications in the fork's UI. If re-copying source, these must be re-applied:

1. **stderr_group** — amber accordion for MCP init noise in `RunTranscriptView.tsx`
2. **tool_group** — accordion for consecutive non-terminal tools (write, read, search, browser)
3. **Dashboard excerpt** — `LatestRunCard` strips markdown, shows first 3 lines/280 chars

### Plugin System

PR #2218 (`feat/external-adapter-phase1`) adds external adapter support. See root `AGENTS.md` for full details.

- Adapters can be loaded as external plugins via `~/.paperclip/adapter-plugins.json`
- The plugin-loader should have ZERO hardcoded adapter imports — pure dynamic loading
- `createServerAdapter()` must include ALL optional fields (especially `detectModel`)
- Built-in UI adapters can shadow external plugin parsers; external override pause/resume should restore the built-in parser.
- Reference external adapters: Droid (npm); Hermes can also be tested as an override package.
