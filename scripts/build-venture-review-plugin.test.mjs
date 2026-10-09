import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const plugin = fileURLToPath(new URL("../integrations/codex-plugins/sysdom-venture-review/", import.meta.url));

test("Codex and Claude share one portable skill/helper without private method or automatic services", async () => {
  const files = (await readdir(plugin, { recursive: true, withFileTypes: true }))
    .filter((entry) => !entry.isDirectory()).map((entry) => {
      assert(entry.isFile(), "Package must contain regular files, not external symlinks");
      return path.relative(plugin, path.join(entry.parentPath, entry.name)).split(path.sep).join("/");
    }).sort();
  assert.deepEqual(files, [
    ".claude-plugin/plugin.json", ".codex-plugin/plugin.json", "README.md",
    "scripts/public-review.mjs", "scripts/review.mjs", "skills/venture-review/SKILL.md",
  ]);
  const codex = JSON.parse(await readFile(path.join(plugin, ".codex-plugin/plugin.json"), "utf8"));
  const claude = JSON.parse(await readFile(path.join(plugin, ".claude-plugin/plugin.json"), "utf8"));
  assert.deepEqual(Object.keys(claude).sort(), ["author", "description", "name", "version"]);
  assert.equal(claude.name, codex.name);
  assert.equal(claude.version, codex.version);
  assert.equal(claude.author.name, "Sysdom.ai");
  assert(claude.description.length > 0);

  const temp = await mkdtemp(path.join(tmpdir(), "sysdom-native-package-"));
  try {
    const portable = path.join(temp, claude.name);
    await cp(plugin, portable, { recursive: true });
    for (const file of files) assert.deepEqual(await readFile(path.join(portable, file)), await readFile(path.join(plugin, file)));
    const skillDir = path.join(portable, "skills/venture-review");
    const skill = await readFile(path.join(skillDir, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: venture-review\n/);
    assert(skill.includes("../../scripts/review.mjs"));
    const helper = path.resolve(skillDir, "../../scripts/review.mjs");
    const result = spawnSync(process.execPath, [helper, "preview", "--origin", "https://example.com", "--fictional-only"], {
      cwd: temp, env: { PATH: path.dirname(process.execPath) }, input: "{}", encoding: "utf8", timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Only an explicit loopback origin is supported/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
