import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/neighborlink?schema=public'),
  JWT_SECRET: z.string().min(16).default('development-only-change-me-please'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development-only-refresh-change-me'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().default(4000),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(10)
});
export const env = schema.parse(process.env);
