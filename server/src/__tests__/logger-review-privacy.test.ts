import { describe, expect, it, vi } from "vitest";
vi.mock("node:fs", () => ({ default: { mkdirSync: vi.fn() } }));
vi.mock("../config-file.js", () => ({ readConfigFile: () => null }));
vi.mock("../home-paths.js", () => ({ resolveDefaultLogsDir: () => "/unused-test-log", resolveHomeAwarePath: (path: string) => path }));
vi.mock("pino", () => ({ default: Object.assign(vi.fn(() => ({})), { transport: vi.fn() }) }));
vi.mock("pino-http", () => ({ pinoHttp: (options: unknown) => options }));
import { httpLogger } from "../middleware/logger.js";

describe("review logging privacy", () => {
  it.each(["/api/companies/id/venture-reviews/id/submit", "/api/public/venture-review/sessions/id/run", "/api/public/early-access/requests", "/api/public/funnel-events"])("omits private content from failed requests to %s", (url) => {
    const config = httpLogger as unknown as {
      serializers: { req: (request: unknown) => unknown };
      customProps: (request: unknown, response: unknown) => unknown;
      customErrorMessage: (request: unknown, response: unknown, error: unknown) => unknown;
      customSuccessMessage: (request: unknown, response: unknown) => unknown;
    };
    const request = { method: "POST", url: url + "?secret=fictional-secret", body: { excerpt: "private fictional evidence" }, headers: { cookie: "fictional-secret" } };
    const response = { statusCode: 500, __errorContext: { error: { message: "fictional-secret" }, reqBody: request.body } };
    const output = JSON.stringify([
      config.serializers.req(request), config.customProps(request, response),
      config.customErrorMessage(request, response, new Error("fictional-secret")), config.customSuccessMessage(request, response),
    ]);
    expect(output).not.toContain("fictional-secret");
    expect(output).not.toContain("private fictional evidence");
    expect(output).toContain("omitted");
  });
});
