import type { z } from "zod";
import type { sourceSchema } from "./validation";
export type Source = z.infer<typeof sourceSchema>;
export type ContactStatus = "new" | "reviewed" | "rejected" | "contacted";
export type WebsiteStatus = "unknown" | "not_found" | "found";
export type Observation = { text: string; sourceIds: string[] };
export type AnalysisResult = {
  observations: Observation[];
  uncertainties: string[];
  competitorSourceIds: string[];
  draftMessage: string;
  suitability: "high" | "medium" | "low";
};
export type ImageArtifact = {
  fileName: string;
  mime: "image/png" | "image/jpeg";
  createdAt: string;
  prompt: string;
};
export type Company = {
  id: string;
  sourceId?: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  websiteStatus: WebsiteStatus;
  websiteCheckedAt?: string;
  websiteExplanation?: string;
  sources: Source[];
  origin: "manual" | "search" | "test";
  version: number;
  contactStatus: ContactStatus;
  draftMessage: string;
  analysis?: AnalysisResult;
  image?: ImageArtifact;
  createdAt: string;
  updatedAt: string;
};
export type JobKind = "discover" | "analyze" | "image";
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "cancelled";
export type Job = {
  id: string;
  runId: string;
  kind: JobKind;
  payload: { companyId?: string };
  status: JobStatus;
  attempts: number;
  leaseUntil: number | null;
  leaseOwner: string | null;
  availableAt: number;
  error: string | null;
  createdAt: string;
};
export type Run = {
  id: string;
  city: "Екатеринбург";
  niche: "автосервисы";
  limit: number;
  cancelled: boolean;
  createdAt: string;
  jobs: Job[];
};
export type UsageRecord = {
  provider: string;
  operation: string;
  units: number | null;
  cost: number | null;
  currency: string;
  costStatus: "confirmed" | "estimated" | "unknown";
};
export type Usage = UsageRecord & {
  id: string;
  runId: string;
  createdAt: string;
};
export type ProviderStatus = {
  name: string;
  available: boolean;
  reason: string;
};
