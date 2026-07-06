import { describe, expect, it, vi } from "vitest";
import { companiesListQueryOptions } from "./companies-query";
import { ApiError } from "./client";

const mockCompaniesApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("./companies", () => ({
  companiesApi: mockCompaniesApi,
}));

describe("companiesListQueryOptions", () => {
  it("treats 403 company-list responses as unauthenticated", async () => {
    mockCompaniesApi.list.mockRejectedValueOnce(
      new ApiError("Forbidden", 403, { error: "Forbidden" }),
    );

    await expect(companiesListQueryOptions.queryFn()).resolves.toEqual({
      companies: [],
      unauthorized: true,
    });
  });
});
