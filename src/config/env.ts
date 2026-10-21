import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((port) => port > 0 && port < 65536, {
      message: 'PORT must be between 1 and 65535',
    }),
  MONGODB_URI: z
    .string({
      required_error: 'MONGODB_URI is required',
    })
    .url({ message: 'MONGODB_URI must be a valid connection string URL' })
    .default('mongodb://127.0.0.1:27017/smit_assets_db'),
  ALLOWED_ORIGINS: z.string().default('*'),
  JWT_SECRET: z.string().default('development_jwt_secret_change_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type Environment = z.infer<typeof envSchema>;
