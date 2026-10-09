import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { JSDOM, VirtualConsole } from "jsdom";
import { abortable } from "./venture-review.js";

// Conservative public-unicast policy. Reject mapped/transition IPv6 outright.
export function isPublicWebsiteAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number) as [number, number, number, number];
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [first, second] = normalized.split(":").map((part) => parseInt(part || "0", 16));
  return first! >= 0x2000 && first! <= 0x3fff && first !== 0x2002 &&
    !(first === 0x2001 && (second! <= 0x1ff || second === 0xdb8)) && first !== 0x3fff;
}

export function validatePublicWebsiteUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      url.search || hostname.endsWith(".") || (!isIP(hostname) && !hostname.includes(".")) ||
      /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(hostname) ||
      (isIP(hostname) && !isPublicWebsiteAddress(hostname))) {
    throw new Error("Website URL is outside the permitted public HTTP scope");
  }
  url.hash = "";
  return url;
}

export interface WebsiteInspectionPolicy {
  // Exact scope includes redirect destinations; no automatic link crawling.
  allowedUrls: string[];
  maxPages: number;
  maxBytesPerPage: number;
  maxCharsPerPage: number;
  maxRedirects: number;
  timeoutMs: number;
}
export interface WebsiteTarget { url: URL; address: string }
export interface WebsiteResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Uint8Array;
}
export interface WebsiteNetwork {
  lookup(hostname: string): Promise<Array<{ address: string }>>;
  request(target: WebsiteTarget, maxBytes: number, signal: AbortSignal): Promise<WebsiteResponse>;
}

/** Reuses invite resolution's direct-IP/Host/SNI pattern: no second DNS lookup,
 * proxy env, cookies, credentials, automatic redirects or retries. */
