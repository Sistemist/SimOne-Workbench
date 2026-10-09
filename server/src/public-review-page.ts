import type { RequestHandler } from "express";

const legacy = new Set(["/scanner", "/scanner/", "/systems-bottleneck-scanner", "/systems-bottleneck-scanner/"]);
export const publicReviewPage: RequestHandler = (req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && legacy.has(req.path)) {
    const query = req.originalUrl.indexOf("?");
    const target = ["app.sysdom.ai", "sim.sysdom.org"].includes(req.hostname) ? "https://app.sysdom.ai/venture-review" : "/venture-review";
    res.redirect(308, target + (query < 0 ? "" : req.originalUrl.slice(query)));
    return;
  }
  if (req.path === "/venture-review" || req.path === "/venture-review/") {
    res.set("Referrer-Policy", "no-referrer");
    res.set("Cache-Control", "no-store");
    if (req.originalUrl.includes("?")) res.set("X-Robots-Tag", "noindex, nofollow");
  }
  next();
};

export function publicReviewHtml(html: string, requestPath: string) {
  if (!/^\/venture-review\/?(?:\?|$)/.test(requestPath)) return html;
  // Fixed metadata never interpolates notes, query identifiers or the Host header.
  return html.replace(/<title>[^<]*<\/title>/, "<title>Review your venture | Sysdom.ai</title>")
    .replace("</head>", '<link rel="canonical" href="https://app.sysdom.ai/venture-review"/><meta name="description" content="Bring your venture decision and evidence. Check what you share before requesting a private Venture Review."/>' +
      (requestPath.includes("?") ? '<meta name="robots" content="noindex,nofollow"/>' : "") + "</head>");
}
