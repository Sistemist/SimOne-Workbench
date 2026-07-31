import type {
  CreateGovernedIntakeAssessment,
  GovernedIntakeAssessment,
} from "@paperclipai/shared";
import { api } from "./client";

export const governedIntakeApi = {
  list: () => api.get<GovernedIntakeAssessment[]>("/governed-intake/assessments"),
  create: (input: CreateGovernedIntakeAssessment) =>
    api.post<GovernedIntakeAssessment>("/governed-intake/assessments", input),
};
