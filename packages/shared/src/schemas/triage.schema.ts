import { z } from 'zod';

export const anomalySchema = z.object({
  type: z.enum([
    'PRICE_OUTLIER',
    'QUANTITY_SPIKE',
    'MISSING_DELIVERY_DATE',
    'UNKNOWN_MATERIAL_GROUP',
    'DUPLICATE_MATERIAL',
    'RUSH_DELIVERY',
    'HIGH_VALUE_SINGLE_VENDOR',
    'MISSING_SUPPLIER',
  ]),
  field: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
});

export const aiTriageOutputSchema = z.object({
  riskScore: z.number().int().min(0).max(100),
  spendCategory: z.string().min(1).max(50),
  budgetType: z.enum(['CAPEX', 'OPEX', 'UNKNOWN']),
  anomalies: z.array(anomalySchema),
  aiSummary: z.string().min(10),
  recommendations: z.array(z.string()).min(1).max(10),
});

export type AiTriageOutput = z.infer<typeof aiTriageOutputSchema>;
