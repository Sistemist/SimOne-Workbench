import type {
  CreateVentureConstitutionRevision,
  CreateVentureContextProjection,
  CreateVentureStateRevision,
  FounderCockpitSnapshot,
  VentureConstitutionRevision,
  VentureContextProjection,
  VentureStateRevision,
} from "@paperclipai/shared";
import { api } from "./client";

export const founderCockpitApi = {
  get: (companyId: string) =>
    api.get<FounderCockpitSnapshot>(`/companies/${companyId}/founder-cockpit`),
  constitutionRevisions: (companyId: string) =>
    api.get<VentureConstitutionRevision[]>(
      `/companies/${companyId}/venture-constitution/revisions`,
    ),
  createConstitutionRevision: (
    companyId: string,
    data: CreateVentureConstitutionRevision,
  ) =>
    api.post<VentureConstitutionRevision>(
      `/companies/${companyId}/venture-constitution/revisions`,
      data,
    ),
  activateConstitutionRevision: (
    companyId: string,
    revisionId: string,
    approvalNote: string,
  ) =>
    api.post<VentureConstitutionRevision>(
      `/companies/${companyId}/venture-constitution/revisions/${revisionId}/activate`,
      { approvalNote },
    ),
  restoreConstitutionRevision: (
    companyId: string,
    revisionId: string,
    changeReason: string,
  ) =>
    api.post<VentureConstitutionRevision>(
      `/companies/${companyId}/venture-constitution/revisions/${revisionId}/restore`,
      { changeReason },
    ),
  stateRevisions: (companyId: string) =>
    api.get<VentureStateRevision[]>(`/companies/${companyId}/venture-state/revisions`),
  createStateRevision: (companyId: string, data: CreateVentureStateRevision) =>
    api.post<VentureStateRevision>(`/companies/${companyId}/venture-state/revisions`, data),
  contextProjections: (companyId: string) =>
    api.get<VentureContextProjection[]>(`/companies/${companyId}/context-projections`),
  createContextProjection: (
    companyId: string,
    data: CreateVentureContextProjection,
  ) =>
    api.post<VentureContextProjection>(`/companies/${companyId}/context-projections`, data),
};
