import { readFile } from "node:fs/promises";
import { evaluateAlphaWorkloadEconomics } from "../server/src/services/model-portfolio-economics.js";

const proposalUrl = new URL(
  "../evals/fixtures/sysdom-model-portfolio.proposal.v1.json",
  import.meta.url,
);
const planUrl = new URL(
  "../evals/fixtures/sysdom-alpha-workload-economics.v1.json",
  import.meta.url,
);

const [proposal, plan] = await Promise.all([
  readFile(proposalUrl, "utf8").then(JSON.parse),
  readFile(planUrl, "utf8").then(JSON.parse),
]);

const report = evaluateAlphaWorkloadEconomics(proposal, plan);
console.log(JSON.stringify(report, null, 2));