export const publicWebsiteNetwork: WebsiteNetwork = {
  lookup: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  request: (target, maxBytes, signal) => new Promise((resolve, reject) => {
    const { url, address } = target;
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request({
      protocol: url.protocol, hostname: address, port: url.port || undefined,
      servername: isIP(hostname) ? undefined : hostname,
      method: "GET", path: url.pathname, agent: false, signal, maxHeaderSize: 16_384,
      headers: { Host: url.host, Accept: "text/html, text/plain", "Accept-Encoding": "identity", "User-Agent": "SysdomWebsiteReview/1" },
    }, (response) => {
      const status = response.statusCode ?? 0;
      const headers = { location: response.headers.location, "content-type": response.headers["content-type"], "content-encoding": response.headers["content-encoding"] };
      // Do not consume error/redirect bodies, which may contain diagnostics.
      if (status < 200 || status >= 300) {
        resolve({ status, headers, body: new Uint8Array() });
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          const error = new Error("Website byte limit exceeded");
          reject(error); response.destroy(); req.destroy(error); return;
        }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ status, headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  }),
};

export interface WebsiteEvidenceReceipt {
  sourceUrl: string;
  finalUrl: string | null;
  capturedAt: string;
  status: "retrieved" | "partial" | "inaccessible" | "cancelled";
  httpStatus: number | null;
  redirects: Array<{ from: string; to: string; status: number }>;
  title: string;
  text: string;
  bodySha256: string | null;
  excerptSha256: string | null;
  excerptLocation: { kind: "static_text_character_range"; start: number; end: number; total: number } | null;
  omissions: string[];
  untrustedContent: true;
}

export async function inspectPermittedWebsite(
  requestedUrls: string[], policy: WebsiteInspectionPolicy, signal?: AbortSignal,
  network: WebsiteNetwork = publicWebsiteNetwork,
): Promise<WebsiteEvidenceReceipt[]> {
  for (const key of ["maxPages", "maxBytesPerPage", "maxCharsPerPage", "maxRedirects", "timeoutMs"] as const) {
    const value = policy[key];
    if (!Number.isSafeInteger(value) || (key === "maxRedirects" ? value < 0 : value < 1)) throw new Error("Website inspection requires explicit resource limits");
  }
  if (!requestedUrls.length || requestedUrls.length > policy.maxPages || new Set(requestedUrls).size !== requestedUrls.length) throw new Error("Website page scope exceeds approved limit");
  const allowed = new Set(policy.allowedUrls.map((url) => validatePublicWebsiteUrl(url).href));
  const urls = requestedUrls.map((url) => validatePublicWebsiteUrl(url));
  if (urls.some((url) => !allowed.has(url.href))) throw new Error("Website page was not approved");
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException("Cancelled", "AbortError"));
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), policy.timeoutMs);
  try {
    const receipts: WebsiteEvidenceReceipt[] = [];
    for (const source of urls) {
      const receipt: WebsiteEvidenceReceipt = {
        sourceUrl: source.href, finalUrl: null, capturedAt: new Date().toISOString(), status: "inaccessible",
        httpStatus: null, redirects: [], title: "", text: "", bodySha256: null,
        excerptSha256: null, excerptLocation: null, omissions: [], untrustedContent: true,
      };
      try {
        let url = source;
        const visited = new Set<string>();
        while (true) {
          controller.signal.throwIfAborted();
          if (visited.has(url.href)) throw new Error("Redirect loop");
          visited.add(url.href);
          const hostname = url.hostname.replace(/^\[|\]$/g, "");
          const addresses = isIP(hostname) ? [{ address: hostname }] : await abortable(network.lookup(hostname), controller.signal);
          controller.signal.throwIfAborted();
          if (!addresses.length || addresses.some(({ address }) => !isPublicWebsiteAddress(address))) throw new Error("Unsafe DNS resolution");
          const response = await abortable(network.request({ url, address: addresses[0]!.address }, policy.maxBytesPerPage, controller.signal), controller.signal);
          controller.signal.throwIfAborted();
          receipt.finalUrl = url.href;
          receipt.httpStatus = response.status;
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (!response.headers.location || receipt.redirects.length >= policy.maxRedirects) throw new Error("Redirect limit");
            const next = validatePublicWebsiteUrl(new URL(response.headers.location, url).href);
            if (!allowed.has(next.href) || (url.protocol === "https:" && next.protocol !== "https:")) throw new Error("Redirect outside consent");
            receipt.redirects.push({ from: url.href, to: next.href, status: response.status });
            url = next;
            continue;
          }
          if (response.status < 200 || response.status >= 300) throw new Error("Unsuccessful status");
          if (response.body.byteLength > policy.maxBytesPerPage) throw new Error("Byte limit");
          const type = response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
          if (!["text/html", "text/plain"].includes(type ?? "") || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) throw new Error("Unsupported content");
          const raw = new TextDecoder("utf-8", { fatal: true }).decode(response.body);
          let text = raw;
          if (type === "text/html") {
            // No script execution or subresource loading; never render page HTML.
            const dom = new JSDOM(raw, { virtualConsole: new VirtualConsole() });
            try {
              dom.window.document.querySelectorAll("script,style,noscript,template,iframe,object,svg,[hidden],[aria-hidden='true']").forEach((element) => element.remove());
              receipt.title = dom.window.document.title.slice(0, 300);
              // Preserve block/cell boundaries before whitespace normalization;
              // textContent alone can turn adjacent counts into a different number.
              dom.window.document.querySelectorAll("p,div,section,article,header,footer,h1,h2,h3,h4,h5,h6,li,br,tr,td,th").forEach((element) => { element.prepend(" "); element.append(" "); });
              text = dom.window.document.body.textContent ?? "";
            } finally { dom.window.close(); }
          }
          text = text.replace(/\s+/g, " ").trim();
          receipt.text = text.slice(0, policy.maxCharsPerPage);
          receipt.bodySha256 = createHash("sha256").update(response.body).digest("hex");
          receipt.excerptSha256 = createHash("sha256").update(receipt.text).digest("hex");
          receipt.excerptLocation = { kind: "static_text_character_range", start: 0, end: receipt.text.length, total: text.length };
          receipt.status = response.status === 206 || text.length > receipt.text.length || !text.length ? "partial" : "retrieved";
          receipt.omissions.push("Static text only; scripts, images, linked files, login-only and unapproved pages were not inspected.");
          if (text.length > receipt.text.length) receipt.omissions.push(`${text.length - receipt.text.length} characters omitted at the disclosed excerpt limit.`);
          if (!text.length) receipt.omissions.push("No readable static text was available.");
          if (response.status === 206) receipt.omissions.push("The server returned partial content; the full page was not inspected.");
          break;
        }
      } catch {
        receipt.title = ""; receipt.text = ""; receipt.bodySha256 = null;
        receipt.excerptSha256 = null; receipt.excerptLocation = null;
        receipt.status = controller.signal.aborted && controller.signal.reason?.name === "AbortError" ? "cancelled" : "inaccessible";
        receipt.omissions.push(controller.signal.aborted ? "Inspection cancelled or timed out; no page content retained." : "Page inaccessible or outside permitted scope/content/resource limits; no page content retained.");
      }
      receipts.push(receipt);
    }
    return receipts;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export interface WebsiteFixturePage {
  url: string;
  title: string;
  text: string;
}

export function retrieveWebsiteFixture(rawUrl: string, fixtures: Record<string, WebsiteFixturePage>) {
  const url = validatePublicWebsiteUrl(rawUrl);
  const page = fixtures[url.toString()];
  if (!page) return { status: "inaccessible" as const, url: url.toString(), reason: "No fixture was provided for this page." };
  return {
    status: "retrieved" as const,
    url: url.toString(),
    title: page.title,
    text: page.text.slice(0, 20_000),
    truncated: page.text.length > 20_000,
    untrustedContent: true as const,
  };
}
