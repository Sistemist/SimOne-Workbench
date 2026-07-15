import assert from "node:assert/strict";
import test from "node:test";
import process from "node:process";

import {
  checkDockerRuntimePins,
  findUnpinnedGlobalPackages,
} from "./check-docker-runtime-pins.mjs";

test("accepts exact global npm package versions", () => {
  const dockerfile = `
RUN npm install --global pnpm@9.15.4 \\
  && npm install -g @openai/codex@0.144.4 opencode-ai@1.18.2
`;
  assert.deepEqual(findUnpinnedGlobalPackages(dockerfile), []);
});

test("rejects latest, ranges, tags, and missing versions", () => {
  const dockerfile = `
RUN npm install -g @anthropic-ai/claude-code@latest opencode-ai \\
  @google/gemini-cli@^0.50.0 acpx@next
`;
  assert.deepEqual(findUnpinnedGlobalPackages(dockerfile), [
    "@anthropic-ai/claude-code@latest",
    "opencode-ai",
    "@google/gemini-cli@^0.50.0",
    "acpx@next",
  ]);
});

test("the repository Dockerfiles use exact global package versions", () => {
  assert.deepEqual(checkDockerRuntimePins(process.cwd()), []);
});
