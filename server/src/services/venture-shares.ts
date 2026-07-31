import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { companyVentureShares, type Db } from "@paperclipai/db";
import {
  ventureShareSnapshotSchema,
  type CreateVentureShareResponse,
  CompanyPortabilityExportResult,
  type VentureShareRecord,
  VentureShareAgent,
  VentureShareNextMove,
  VentureShareProject,
  VentureShareSnapshot,
} from "@paperclipai/shared";
import { companyPortabilityService } from "./company-portability.js";

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  cto: "CTO",
  cmo: "CMO",
  cfo: "CFO",
  coo: "COO",
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function roleLabel(role: string) {
  const normalized = role.trim().toLowerCase();
  return ROLE_LABELS[normalized] ?? role.trim();
}

export function buildVentureShareSnapshot(
  exported: CompanyPortabilityExportResult,
  opts: { shareId: string; createdAt?: string },
): VentureShareSnapshot {
  const manifest = exported.manifest;
  const companyName = manifest.company?.name ?? manifest.source?.companyName ?? "Sysdom AI venture";
  const projectsBySlug = new Map(manifest.projects.map((project) => [project.slug, project]));

  const agents: VentureShareAgent[] = manifest.agents.slice(0, 8).map((agent) => ({
    name: agent.name,
    title: agent.title,
    role: roleLabel(agent.role),
    capabilities: agent.capabilities,
  }));

  const projects: VentureShareProject[] = manifest.projects.slice(0, 8).map((project) => ({
    name: project.name,
    description: project.description,
    status: project.status,
  }));

  const nextMoves: VentureShareNextMove[] = manifest.issues.slice(0, 10).map((issue) => ({
    title: issue.title,
    priority: issue.priority,
    status: issue.status,
    projectName: issue.projectSlug ? projectsBySlug.get(issue.projectSlug)?.name ?? null : null,
  }));
  const firstNextMove = nextMoves[0] ?? null;
  const firstWorkStream = firstNextMove?.projectName ?? projects[0]?.name ?? "the first work stream";

  return {
    schemaVersion: 1,
    shareId: opts.shareId,
    generatedAt: opts.createdAt ?? new Date().toISOString(),
    company: {
      name: companyName,
      description: manifest.company?.description ?? null,
      brandColor: manifest.company?.brandColor ?? null,
    },
    agents,
    projects,
    nextMoves,
    reviewPackage: {
      headline: `${companyName} is organizing ${countLabel(agents.length, "operating role", "operating roles")} and ${countLabel(projects.length, "work stream", "work streams")} around ${firstWorkStream}.`,
      proofStatus: "Ready for Sprint Zero, not proof of market fit.",
      reviewBoundary: "Review the next move before customers, money, public claims, or structure change.",
      suggestedQuestion: firstNextMove
        ? `Which proof would make ${firstNextMove.title} worth doing next?`
        : "Which proof would make the next move worth doing?",
    },
    principles: [
      "Human judgment stays visible.",
      "Roles are shown as operating responsibilities.",
      "Private setup details and internal files are not included.",
    ],
  };
}

export function ventureShareService(db: Db) {
  const portability = companyPortabilityService(db);

  return {
    createFromCompany: async (
      companyId: string,
      opts: { createdByUserId?: string | null } = {},
    ): Promise<CreateVentureShareResponse> => {
      const shareId = randomUUID();
      const createdAt = new Date().toISOString();
      const exported = await portability.exportBundle(companyId, {
        include: {
          company: true,
          agents: true,
          projects: true,
          issues: true,
          skills: false,
        },
      });
      const snapshot = ventureShareSnapshotSchema.parse(
        buildVentureShareSnapshot(exported, { shareId, createdAt }),
      );

      await db.insert(companyVentureShares).values({
        id: shareId,
        companyId,
        createdByUserId: opts.createdByUserId ?? null,
        snapshot,
      });

      return {
        shareId,
        shareUrl: `/share/venture/${shareId}`,
        snapshot,
      };
    },

    getById: async (shareId: string): Promise<VentureShareRecord | null> => {
      const row = await db
        .select({
          id: companyVentureShares.id,
          companyId: companyVentureShares.companyId,
          snapshot: companyVentureShares.snapshot,
          createdAt: companyVentureShares.createdAt,
        })
        .from(companyVentureShares)
        .where(and(eq(companyVentureShares.id, shareId), isNull(companyVentureShares.revokedAt)))
        .then((rows) => rows[0] ?? null);
      if (!row) return null;

      return {
        id: row.id,
        companyId: row.companyId,
        snapshot: ventureShareSnapshotSchema.parse(row.snapshot),
        createdAt: row.createdAt.toISOString(),
      };
    },
  };
}
