import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('3001'),
    API_KEY: z.string().min(32, 'API_KEY must be at least 32 characters'),
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.string().url().optional(),
    SAP_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
    AI_PROVIDER: z.enum(['claude', 'openai']).default('claude'),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    N8N_WEBHOOK_SECRET: z.string().min(16).optional(),
    SAP_BTP_BASE_URL: z.string().url().optional(),
    SAP_BTP_CLIENT_ID: z.string().optional(),
    SAP_BTP_CLIENT_SECRET: z.string().optional(),
    SAP_BTP_TOKEN_URL: z.string().url().optional(),
  })
  .refine(
    (data) => {
      if (data.AI_PROVIDER === 'claude' && !data.ANTHROPIC_API_KEY) return false;
      return true;
    },
    { message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER=claude' },
  )
  .refine(
    (data) => {
      if (data.SAP_MODE === 'live') {
        return !!(data.SAP_BTP_BASE_URL && data.SAP_BTP_CLIENT_ID && data.SAP_BTP_CLIENT_SECRET && data.SAP_BTP_TOKEN_URL);
      }
      return true;
    },
    { message: 'SAP_BTP_BASE_URL, SAP_BTP_CLIENT_ID, SAP_BTP_CLIENT_SECRET, SAP_BTP_TOKEN_URL are required when SAP_MODE=live' },
  );

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
