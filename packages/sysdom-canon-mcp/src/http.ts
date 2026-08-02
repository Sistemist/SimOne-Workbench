#!/usr/bin/env node
import { readConfigFromEnv } from "./config.js";
import { readHttpConfigFromEnv } from "./http-config.js";
import { createSysdomCanonHttpService } from "./http-server.js";

async function main() {
  const service = createSysdomCanonHttpService(
    readConfigFromEnv(),
    readHttpConfigFromEnv(),
  );

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ event: "sysdom_canon_mcp_stopping", signal }));
    await service.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await service.listen();
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "sysdom_canon_mcp_start_failed",
    error: error instanceof Error ? error.message : "unknown error",
  }));
  process.exit(1);
});
