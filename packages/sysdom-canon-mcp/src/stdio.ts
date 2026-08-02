#!/usr/bin/env node
import { runServer } from "./index.js";

void runServer().catch((error) => {
  console.error(
    "Failed to start Sysdom canon MCP server:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exit(1);
});
