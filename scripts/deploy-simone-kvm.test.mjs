import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const script = fs.readFileSync(new URL("./deploy-simone-kvm.sh", import.meta.url), "utf8");
const dockerignore = fs.readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");

test("keeps internal-only material out of deploy sync and Docker context", () => {
  for (const path of [
    "doc/",
    "docs/",
    "output/",
    "ARCHITECTURE.md",
    "Paperclip AI License Verification.md",
  ]) {
    assert.match(script, new RegExp(`--exclude '${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  }

  for (const path of ["doc", "docs", "output", "ARCHITECTURE.md", "Paperclip AI License Verification.md"]) {
    assert.ok(dockerignore.split("\n").includes(path), `.dockerignore must exclude ${path}`);
  }
});

test("requires clean pushed release evidence and records rollback metadata", () => {
  assert.match(script, /check-docker-runtime-pins\.mjs/);
  assert.match(script, /status --porcelain --untracked-files=normal/);
  assert.match(script, /rev-parse '@\{upstream\}'/);
  assert.match(script, /DEPLOY_SHA=/);
  assert.match(script, /PREVIOUS_IMAGE_ID=/);
  assert.match(script, /ROLLBACK_TAG=/);
  assert.match(script, /rollback_remote_deploy/);
});

test("limits runtime mutation and cache cleanup to the SimOne service", () => {
  assert.doesNotMatch(script, /docker compose[^\n]* down/);
  assert.match(script, /compose build paperclip/);
  assert.match(script, /compose up -d --no-deps --force-recreate paperclip/);
  assert.match(script, /docker builder prune --force --filter 'until=168h' --keep-storage 10GB/);
  assert.match(script, /docker image prune --force --filter 'until=168h'/);
});
