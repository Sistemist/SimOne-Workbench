import { readdirSync, readFileSync, statSync } from "node:fs";

export const REQUIRED_WIKI_DIRECTORIES = [
  "raw",
  "wiki",
  "wiki/sources",
  "wiki/projects",
  "wiki/entities",
  "wiki/concepts",
  "wiki/sim",
  "wiki/synthesis",
] as const;

export const REQUIRED_WIKI_FILES = ["AGENTS.md", "IDEA.md", "wiki/index.md", "wiki/log.md"] as const;
export const KARPATHY_LLM_WIKI_GIST_URL = "https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f";

function templateFile(path: string): string {
  return readFileSync(new URL(`../templates/${path}`, import.meta.url), "utf8");
}

function agentInstructionFiles(agentKey: string): Record<string, string> {
  const root = new URL(`../agents/${agentKey}/`, import.meta.url);
  const files: Record<string, string> = {};

  function walk(relativeDir: string) {
    const dirUrl = new URL(relativeDir ? `${relativeDir}/` : "./", root);
    for (const entry of readdirSync(dirUrl)) {
      if (entry === ".DS_Store") continue;
      const relativePath = relativeDir ? `${relativeDir}/${entry}` : entry;
      const entryUrl = new URL(relativePath, root);
      const stat = statSync(entryUrl);
      if (stat.isDirectory()) {
        walk(relativePath);
      } else if (stat.isFile()) {
        files[relativePath] = readFileSync(entryUrl, "utf8");
      }
    }
  }

  walk("");
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

export const DEFAULT_WIKI_SCHEMA = templateFile("AGENTS.md");
export const DEFAULT_AGENT_INSTRUCTION_FILES = agentInstructionFiles("wiki-maintainer");
export const DEFAULT_AGENT_INSTRUCTIONS = DEFAULT_AGENT_INSTRUCTION_FILES["AGENTS.md"] ?? "";
export const DEFAULT_IDEA = templateFile("IDEA.md");
export const DEFAULT_INDEX = templateFile("wiki/index.md");
export const DEFAULT_LOG = templateFile("wiki/log.md");
export const DEFAULT_GITIGNORE = templateFile("gitignore.template");
export const DEFAULT_SIM_ARCHETYPES = templateFile("wiki/sim/archetypes.md");
export const DEFAULT_SIM_COACHING_GUIDANCE = templateFile("wiki/sim/coaching-guidance.md");
export const DEFAULT_SIM_DRIVERS = templateFile("wiki/sim/drivers.md");
export const DEFAULT_SIM_ENGINES = templateFile("wiki/sim/engines.md");
export const DEFAULT_SIM_SYSTEM_LAWS = templateFile("wiki/sim/system-laws.md");
export const DEFAULT_SIMONE_PRODUCT_LANGUAGE = templateFile("wiki/concepts/simone-product-language.md");
export const DEFAULT_SIMONE_DOCS_INDEX = templateFile("wiki/concepts/simone-docs-index.md");
export const DEFAULT_SIMONE_PRD = templateFile("wiki/concepts/simone-prd.md");
export const DEFAULT_SIMONE_GLOSSARY = templateFile("wiki/concepts/simone-glossary.md");
export const DEFAULT_SIMONE_AGENT_FLOWS = templateFile("wiki/concepts/simone-agent-flows.md");
export const DEFAULT_SIMONE_MODEL_ROUTING = templateFile("wiki/concepts/simone-model-routing.md");

export const QUERY_PROMPT = `Answer from the SIM Wiki using the installed wiki-query skill.

Read the target space's wiki/index.md first, inspect relevant pages and raw/source references in that same space, cite the wiki page paths and raw source paths used, and say when the wiki does not contain enough evidence. Useful durable synthesis should be filed back into wiki/synthesis/ inside that same space. Always pass the operation issue's wikiId and spaceSlug to SIM Wiki tools.
`;

export const LINT_PROMPT = `Lint the SIM Wiki using the installed wiki-lint skill.

Audit the target space only for contradictions, stale claims, orphan pages, missing backlinks, weak provenance, and wiki/index.md / wiki/log.md drift. Also look for important concepts mentioned without pages and answers that should have been filed back into wiki/. Return findings grouped by severity with concrete file paths, evidence, and suggested fixes — do not auto-apply edits. Always pass the operation issue's wikiId and spaceSlug to SIM Wiki tools.
`;

export const BOOTSTRAP_FILES: ReadonlyArray<{ path: string; contents: string }> = [
  { path: ".gitignore", contents: DEFAULT_GITIGNORE },
  { path: "AGENTS.md", contents: DEFAULT_WIKI_SCHEMA },
  { path: "IDEA.md", contents: DEFAULT_IDEA },
  { path: "wiki/index.md", contents: DEFAULT_INDEX },
  { path: "wiki/log.md", contents: DEFAULT_LOG },
  { path: "raw/.gitkeep", contents: "" },
  { path: "wiki/sources/.gitkeep", contents: "" },
  { path: "wiki/projects/.gitkeep", contents: "" },
  { path: "wiki/entities/.gitkeep", contents: "" },
  { path: "wiki/concepts/.gitkeep", contents: "" },
  { path: "wiki/concepts/simone-product-language.md", contents: DEFAULT_SIMONE_PRODUCT_LANGUAGE },
  { path: "wiki/concepts/simone-docs-index.md", contents: DEFAULT_SIMONE_DOCS_INDEX },
  { path: "wiki/concepts/simone-prd.md", contents: DEFAULT_SIMONE_PRD },
  { path: "wiki/concepts/simone-glossary.md", contents: DEFAULT_SIMONE_GLOSSARY },
  { path: "wiki/concepts/simone-agent-flows.md", contents: DEFAULT_SIMONE_AGENT_FLOWS },
  { path: "wiki/concepts/simone-model-routing.md", contents: DEFAULT_SIMONE_MODEL_ROUTING },
  { path: "wiki/sim/.gitkeep", contents: "" },
  { path: "wiki/sim/archetypes.md", contents: DEFAULT_SIM_ARCHETYPES },
  { path: "wiki/sim/coaching-guidance.md", contents: DEFAULT_SIM_COACHING_GUIDANCE },
  { path: "wiki/sim/drivers.md", contents: DEFAULT_SIM_DRIVERS },
  { path: "wiki/sim/engines.md", contents: DEFAULT_SIM_ENGINES },
  { path: "wiki/sim/system-laws.md", contents: DEFAULT_SIM_SYSTEM_LAWS },
  { path: "wiki/synthesis/.gitkeep", contents: "" },
];
