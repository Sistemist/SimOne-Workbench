# Codex Session Handoff

Date: 2026-07-07
Repo: `/Users/sistemist/Desktop/SimOne-Workbench`
Branch: `simone-main`

Use this note to start a fresh Codex session without losing the thread.

## Paste This Prompt Into A New Session

```text
Continue SimOne Workbench in /Users/sistemist/Desktop/SimOne-Workbench.

Read ARCHITECTURE.md first, then inspect git status.

Current direction:
- SimOne is the productization vehicle and hosted product shell for SIM.
- Paperclip remains the base/reference control plane.
- Tissuu remains Han's stable personal Customer Engine for now.
- Tissuu connects to SimOne by read-only bridge, not migration.
- Build the Barnum/PLG layer into SimOne: useful simple outputs first, SIM theory explained contextually.
- Hide model/provider complexity by default.
- Target user remains Thomasina: nontechnical, curious about agents, easily scared by CTO words.

Latest shipped work:
- Commit 57ea1ca91 wired the read-only Tissuu Customer Engine bridge into SimOne.
- Commit 069ff08c8 exposed SIMONE_BRIDGE_TOKEN and SIMONE_TISSUU_BRIDGE_BASE_URL through the KVM compose override.
- Deployed to https://sim.sysdom.org/app via scripts/deploy-simone-kvm.sh.
- Live bridge probe from inside the SimOne container returned:
  status live, headline "35 items waiting on you (10 high-priority)", actions 35, waitlistTotal 11, ops healthy.
- Claude confirmed the same numbers from the Tissuu side.

Important files:
- ARCHITECTURE.md
- doc/plans/2026-07-07-tissuu-bridge-response.md
- doc/plans/2026-07-07-simone-plg-barnum-layer.md
- server/src/services/customer-engine-bridge.ts
- server/src/routes/customer-engine-bridge.ts
- ui/src/api/customerEngine.ts
- ui/src/components/CustomerEngineBridgeCard.tsx
- ui/src/pages/Dashboard.tsx
- ui/src/pages/CustomerEngine.tsx
- docker/docker-compose.simone-public.yml

Important Linear issues:
- SYS-181: umbrella product-flow work
- SYS-198: Customer Engine live Tissuu bridge wiring
- SYS-199: shareable SimOne venture artifacts
- SYS-200: public Systems Bottleneck Scanner
- SYS-201: contextual methodology loop from SIM Coach to book/course

Secrets:
- SIMONE_BRIDGE_TOKEN is installed on the KVM env file.
- Do not print it.
- Do not commit it.

Next sensible work:
1. Visually verify the Customer Engine bridge card in the authenticated app.
2. Improve the Dashboard and Customer Engine surfaces so the live Tissuu signal feels native to SimOne, not bolted on.
3. Start SYS-199: shareable venture artifacts.
4. Start SYS-200: Systems Bottleneck Scanner.
5. Start SYS-201: contextual SIM Coach methodology loop.
6. Keep Tissuu bridge v2 write-back deferred until Han has lived with read-only v1.

Model strategy:
- Fable 5 was discussed on 2026-07-07.
- Anthropic API model name: claude-fable-5.
- Use it sparingly for high-level planning, SIM Coach, architecture reviews, and audits.
- Do not use it for routine background agent ticks.
- Codex cannot switch its own chat model, but can call external APIs from the workspace if keys are provided.

Before claiming completion:
- Run relevant tests/typechecks/builds.
- Deploy with scripts/deploy-simone-kvm.sh when runtime changes need production.
- Update Linear after meaningful code/deploy/product-direction work.
```

## What Happened Today

### Tissuu Bridge

Claude shipped the Tissuu side of the bridge:

- `/digest`
- `/actions`
- `/metrics`
- `/ops`

Codex wired SimOne to read those endpoints through a server-side bridge route:

```text
GET /api/companies/:companyId/customer-engine/bridge
```

SimOne now renders the bridge state on:

- Dashboard Customer Engine bridge card
- Customer Engine page

If the bridge token is missing or invalid, SimOne shows an unavailable state and
explicitly avoids inventing signal.

### Token And Compose Fix

Han provided the bridge token in chat. Codex installed it only on the KVM env
file. The token value was not committed.

The first probe showed the token was present on the host but absent inside the
container. Root cause: `docker/docker-compose.simone-public.yml` did not pass
`SIMONE_BRIDGE_TOKEN` through to the `paperclip` container.

Codex added:

```yaml
SIMONE_BRIDGE_TOKEN: "${SIMONE_BRIDGE_TOKEN:-}"
SIMONE_TISSUU_BRIDGE_BASE_URL: "${SIMONE_TISSUU_BRIDGE_BASE_URL:-https://app.tissuu.ai/api/simone/customer-engine}"
```

Then committed and deployed:

- `069ff08c8`: Expose Tissuu bridge env in KVM compose

### PLG And Barnum Direction

The product direction now includes a PLG/Barnum layer:

- SimOne should be useful before the user understands SIM theory.
- The product should sell the method through useful outputs.
- SIM Coach should explain why when the user hits a meaningful boundary.
- Shareable artifacts and a public bottleneck scanner are part of the growth
  loop.

Created/recorded:

- `doc/plans/2026-07-07-simone-plg-barnum-layer.md`
- SYS-199
- SYS-200
- SYS-201

### Fable 5 Direction

Han asked whether to use expiring Anthropic API credits for Fable 5.

Decision:

- Yes, SimOne can wire Fable 5 through the Anthropic API for high-level planning.
- Yes, Codex can call Fable 5 from the workspace through the API for a second
  opinion or audit.
- No, it should not be the default background model.
- Use it as a high-cost "boardroom brain" for strategy, SIM Coach, architecture,
  and codebase audits.

## Current Clean State

Last observed:

```text
git status: clean on simone-main, aligned with origin/simone-main
HEAD: 069ff08c8
Production health: ok
Bridge probe: live
```

## Recommended Next Slice

Make the live Customer Engine bridge card feel product-native:

- Show the live headline in a calmer executive style.
- Make "Review in Tissuu" clearly an approval boundary.
- Add a small SIM Coach nudge explaining why Customer signal is routed through a
  human review loop.
- Keep it readable for Thomasina.
- Do not add model/provider configuration to this path.

