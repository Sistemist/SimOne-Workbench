import type {
  CreateEarlyAccessGrant,
  CreateEarlyAccessRequest,
  ScannerSnapshot,
} from "@paperclipai/shared";
import { api } from "./client";

export type EarlyAccessGrant = {
  id: string;
  requestId: string | null;
  founderName: string;
  email: string;
  source: string | null;
  maxVentures: number;
  expiresAt: string;
  activatedAt: string | null;
  revokedAt: string | null;
  status: "ready" | "expired" | "activated" | "revoked";
};

export type EarlyAccessRequestRecord = {
  id: string;
  requestKey: string;
  founderName: string;
  email: string;
  useCase: string | null;
  source: string | null;
  status: "pending" | "invited" | "activated" | "closed";
  createdAt: string;
};

export type ScannerRunRecord = {
  id: string;
  ownerUserId: string | null;
  companyId: string | null;
  algorithmVersion: string;
  inputPayload: { startupUrl: string; founderNote: string };
  resultPayload: Record<string, unknown>;
  clientSavedAt: string;
  claimedAt: string | null;
  assignedAt: string | null;
};

type GrantCreationResponse = {
  grant: EarlyAccessGrant;
  token: string;
};

export const earlyAccessApi = {
  requestAccess: (input: CreateEarlyAccessRequest) =>
    api.post<{
      accepted: true;
      id: string;
      status: string;
      scanRetained: boolean;
    }>("/public/early-access/requests", input),
  getActivation: (token: string) =>
    api.get<EarlyAccessGrant>(`/public/early-access/activate/${encodeURIComponent(token)}`),
  activate: (token: string) =>
    api.post<EarlyAccessGrant & { activatedByUserId: string }>(
      `/early-access/activate/${encodeURIComponent(token)}`,
      {},
    ),
  getMine: () =>
    api.get<{
      grant: (EarlyAccessGrant & {
        ownedVentures: number;
        remainingVentures: number;
      }) | null;
      scans: ScannerRunRecord[];
    }>("/early-access/me"),
  getAdminState: () =>
    api.get<{ requests: EarlyAccessRequestRecord[]; grants: EarlyAccessGrant[] }>(
      "/early-access/admin",
    ),
  createGrant: (input: CreateEarlyAccessGrant) =>
    api.post<GrantCreationResponse>("/early-access/admin/grants", input),
  approveRequest: (
    requestId: string,
    input: Pick<CreateEarlyAccessGrant, "source" | "maxVentures" | "expiresInHours">,
  ) =>
    api.post<GrantCreationResponse>(
      `/early-access/admin/requests/${encodeURIComponent(requestId)}/approve`,
      input,
    ),
  claimScan: (scan: ScannerSnapshot) =>
    api.post(`/early-access/scans/claim`, scan),
  assignScan: (scanId: string, companyId: string) =>
    api.post(`/early-access/scans/${encodeURIComponent(scanId)}/assign`, { companyId }),
};
