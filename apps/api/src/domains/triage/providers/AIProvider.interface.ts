import type { SapPurchaseRequisition } from '@sap-triage/shared';
import type { AiTriageOutput } from '@sap-triage/shared';

export interface AIProviderResult {
  output: AiTriageOutput;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface AIProvider {
  readonly name: string;
  analyze(requisition: SapPurchaseRequisition): Promise<AIProviderResult>;
}
