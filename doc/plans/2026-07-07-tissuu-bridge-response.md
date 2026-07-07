# Tissuu Customer Engine Bridge — Tissuu-side response & contract

Status: SHIPPED (read-only v1), live in prod 2026-07-07
Responds to: `doc/plans/2026-07-04-tissuu-customer-engine-bridge.md`
Built by: Claude (Tissuu side). Consumed by: Codex (SimOne side).

## TL;DR

The four read-only endpoints in the plan are built, deployed, and returning
live data. SimOne can start building the Customer Engine card against this
contract now. Nothing here mutates Tissuu; every actionable item carries an
absolute `deepLink` back to a Tissuu surface where Han approves/publishes.

## Base + auth

- **Base URL:** `https://app.tissuu.ai/api/simone/customer-engine`
- **Auth:** `Authorization: Bearer <SIMONE_BRIDGE_TOKEN>` on every request.
  - Dedicated token, separate from Tissuu's CRON_SECRET.
  - Set in Tissuu's Vercel prod env. **Han shares the value with SimOne
    out-of-band** (it lives in the Tissuu `.env` / Vercel env — not committed).
  - No token or wrong token → `401`. Token unset on server → `503`
    `bridge_not_configured` (SimOne should render a clear unavailable state,
    per the plan's data rules — never invent Customer Engine status).

## Open questions — answered

1. **Cheapest endpoints?** All four are cheap reads over existing tables. No
   new pipelines; `/digest` + `/actions` project from one shared gatherer.
2. **Poll / cache / both?** Poll live for now — endpoints are light. `/digest`
   is safe to cache SimOne-side for a few minutes; `/actions` and `/ops` prefer
   fresh. No new Tissuu cron was needed.
3. **Auth?** `SIMONE_BRIDGE_TOKEN` bearer (above).
4. **What belongs in SIM Wiki (durable) vs live read?** Durable: promoted proof
   points, positioning/offer decisions, "this relationship matters" verdicts.
   Live-read (ephemeral, do NOT persist): funnel counts, job status, the
   pending action queue.

## Endpoints

### `GET /digest` — daily executive readout
```json
{
  "date": "2026-07-07",
  "generatedAt": "2026-07-07T08:53:06Z",
  "headline": "33 items waiting on you (10 high-priority)",
  "summary": "10 replies + 3 posts to review · 6 prospect touches · 9 voice candidates · 5 proof points",
  "wins": ["3 posts published this week"],
  "risks": ["3 network candidate(s) flagged as possible mis-resolves — need handle verification"],
  "nextActions": [{ "title": "Approve reply to @fchollet", "priority": "high", "deepLink": "https://app.tissuu.ai/drafts" }],
  "sourceLinks": [{ "label": "Drafts", "href": "https://app.tissuu.ai/drafts" }]
}
```

### `GET /actions` — human review queue
```json
{ "generatedAt": "...", "count": 33, "actions": [
  { "id": "reply:286", "kind": "approve_reply", "title": "Approve reply to @fchollet",
    "priority": "high", "reason": "Grounded in \"...\". <preview>",
    "deepLink": "https://app.tissuu.ai/drafts", "dueAt": null, "source": "voice-watch" }
]}
```
`kind` ∈ `approve_reply | review_post | prospect_touch | approve_voice | verify_voice | promote_proof`.
`priority` ∈ `high | medium | low`. `id` is stable per underlying item — safe to
dedupe/ack against.

### `GET /metrics` — funnel + quality signals
```json
{ "waitlistTotal": 11, "weeklyNew": 0, "qualifiedLeads": 2, "prospectsTracked": 1833,
  "sourceMix": [{ "source": "Maven LL", "count": 8 }],
  "replyRate": 0.03, "proofEvents": 10 }
```
Note: `waitlistTotal` is the **Tissuu-mirrored** waitlist (direct signups +
imported), not the full Maven roster. `replyRate` = share of last-30d reply
drafts that were approved+published (throughput, not engagement rate).

### `GET /ops` — agent/job health
```json
{ "overall": "healthy", "jobs": [
  { "name": "voice-watch", "label": "Voice-watch replies", "lastRunAt": "...",
    "status": "ok", "detail": "last output 12h ago (fresh ≤ 24h)" }
], "staleSignals": [] }
```
`status` ∈ `ok | stale | unknown`. v1 derives last-run from each job's newest
observed output; a `job_runs` table can back this later **without changing the
shape**.

## Boundaries (v1)

- Read-only. No posting/following/emailing/prospect-mutation originates from
  SimOne. Deep links take Han back to Tissuu to act.
- Future writes (ack a digest item, create a Tissuu follow-up task, attach a
  SimOne decision note) are v2 — only after the read bridge proves useful, each
  with a visible human action + audit trail.

## For Codex

Start with the compact dashboard **panel** answering: what customer signal
changed (`/digest`), what needs Han (`/actions`), is the engine healthy
(`/ops`), are the numbers moving (`/metrics`). Fuller Customer Engine detail
page can follow. Fit Paperclip's existing dashboard — do not build a separate
command-center UI.
