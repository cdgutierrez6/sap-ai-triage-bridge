import OpenAI from 'openai';
import type { SapPurchaseRequisition } from '@sap-triage/shared';
import { aiTriageOutputSchema } from '@sap-triage/shared';
import type { AIProvider, AIProviderResult } from './AIProvider.interface';
import { AppError } from '../../../infrastructure/http/middleware/error.middleware';
import { env } from '../../../config/env';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly model = 'gpt-4o';

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async analyze(requisition: SapPurchaseRequisition): Promise<AIProviderResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an SAP MM procurement analyst. Return ONLY a valid JSON triage assessment.' },
        {
          role: 'user',
          content: `Analyze this SAP Purchase Requisition: ${JSON.stringify(requisition, null, 2)}\n\nReturn JSON with: riskScore (0-100 int), spendCategory, budgetType (CAPEX/OPEX/UNKNOWN), anomalies array, aiSummary, recommendations array.`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (!content) {
      throw new AppError('AI_PROVIDER_ERROR', 'OpenAI returned empty response', 502);
    }

    const parsed = JSON.parse(content) as unknown;
    const validated = aiTriageOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new AppError('AI_PROVIDER_ERROR', 'OpenAI response did not match triage schema', 502);
    }

    return {
      output: validated.data,
      model: this.model,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  }
}
