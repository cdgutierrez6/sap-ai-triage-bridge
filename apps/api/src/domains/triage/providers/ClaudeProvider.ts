import Anthropic from '@anthropic-ai/sdk';
import type { SapPurchaseRequisition } from '@sap-triage/shared';
import { aiTriageOutputSchema } from '@sap-triage/shared';
import type { AIProvider, AIProviderResult } from './AIProvider.interface';
import { AppError } from '../../../infrastructure/http/middleware/error.middleware';
import { env } from '../../../config/env';

const SYSTEM_PROMPT = `You are an expert SAP MM (Materials Management) procurement analyst with 15+ years of experience reviewing Purchase Requisitions in S/4HANA environments.

Your task is to analyze a Purchase Requisition (PR) from SAP MM and return a JSON triage assessment.

FIELD KNOWLEDGE:
- PurchaseRequisitionType: NB=Standard, UB=Stock Transfer, FO=Framework Order
- ProcessingStatus: 01=In Process, 02=Released, N1=Ordered, N5=Closed
- AccountAssignmentCategory: K=Cost Center, P=Project/WBS, F=Internal Order, blank=stock
- PurchReqnItemCategory: 0=Standard material, 9=Service (no material number)
- MaterialGroup (MATKL) codes: EDP=IT equipment, RAW=Raw materials, SERV=Services, MRO=Maintenance, PPE=Safety, OFF=Office, SOFT=Software, FIN=Finished goods, MKT=Marketing
- DeliveryDate: flag rush if < 7 days from today (2026-05-27)
- Prices are per unit. Calculate total = quantity × price

ANOMALY DETECTION RULES:
- PRICE_OUTLIER: unit price > 3× typical for the material group, or suspiciously round numbers for services
- QUANTITY_SPIKE: quantity > 10× typical order for the material category
- MISSING_DELIVERY_DATE: DeliveryDate is null
- UNKNOWN_MATERIAL_GROUP: MaterialGroup is null or unrecognized
- DUPLICATE_MATERIAL: same Material appears in multiple items
- RUSH_DELIVERY: DeliveryDate within 7 days of today
- HIGH_VALUE_SINGLE_VENDOR: single item > $10,000 USD equivalent with only one supplier
- MISSING_SUPPLIER: no Supplier set and PR is not a stock transfer (UB type)

RISK SCORING (0-100):
- Start at 0
- Each CRITICAL anomaly: +25 points
- Each HIGH anomaly: +15 points
- Each MEDIUM anomaly: +8 points
- Each LOW anomaly: +3 points
- Total PR value > $50,000: +10 points
- Service items (PurchReqnItemCategory=9) with no supplier: +10 points
- Cap at 100

SPEND CATEGORIES: IT Hardware, IT Software, Raw Materials, Services (Professional), Services (Maintenance), Office Supplies, Safety Equipment, Marketing, Manufacturing Supplies, Other

BUDGET TYPE: CAPEX if equipment/software with multi-year value; OPEX if consumables/services/maintenance

OUTPUT FORMAT — return ONLY valid JSON matching this exact structure:
{
  "riskScore": <integer 0-100>,
  "spendCategory": "<category string>",
  "budgetType": "CAPEX" | "OPEX" | "UNKNOWN",
  "anomalies": [
    {
      "type": "<AnomalyType>",
      "field": "<SAP field name>",
      "description": "<specific description with numbers>",
      "severity": "low" | "medium" | "high"
    }
  ],
  "aiSummary": "<2-3 sentences of plain prose explaining the main risk and recommendation>",
  "recommendations": ["<action 1>", "<action 2>", ...]
}`;

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;
  private readonly model = 'claude-sonnet-4-6';

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async analyze(requisition: SapPurchaseRequisition): Promise<AIProviderResult> {
    const userPrompt = this.buildUserPrompt(requisition);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new AppError('AI_PROVIDER_ERROR', 'Unexpected response type from Claude', 502);
    }

    const parsed = this.parseJsonOutput(content.text);
    const validated = aiTriageOutputSchema.safeParse(parsed);

    if (!validated.success) {
      const retryResponse = await this.retryWithCorrection(userPrompt, content.text, validated.error.message);
      return {
        output: retryResponse,
        model: this.model,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
      };
    }

    return {
      output: validated.data,
      model: this.model,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    };
  }

  private buildUserPrompt(requisition: SapPurchaseRequisition): string {
    return `Analyze this SAP Purchase Requisition and return the JSON triage assessment:

${JSON.stringify(requisition, null, 2)}

Today's date: 2026-05-27. Return ONLY the JSON object, no markdown, no explanation.`;
  }

  private parseJsonOutput(text: string): unknown {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new AppError('AI_PROVIDER_ERROR', 'Could not parse JSON from AI response', 502);
    }
  }

  private async retryWithCorrection(
    originalPrompt: string,
    badOutput: string,
    validationError: string,
  ): Promise<import('@sap-triage/shared').AiTriageOutput> {
    const correctionPrompt = `Your previous response failed JSON schema validation: ${validationError}

Previous response: ${badOutput}

Return ONLY the corrected JSON object. No markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: originalPrompt },
        { role: 'user', content: correctionPrompt },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new AppError('AI_PROVIDER_ERROR', 'AI provider returned invalid response after retry', 502);
    }

    const parsed = this.parseJsonOutput(content.text);
    const validated = aiTriageOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new AppError('AI_PROVIDER_ERROR', 'AI provider returned invalid triage schema after retry', 502);
    }
    return validated.data;
  }
}
