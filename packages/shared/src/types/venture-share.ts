export interface VentureShareCompany {
  name: string;
  description: string | null;
  brandColor: string | null;
}

export interface VentureShareAgent {
  name: string;
  title: string | null;
  role: string;
  capabilities: string | null;
}

export interface VentureShareProject {
  name: string;
  description: string | null;
  status: string | null;
}

export interface VentureShareNextMove {
  title: string;
  priority: string | null;
  status: string | null;
  projectName: string | null;
}

export interface VentureShareReviewPackage {
  headline: string;
  proofStatus: string;
  reviewBoundary: string;
  suggestedQuestion: string;
}

export interface VentureShareSnapshot {
  schemaVersion: 1;
  shareId: string;
  generatedAt: string;
  company: VentureShareCompany;
  agents: VentureShareAgent[];
  projects: VentureShareProject[];
  nextMoves: VentureShareNextMove[];
  reviewPackage?: VentureShareReviewPackage;
  principles: string[];
}

export interface VentureShareRecord {
  id: string;
  companyId: string;
  snapshot: VentureShareSnapshot;
  createdAt: string;
}

export interface CreateVentureShareResponse {
  shareId: string;
  shareUrl: string;
  snapshot: VentureShareSnapshot;
}
