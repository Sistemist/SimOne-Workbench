import { createServer, type Server, type RequestListener } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { publicWebsiteNetwork } from "./safe-website-evidence.js";

const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) { server.closeAllConnections(); server.close(); await once(server, "close"); }
});
async function fixture(handler: RequestListener) {
  const server = createServer(handler); servers.push(server); server.listen(0, "127.0.0.1"); await once(server, "listening");
  // Test the lower-level pinned socket adapter only. The public URL validator
  // still forbids this address/port and has no test-only production bypass.
  return { url: new URL(`http://business.example:${(server.address() as AddressInfo).port}/page`), address: "127.0.0.1" };
}
describe("pinned website HTTP adapter, local sockets only", () => {
  it("connects to the pinned address preserving Host and sends no credentials", async () => {
    let headers: Record<string, unknown> = {};
    const target = await fixture((req, res) => { headers = req.headers; res.setHeader("content-type", "text/plain"); res.end("local fixture"); });
    const response = await publicWebsiteNetwork.request(target, 100, new AbortController().signal);
    expect(new TextDecoder().decode(response.body)).toBe("local fixture");
    expect(headers.host).toBe(target.url.host);
    expect(headers.authorization).toBeUndefined(); expect(headers.cookie).toBeUndefined();
    expect(headers["accept-encoding"]).toBe("identity");
  });
  it("enforces streaming byte caps and cancellation without following redirects", async () => {
    const large = await fixture((_req, res) => res.end("x".repeat(500)));
    await expect(publicWebsiteNetwork.request(large, 10, new AbortController().signal)).rejects.toThrow(/byte limit/);
    const redirect = await fixture((_req, res) => { res.writeHead(302, { location: "http://169.254.169.254/" }); res.end("do not retain this body"); });
    const result = await publicWebsiteNetwork.request(redirect, 100, new AbortController().signal);
    expect(result.status).toBe(302); expect(result.body.byteLength).toBe(0);
    const hang = await fixture((_req, _res) => {});
    const controller = new AbortController();
    const pending = publicWebsiteNetwork.request(hang, 100, controller.signal); controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
