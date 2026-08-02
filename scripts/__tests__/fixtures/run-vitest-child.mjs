const mode = process.env.PAPERCLIP_TEST_RUNNER_CHILD_MODE;

if (mode === "success") {
  console.log("[test-child] completed");
  process.exit(0);
}

if (mode === "failure") {
  console.error("[test-child] failed");
  process.exit(7);
}

if (mode === "wait") {
  console.log("[test-child] ready");
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  setInterval(() => {}, 1_000);
} else {
  console.error(`[test-child] unknown mode: ${mode ?? "missing"}`);
  process.exit(2);
}
