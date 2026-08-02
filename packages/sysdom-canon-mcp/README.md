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
- `DIFY_RETRIEVAL_SEARCH_METHOD` — defaults to `keyword_search`. Allowed:
  `keyword_search`, `full_text_search`, `semantic_search`, `hybrid_search`.
- `SYSDOM_CANON_MAX_PASSAGE_CHARS` — defaults to `4000`.
- `SYSDOM_CANON_MAX_TOTAL_CHARS` — defaults to `16000`.

The default retrieval method is keyword search so the bridge cannot silently
select an embedding or reranking model. A different retrieval method must be an
explicit server-side configuration decision.

## Local usage

```sh
pnpm --filter @sysdomai/canon-mcp build
node packages/sysdom-canon-mcp/dist/stdio.js
```

The current entry point uses stdio for local verification. A remote deployment
should wrap the same server factory in the MCP SDK's stateless Streamable HTTP
transport and keep the Dify credential on the server.
