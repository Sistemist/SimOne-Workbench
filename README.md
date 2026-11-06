# Sysdom.ai Workbench

**Building an operating system for founders and AI agents to run ventures together.**

[Sysdom.ai](https://sysdom.ai) is building an **Agentic Venture OS**: one coherent view of a venture, with shared context for the people and agents working on it.

This repository is the application's development workbench. It is a fork of [Paperclip](https://github.com/paperclipai/paperclip), whose agent orchestration and company control plane provide the foundation for Sysdom's venture operating layer.

## Why Sysdom

More agent output does not automatically mean a healthier venture.

Founders still need to understand how the business fits together, identify what is holding it back, decide what deserves attention, and retain what they learn.

Sysdom brings systems intelligence into that operating loop:

1. **See the whole venture** through connected context.
2. **Identify the likely constraint** using available evidence.
3. **Choose a bounded next action** with clear ownership and approval.
4. **Review the outcome** and carry the learning into the next cycle.

The founder directs the venture. Agents work within explicit goals, context, permissions, and limits.

## Four connected engines

The Systems Intelligence Model (SIM) is the method beneath Sysdom.

| Engine | What it covers |
| --- | --- |
| **Product/Service** | What you make, the value it creates, and whether it is worth making. |
| **Customer** | Who needs it, how they find it, and why they return. |
| **Cash** | What funds the work and sustains the venture. |
| **Skills** | The capabilities of the founder, team, and agents doing the work. |

The aim is to keep decisions coherent across these engines as the venture evolves.

## What this fork is building

Sysdom's development extends the Paperclip foundation toward:

- Shared venture context, operating rules, and retained decisions.
- Founder-facing views of the venture and its four engines.
- Evidence-based Venture Review and constraint diagnosis.
- Bounded work connected to venture goals and current priorities.
- Saved deliverables, founder review, and a clear next action.
- Governed agent execution with visible costs, approvals, and cancellation.

These capabilities are under active development. Their presence in source code does not establish live availability or end-to-end reliability.

## Built on Paperclip

Paperclip provides substantial infrastructure for company-scoped work, agents and adapters, task coordination, approvals, execution tracking, costs, and activity history.

That foundation is the work of the Paperclip maintainers and contributors. Sysdom builds on it with its own venture model, founder experience, and systems intelligence workflows.

- **Upstream project:** [paperclipai/paperclip](https://github.com/paperclipai/paperclip)
- **Upstream documentation:** [paperclip.ing/docs](https://paperclip.ing/docs)
- **Sysdom:** [sysdom.ai](https://sysdom.ai)
- **Public Venture Review integration:** [sysdom-venture-review-plugin](https://github.com/Sistemist/sysdom-venture-review-plugin)

The repository name `SimOne-Workbench` and existing Paperclip package names remain technical identifiers. **Sysdom.ai** is the current product and masterbrand.

## Local development

Requirements: **Node.js 24.18.x** and **pnpm 9.15.4**.

```sh
git clone --branch simone-main https://github.com/Sistemist/SimOne-Workbench.git
cd SimOne-Workbench
pnpm install
pnpm dev
```

The development server normally serves the application and API at `http://localhost:3100`.

See [Developing](doc/DEVELOPING.md) for configuration, local instances, database setup, and verification commands. Read [AGENTS.md](AGENTS.md) before contributing or running agents.

Live agent execution requires deliberate provider configuration and authorization; follow the repository's spend-safety guidance.

## Repository structure

| Directory | Contents |
| --- | --- |
| `server/` | API, orchestration, and application services |
| `ui/` | Founder and operator interface |
| `packages/` | Shared contracts, database, adapters, and supporting packages |
| `doc/` | Product, engineering, and operating documentation |
| `evals/` | Evaluation material and fixtures |

## License and attribution

See [LICENSE](LICENSE) for the MIT License and original copyright notices.

Paperclip and its contributors retain credit for the upstream software. The inherited README credited © 2026 [Paperclip Labs, Inc.](https://paperclip.ing); the original notices in this repository's license remain intact.
