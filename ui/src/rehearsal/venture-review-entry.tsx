import { createRoot } from "react-dom/client";
import { createVentureReviewClient, ventureReviewShareDraftSchema, ventureReviewStartSchema } from "@paperclipai/shared";
import { SystemsBottleneckScanner } from "../pages/SystemsBottleneckScanner";
import "../index.css";

if (!import.meta.env.DEV || !["127.0.0.1", "localhost"].includes(location.hostname)) throw new Error("Fictional rehearsal is local development only");
const client = createVentureReviewClient({ basePath: "/api/companies/11111111-1111-4111-8111-111111111111/venture-reviews", fetcher: fetch });
const root = createRoot(document.getElementById("root")!);
fetch("/api/venture-review-example", { cache: "no-store" }).then(async (response) => {
  if (!response.ok) throw new Error("Local example unavailable");
  const raw = await response.json();
  const example = { question: ventureReviewStartSchema.parse({ question: raw.question }).question, draft: ventureReviewShareDraftSchema.parse(raw.draft) };
  root.render(<SystemsBottleneckScanner reviewClient={client} reviewExample={example} />);
}).catch(() => root.render(<p role="alert">Local review could not load. No evidence was sent and no model was called.</p>));
