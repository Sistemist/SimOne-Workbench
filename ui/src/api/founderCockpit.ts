import type {
  CreateVentureConstitutionRevision,
  CreateVentureContextProjection,
  CreateVentureStateRevision,
  FounderCockpitSnapshot,
  CommitSimCycleLeverage,
  CompleteSimCycleCompound,
  DecideSimCycleDiagnosis,
  PauseSimCycle,
  SimCycle,
  SimCycleEvent,
  StartSimCycle,
  SubmitSimCycleMap,
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
  startCycle: (companyId: string, data: StartSimCycle) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles`, data),
  submitCycleMap: (companyId: string, cycleId: string, data: SubmitSimCycleMap) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/map`, data),
  decideCycleDiagnosis: (
    companyId: string,
    cycleId: string,
    data: DecideSimCycleDiagnosis,
  ) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/diagnose`, data),
  commitCycleLeverage: (
    companyId: string,
    cycleId: string,
    data: CommitSimCycleLeverage,
  ) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/leverage`, data),
  completeCycleCompound: (
    companyId: string,
    cycleId: string,
    data: CompleteSimCycleCompound,
  ) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/compound`, data),
  pauseCycle: (companyId: string, cycleId: string, data: PauseSimCycle) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/pause`, data),
  resumeCycle: (companyId: string, cycleId: string) =>
    api.post<SimCycle>(`/companies/${companyId}/sim-cycles/${cycleId}/resume`, {}),
  cycleEvents: (companyId: string, cycleId: string) =>
    api.get<SimCycleEvent[]>(`/companies/${companyId}/sim-cycles/${cycleId}/events`),
};
