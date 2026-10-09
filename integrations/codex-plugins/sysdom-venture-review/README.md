# Local Venture Review handoff

Development draft with a packaged local command bridge. The Codex package completed an explicitly approved fictional founder-host trial; native Claude packaging is prepared locally but not installed or activated. This package has no remote service connection, automatic workspace collection, paid-call authority or private-method export.

The existing skill can prepare a selected packet in the founder's current assistant. The local `/scanner` UI now accepts that packet without a new protocol or a cloud upload. It performs a separate final preview/approval; a JSON `consent: true` field is not accepted as consent.

## Manual handoff to the public review, when available

The founder can use [Venture Review](https://app.sysdom.ai/venture-review) separately from the local helper when the public page reports availability. This is a manual web handoff, not a native plugin connection or a claim that deployment is complete.

1. In the current assistant, prepare one question and a plain-text note of at most **8,000 characters**, using only sources the founder has permitted. Preserve source labels, dates where known, uncertainty and material omissions. Do not silently truncate evidence or collect additional workspace content.
2. Show the complete note for editing and redaction. The founder chooses whether to copy it into the web form; never place notes, source content or credentials in a URL. The public form accepts a note, not the local helper's JSON packet.
3. On the web page, the founder checks current availability, recipients, retention and the final sharing preview before explicitly starting the review. Preparing or copying the note does not grant submission consent. Optional website/GitHub retrieval has its own visible source selection; a typed URL alone is not retrieved evidence. If unavailable, keep the local draft; do not retry automatically or route it through another provider.
4. The founder may download the readable result and choose to bring it back to the original assistant. The export contains approved evidence; the host's normal transcript/file retention applies to any imported copy. Treat the result as provisional evidence, not permission for further action. Requesting access after the result is optional and does not save the full review or create an account.

The helper remains loopback-only and requires `--fictional-only`. It cannot call the public service, and this handoff does not install or update either native package.

## Try the recorded fictional journey

From the app worktree, with Node 24.18.x:

```sh
pnpm dev:venture-review /absolute/path/to/m1-2026-09-21 --fictional-only
```

Open the printed loopback `/scanner` URL. Load the fictional CU01 example, start, inspect/edit selected excerpts, preview, and explicitly approve sharing. The answer is a structured adaptation of a recorded fictional review, not a new assessment. Changing its question, excerpts, source metadata, selection, or omissions prevents replay. Download the readable result with its approved evidence and take it back to the same assistant as provisional data, not authority to act.

Optional `--public-web` enables the existing bounded public HTTP(S) collector. It does not enable a model. Each inspection still requires explicit approval of exact page/redirect URLs in the UI. Sites receive a normal request and the local network address, not the founder's notes or private method. No cookies, logins, query strings, linked-page crawling, script execution, retries, or private-network destinations. The default remains simulated network access. Use public example pages only for current local tests; no real founder data.

## Packet format

Ask the assistant to prepare only specifically permitted fictional sources; do not install/connect anything or inspect additional sources automatically. Paste this shape into **Bring selected evidence from Codex or Claude Code**:

```json
{
  "sources": [{
    "id": "selected-note",
    "kind": "workspace_file",
    "title": "Selected fictional paragraph",
    "capturedAt": "2026-09-29T09:00:00.000Z",
    "sourceDate": null,
    "excerpt": "The exact permitted excerpt, already redacted.",
    "basis": "checked_excerpt",
    "omitted": ["Remaining document not shared"]
  }],
  "collectionOmissions": ["No other files or conversations approved"]
}
```

Source kinds: `founder_note`, `workspace_file`, `conversation_excerpt`, `website_page`, `structured_record`. Evidence basis: `source_claim`, `agent_summary`, `checked_excerpt`, `website_text`. If available, preserve `provenance: { sourceUri, excerptLocation, contentSha256 }`; do not invent a hash or date. Up to 40 unique source IDs, 12,000 characters per excerpt; empty/invalid packets fail visibly without replacing the current preview. Import is local only; it does not approve or submit. No fresh assessment is configured for arbitrary packets.

Sessions live in local process memory for 15 minutes. Cancellation clears service-held evidence/result state; it cannot recall a file the founder explicitly downloaded. Export contains approved excerpts—do not publish it by accident. Public identity, retention and model decisions remain separate release gates.

## Packaged host command

`pnpm build:venture-review-plugin` bundles the existing shared client and validation schemas into `scripts/review.mjs` in this plugin. Only Node 24.18.x is needed after packaging; no repository paths, credentials, provider libraries or private SIM method are included. Source: `packages/shared/scripts/venture-review-host.mjs`. Rebuild after changing that source or the shared contracts.

The skill can invoke this helper from a host with shell access. There is no MCP server, background process or new service protocol. It uses the same company-scoped REST exchange as `/scanner` and requires an explicit loopback origin on every command. It rejects redirects and remote endpoints, times out ordinary requests after 10 seconds (explicit fresh submission after 125 seconds) and never retries. `--fictional-only` is mandatory; a loopback address is not authority to send real founder data.

After separately starting the runner in simulated-network mode, prepare a JSON input containing only `{ "question": ..., "draft": ... }`. For CU01 use these two fields from `evals/fixtures/venture-review-cu01-demo.json`; do not include its recorded result. With the founder's permission to create local files, an example shell flow is:

```sh
node <plugin-root>/scripts/review.mjs preview --origin http://127.0.0.1:PORT --fictional-only < fictional-packet.json > preview.json
# Inspect the entire preview and obtain explicit approval before this next command.
node <plugin-root>/scripts/review.mjs submit --origin http://127.0.0.1:PORT --fictional-only --approve <approvalSha256> < preview.json > recorded-review.json
node <plugin-root>/scripts/review.mjs status --origin http://127.0.0.1:PORT --fictional-only < preview.json
node <plugin-root>/scripts/review.mjs cancel --origin http://127.0.0.1:PORT --fictional-only < preview.json
```

Preview sends the fictional question locally and retains the evidence on the host until submission. The approval digest binds endpoint, session, question, disclosure and complete normalized draft. It detects changes; it does not authenticate a human. The service enforces the draft approval and recorded-case match independently. Returned JSON includes the full structured review, exact approved evidence and session receipt. The scanner still accepts the same `draft` directly and retains its existing readable export.

Files above persist until the operator removes them; host transcript retention is controlled by the host. Cancel only clears service-held state. Real human approval, production identity, public access and provider retention remain release requirements. Claude uses the same manual JSON flow or Node helper through the native manifest below; Claude plugin installation and actual-chat behavior remain unverified.

Local verification: `pnpm build:venture-review-plugin` then `pnpm exec vitest run server/src/__tests__/venture-review-host.test.ts`. The test invokes the built helper from a temporary directory with no repo dependencies or provider environment, against a loopback mock service. It covers result/evidence return, exact approval, changed/stale packets, failure without retry, cancellation, redirect refusal, endpoint restrictions and private-input errors.

## Native Claude Code package

This same directory also contains `.claude-plugin/plugin.json`. Claude discovers the existing `skills/venture-review/SKILL.md` as `/sysdom-venture-review:venture-review`; both hosts use the same `scripts/review.mjs`, shared client, evidence preview and approval boundary. There is no separate Claude reviewer, hook, background agent, MCP server, model override or automatic permission grant. The `codex-plugins` parent directory is a historical repository path, not a host restriction. Layout and skill namespacing follow the [Claude plugin manifest reference](https://code.claude.com/docs/en/plugins-reference) and [Claude skills reference](https://code.claude.com/docs/en/skills).

Rebuild once for both hosts with `pnpm build:venture-review-plugin`. Run `node --test scripts/build-venture-review-plugin.test.mjs` for the portable package check and the host test above for the mock service round trip. These checks copy the package/helper into temporary directories with no provider environment; they do not launch Claude or update global host configuration.

Claude CLI was not available on PATH or the standard local binary paths during preparation. The authoritative native check, `claude plugin validate <plugin-root>`, and a supervised Claude discovery/preview/approval/result/cancel trial remain unverified. Do not claim native loading or instruction following from these structural tests. Claude installation/activation and any model session require their separately scoped authorization; this package supplies no runtime model choice, paid-call authority or retention override.

## Fresh-review path, exercised with a provider mock

The local source package is now `0.1.1`; the globally installed Codex `0.1.0` remains unchanged. Rebuilding does not install or activate either host package.

```sh
pnpm dev:venture-review /absolute/path/to/m1-2026-09-21 --fictional-only --provider-mock
```

This loads **PS02** from the existing fictional catalogue: rising delivery lateness, unchanged QA allocation and a new integration, with unknown retention/cash effects and competing causes. `evals/fixtures/venture-review-ps02-demo.json` contains the adapted packet and an explicitly authored mock response. It is plumbing evidence, not a model-quality result. The private catalogue and method are unchanged; evaluator-only expectations never enter the request.

The injected provider transport composes the complete private method with the approved packet, reuses the governed OpenRouter request builder, pins model/upstream, and disables fallbacks. It requires fresh request-bound authorization, reconciled prior billing, matching credential fingerprint for live mode, independent cap evidence, token/context limits and an atomic claim. Missing/zero usage, mismatched identities, invalid JSON, invented source IDs or high-confidence hypotheses fail closed without repair/retry. One attempt consumes that transport; a response is still unreconciled until independent provider billing is checked. Structural checks do not prove that cited text entails every generated claim.

The runner **only** injects an in-process mock (`mock://venture-review/openrouter`); accidental native fetch cannot reach a provider through that URL. Mock cap/pricing/usage values are marked simulated. No credential lookup or live runner flag exists. The helper and scanner expose and bind `execution.mode`/model to approval, label provider mock versus recorded response, and preserve exact evidence/provenance. The helper requires explicit `--fresh-review` for fresh preview and submission; this flag never replaces separately approved activation or server-side spend/privacy proof. A live transport is available for explicit server injection, but no live service, authentication policy, model choice or paid call is enabled by this package.

### October 1 local fresh-helper completion

Both hosts share the same helper. For a separately authorized, deliberately configured fictional fresh service, add `--fresh-review` to the existing preview and submit commands. Defaults still refuse fresh submission. The exact preview now binds reasoning effort as well as mode/model/recipients and evidence. Status/cancel remain available without opting into submission. The provider adapter requires an explicit `max_tokens` or `max_completion_tokens` parameter; Azure uses the latter. File controls atomically consume an authorization before dispatch and preserve a sanitized receipt in an explicit run directory. Never delete or change directories to reuse a consumed authorization.

The subprocess integration check exercises PS02 through the packaged helper, real REST exchange and governed provider adapter, with Sol High/Azure-shaped metadata and ALL provider IO intercepted. It tests a response beyond ten seconds, exact evidence return, refusal without opt-in, model/effort drift, duplicate submission, durable claim reuse rejection and cancellation. No Sol model was called. This closes the local command path; native host discovery/instruction following and fresh answer quality remain unproven. Installed Codex 0.1.0 remains unchanged; these are unreleased source 0.1.1 edits.

## October 8 local demo — current procedure and provisional reviewer

The shortest current Codex-first demo uses the existing helper or scanner with the **same** fictional PS02 packet. No global plugin update, provider key or fresh model run is needed:

```sh
pnpm dev:venture-review /absolute/path/to/m1-2026-09-21 --fictional-only --ps02-recorded
```

Use `evals/fixtures/venture-review-ps02-oct08-demo.json` **question and draft only** as helper input, or load the example in the printed `/scanner` URL. Inspect recipients and editable excerpts, preview, approve, read the findings and capacity-bounded first move, and export the approved sources with the result. A modified packet fails closed; it is not given a generic answer. The source fixture clearly distinguishes the October 8 Sol 6.1 recording from authored structural edits and the smaller next test. Export preserves those limitations. Historical CU01 remains available with neither PS02 flag, and old fixtures/receipts remain unchanged.

The private server loads the complete unchanged SIM core plus `runtime-2026-10-08/procedure.md`, hash-checked against that private directory's manifest, as `sim-aulet-local-2026-10-08`. This local successor includes the refined five-step SIM–Aulet procedure and requires capacity-fit, decision-useful observations, and precise derived-count meanings. It contains no worked case or evaluator answer. Neither the method nor its manifest is packaged in the host plugin or served to the browser.

Replacing `--ps02-recorded` with `--provider-mock` exercises the same approved evidence through the provisional exact `openai/gpt-6.1-sol`, High/standard, Azure global request shape. All provider IO is intercepted in process; price/cap/usage proof is simulated. The visible label remains **PROVIDER MOCK — NO MODEL CALLED**. The generic fresh adapter still requires explicit credential/proof injection; neither command can execute a paid review. No unrelated app routing or production default changed.

A local scripted helper round trip establishes the command bridge, not automatic skill discovery or human approval behavior in a native Codex chat. Installed Codex and Claude packages are unchanged. A supervised Emin feedback demo can use this fictional recorded journey; real-founder evidence, external delivery, global installation and publication remain separate. Claude parity is not a prerequisite for this Codex-first demo.
