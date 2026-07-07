import type { VentureShareRecord } from "@paperclipai/shared";
import { api } from "./client";

export const ventureSharesApi = {
  get: (shareId: string) => api.get<VentureShareRecord>(`/venture-shares/${shareId}`),
};
