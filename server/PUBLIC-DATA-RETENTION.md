# Public Venture Review retention — approved October 9, 2026

Applies only to the Sysdom public service. Dify, other services, active accounts,
newsletter subscriptions and statutory/company accounting records are outside this
cleanup. The private review method is not a package or retention artifact.

- Routine diagnostic/security logs: at most 30 days through daily rotation (29
  completed daily files plus the current file), with hourly age checks. An incident
  exception requires a separately isolated copy, a documented owner/reason/expiry,
  and deletion when that exception ends; do not silently disable routine rotation.
- Itemized review usage: 90 days, only after provider reconciliation. Never delete
  active/unknown reservations, unreconciled charges or current-month accounting.
  No historical aggregate is created by this change.
- Unconverted requests: 12 calendar months from the latest submitted request for
  that normalized email or a separately recorded meaningful founder contact.
  Administrative updated_at and invitation activity do not reset this clock.
  Exclude account holders, activated/unexpired grants, owned/claimed scans,
  newsletter-tagged records and explicit time-bounded holds.
- Access-request messages include an explicitly selected, editable short review
  summary if the founder chooses it. Delete the message, copied expired/revoked
  grant contact data and associated unclaimed scan data together.
- Legacy unclaimed scans: existing 30-day expiry, now checked hourly as well.
- Raw public analytics: 90 days. No new long-lived aggregates. Current review
  events omit browser IDs and attribution; older event types may contain them.
- Database and scoped manual backups: 30 days. The exact October 9 cold rollback
  files are reconciled into this schedule, but deletion requires a successful
  isolated restore proof and a fresh normal DB backup. Failure preserves recovery
  material and fails the job for operator action; do not claim an exception-free
  deadline when this guard is failing.

## Operators

`SYSDOM_PUBLIC_RETENTION_STATE` points to mode-0600 `/var/lib/sysdom-retention/state.json`
in an independent mode-0700 host mount. The JSON shape is validated before cleanup.
Never include it in a database restore: missing/malformed state blocks startup.
`retainPublicData` runs before listening and hourly, with a transaction/advisory lock.
Logs contain deletion counts, not contact data. The journal holds random deleted
row IDs for 32 days so a restored old DB is cleaned before traffic resumes. It
contains no notes/emails. Keep it available throughout backup recovery.

`server/scripts/public-retention.ts` defaults to dry-run. Set an explicit
`DATABASE_URL`, `SYSDOM_PUBLIC_RETENTION_STATE` and optionally
`SYSDOM_PUBLIC_RETENTION_LEDGER`. Pass `--apply` only after inspecting counts.
For real founder correspondence outside the form, record its time with
`--record-contact REQUEST_UUID ISO_TIMESTAMP`; this changes only the independent
contact clock, uses the same lock, validates the request and rejects future or
backward dates. Han owns recording these contacts; do not treat admin edits as
consent or contact. A temporary incident hold has an exact record UUID, owner,
reason and `until`; edit holds only with the service stopped or its advisory lock.

Host file inventory is `python3 scripts/sysdom-retention-host.py` (dry-run) and
`--apply` (narrow allowlisted deletion only). It ignores symlinks, unknown names,
Docker data, volumes and unrelated services. Its hourly systemd timer records
counts/paths. Daily logrotate handles current logs, including empty quiet periods.
The app and review MCP use dedicated syslog outputs; app file logs are also rotated.
The public app nginx access format omits request bodies, headers, tokens and raw
URLs/query strings. Generic intake/activation HTTP logging omits content.

## Restore and verification

Restore the DB into an isolated database with no HTTP listener or model worker.
Use the CURRENT independent journal, run cleanup and check counts before traffic.
Startup enforces that same cleanup. A missing journal is a recovery incident, not
permission to initialize a new empty one. Carry a separately protected journal copy
when moving hosts; keep its lifecycle aligned with the backups it protects.

The tested restore consists of restoring a production SQL backup into a temporary
DB, checking only table counts and dropping it. Deterministic PostgreSQL tests
additionally restore a deleted fictional row, verify tombstone cleanup, protect
active/contact/hold cases and reject corrupt state. SQLite tests verify dry-run,
idempotency and preserved budget reservations/current-month totals.

Session review content remains memory-only with 15-minute access expiry; clearing
a session does not delete the separate request, usage, host transcript or export.
No cleanup invokes a model, sends outreach or changes a newsletter subscription.
