import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  WEBHOOK_PATH: z.string().default("/webhook"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  META_VERIFY_TOKEN: z.string().min(1, "META_VERIFY_TOKEN is required"),
  META_APP_SECRET: z.string().default(""),
  META_PAGE_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_TOKEN: z.string().default(""),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  SKIP_META_SIGNATURE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export function assertMetaSendConfigured(channel: "whatsapp" | "messenger" | "instagram"): void {
  if (channel === "whatsapp") {
    if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required to send WhatsApp messages");
    }
    return;
  }
  if (!config.META_PAGE_ACCESS_TOKEN) {
    throw new Error("META_PAGE_ACCESS_TOKEN is required to send Messenger/Instagram messages");
  }
}
