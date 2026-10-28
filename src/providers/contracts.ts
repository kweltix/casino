import type {
  Company,
  Source,
  AnalysisResult,
  UsageRecord,
  ImageArtifact,
} from "../domain/types";
import type { CompanyInput, RunInput } from "../domain/validation";
export type ProviderEnv = Record<string, string | undefined>;
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type WebsiteEvidence = {
  status: "found" | "not_found" | "unknown";
  website?: string;
  explanation: string;
  sources: Source[];
  usage?: UsageRecord[];
};
export type AnalysisInput = { company: Company; website: WebsiteEvidence };
export type ConceptInput = { company: Company };
export type Providers = {
  search: {
    discover(
      input: RunInput,
    ): Promise<{ companies: CompanyInput[]; usage: UsageRecord[] }>;
    verifyWebsite(company: Company): Promise<WebsiteEvidence>;
  };
  analysis: {
    analyze(
      input: AnalysisInput,
    ): Promise<{ analysis: AnalysisResult; usage: UsageRecord[] }>;
  };
  images: {
    generate(
      input: ConceptInput,
    ): Promise<{ image: ImageArtifact; usage: UsageRecord[] }>;
  };
};
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly blocked = false,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
