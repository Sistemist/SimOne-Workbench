import { createRoot } from "react-dom/client";
import { PublicVentureReview } from "../components/PublicVentureReview";
import "../index.css";
if (!import.meta.env.DEV || location.hostname !== "127.0.0.1") throw new Error("Local fictional rehearsal only");
const root = createRoot(document.getElementById("root")!);
fetch("/api/venture-review-example").then(r => r.json()).then(example => root.render(<PublicVentureReview example={example} />))
  .catch(() => root.render(<p role="alert">The local example could not load. No model was called.</p>));
