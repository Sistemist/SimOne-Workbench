# Sysdom Canon MCP

Read-only Model Context Protocol access to the verified Sysdom canon.

The server exposes one tool:

- `query_sysdom_canon` — retrieve bounded, cited passages from the configured
  Dify knowledge base.

This package is deliberately separate from Paperclip's operational MCP server.
It has no Paperclip mutation tools, does not talk to the product database, and
does not invoke a generative model.

## Configuration

- `DIFY_API_KEY` — Dify knowledge-base API key. Required and server-side only.
- `DIFY_DATASET_ID` — Dify knowledge-base UUID. Required.
- `DIFY_API_URL` — defaults to `https://api.dify.ai/v1`.
- `DIFY_RETRIEVAL_TIMEOUT_MS` — defaults to `10000`, maximum `30000`.
- `DIFY_RETRIEVAL_TOP_K` — defaults to `5`, maximum `10`.
- `DIFY_RETRIEVAL_SEARCH_METHOD` — defaults to `full_text_search`. Allowed:
  `keyword_search`, `full_text_search`, `semantic_search`, `hybrid_search`.
- `SYSDOM_CANON_MAX_PASSAGE_CHARS` — defaults to `4000`.
- `SYSDOM_CANON_MAX_TOTAL_CHARS` — defaults to `16000`.
- `SYSDOM_CANON_MCP_TOKEN` — bearer token for the remote HTTP endpoint.
  Required for HTTP mode and must be at least 32 characters.
- `SYSDOM_CANON_HTTP_HOST` — defaults to `127.0.0.1`; use `0.0.0.0` inside
  the production container.
- `SYSDOM_CANON_HTTP_PORT` — defaults to `3215`.
- `SYSDOM_CANON_ALLOWED_HOSTS` — comma-separated hostnames accepted by the
  HTTP service, for example `mcp.sysdom.ai`.

The default retrieval method is deterministic full-text search so the bridge
cannot silently select an embedding or reranking model. A semantic or hybrid
method must be an explicit server-side configuration decision.

## Local usage

```sh
pnpm --filter @sysdomai/canon-mcp build
node packages/sysdom-canon-mcp/dist/stdio.js
```

The current entry point uses stdio for local verification. A remote deployment
uses the same server factory with the MCP SDK's stateless Streamable HTTP
transport:

```sh
pnpm --filter @sysdomai/canon-mcp build
SYSDOM_CANON_MCP_TOKEN='<server-side-token>' \
  node packages/sysdom-canon-mcp/dist/http.js
```

The HTTP service exposes:

- `GET /healthz` — public, minimal retrieval-only health state.
- `/mcp` — bearer-authenticated Streamable HTTP MCP endpoint.

Keep both the Dify credential and MCP bearer token server-side. The service
logs event metadata only and never logs authorization headers, request bodies,
or retrieved canon passages.

## KVM deployment

The production deployment is intentionally isolated from the Workbench,
landing, Dify, and Hermes containers:

```sh
./scripts/deploy-sysdom-canon-mcp-kvm.sh
```

The script:

- runs the package typecheck, tests, and build;
- creates a minimal production dependency bundle;
- provisions one dedicated Dify dataset token and one MCP bearer token on the
  KVM without printing or copying either secret;
- binds the container only to `127.0.0.1:3215`;
- deploys with dropped Linux capabilities, a read-only filesystem, and bounded
  CPU, memory, PID, and request sizes;
- restores the previous image when health verification fails.

Public HTTPS is a separate step. Install
`deploy/nginx-mcp.sysdom.ai.conf` only after `mcp.sysdom.ai` resolves to the KVM
and a certificate exists.
