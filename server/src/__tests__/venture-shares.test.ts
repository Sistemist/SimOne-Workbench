import { describe, expect, it } from "vitest";
import type { CompanyPortabilityExportResult } from "@paperclipai/shared";
import { buildVentureShareSnapshot } from "../services/venture-shares.js";

function sampleExport(): CompanyPortabilityExportResult {
  return {
    rootPath: "simone-test",
    paperclipExtensionPath: ".paperclip.yaml",
    warnings: [],
    files: {
      "README.md": "# Private export",
      ".paperclip.yaml": "contains internal setup",
    },
    manifest: {
      schemaVersion: 1,
      generatedAt: "2026-07-07T20:00:00.000Z",
      source: {
        companyId: "11111111-1111-4111-8111-111111111111",
        companyName: "Acme Systems",
      },
      includes: {
        company: true,
        agents: true,
        projects: true,
        issues: true,
        skills: true,
      },
      company: {
        path: "COMPANY.md",
        name: "Acme Systems",
        description: "Turns messy customer work into one calm review loop.",
        brandColor: "#18a999",
        logoPath: "images/logo.png",
        attachmentMaxBytes: 10485760,
        requireBoardApprovalForNewAgents: true,
        feedbackDataSharingEnabled: false,
        feedbackDataSharingConsentAt: null,
        feedbackDataSharingConsentByUserId: null,
        feedbackDataSharingTermsVersion: null,
      },
      sidebar: {
        agents: ["ceo", "customer-lead"],
        projects: ["customer-engine"],
      },
      agents: [
        {
          slug: "ceo",
          name: "Thomasina",
          path: "agents/ceo.md",
          skills: ["strategy"],
          role: "ceo",
          title: "Founder",
          icon: "Crown",
          capabilities: "Decides what matters.",
          reportsToSlug: null,
          reportsToExistingAgentId: null,
          reportsToExistingAgentSlug: null,
          adapterType: "claude",
          adapterConfig: { apiKey: "do-not-share", model: "secret-provider-choice" },
          runtimeConfig: { cwd: "/private/workspace" },
          permissions: { secrets: ["never-public"] },
          budgetMonthlyCents: 10000,
          metadata: { provider: "hidden" },
        },
      ],
      skills: [
        {
          key: "strategy",
          slug: "strategy",
          name: "Strategy",
          path: "skills/strategy/SKILL.md",
          description: "Private skill details",
          sourceType: "workspace",
          sourceLocator: "/private/skills",
          sourceRef: null,
          trustLevel: "trusted",
          compatibility: "compatible",
          metadata: { private: true },
          fileInventory: [{ path: "SKILL.md", kind: "skill" }],
        },
      ],
      projects: [
        {
          slug: "customer-engine",
          name: "Customer Engine",
          path: "projects/customer-engine.md",
          description: "Keep relationship signal moving.",
          ownerAgentSlug: "ceo",
          leadAgentSlug: "ceo",
          targetDate: null,
          color: "#18a999",
          icon: "Users",
          status: "active",
          env: { OPENAI_API_KEY: { type: "secret", secretId: "secret-1" } },
          executionWorkspacePolicy: { defaultMode: "shared_workspace" },
          workspaces: [],
          metadata: { repo: "private" },
        },
      ],
      issues: [
        {
          slug: "review-replies",
          identifier: "SYS-1",
          title: "Review customer replies",
          path: "issues/review-replies.md",
          projectSlug: "customer-engine",
          projectWorkspaceKey: null,
          assigneeAgentSlug: "ceo",
          description: "Approve the next customer move.",
          recurring: false,
          routine: null,
          legacyRecurrence: null,
          status: "open",
          priority: "high",
          labelIds: [],
          billingCode: null,
          executionWorkspaceSettings: { internal: true },
          assigneeAdapterOverrides: { model: "hidden" },
          comments: [],
          metadata: { private: true },
        },
      ],
      envInputs: [
        {
          key: "OPENAI_API_KEY",
          description: null,
          agentSlug: "ceo",
          projectSlug: null,
          kind: "secret",
          requirement: "required",
          defaultValue: null,
          portability: "portable",
        },
      ],
    },
  };
}

describe("venture share snapshots", () => {
  it("turns a company portability export into a public-safe venture map", () => {
    const snapshot = buildVentureShareSnapshot(sampleExport(), {
      shareId: "share-1",
      createdAt: "2026-07-07T21:00:00.000Z",
    });

    expect(snapshot.company.name).toBe("Acme Systems");
    expect(snapshot.company.description).toContain("customer work");
    expect(snapshot.agents).toEqual([
      {
        name: "Thomasina",
        title: "Founder",
        role: "CEO",
        capabilities: "Decides what matters.",
      },
    ]);
    expect(snapshot.projects[0]).toMatchObject({
      name: "Customer Engine",
      description: "Keep relationship signal moving.",
      status: "active",
    });
    expect(snapshot.nextMoves[0]).toMatchObject({
      title: "Review customer replies",
      priority: "high",
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /apiKey|api key|adapterConfig|runtimeConfig|permissions|envInputs|OPENAI_API_KEY|secret-provider-choice|private\/workspace|model|provider|runtime/i,
    );
  });
});
