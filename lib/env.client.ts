import { resolveAppUrl } from "@/lib/app-url";
import { clientEnvSchema } from "@/lib/env.schema";

export const clientEnv = clientEnvSchema.parse({
  // Literal process.env reads, so Next inlines them into the browser bundle.
  NEXT_PUBLIC_APP_URL: resolveAppUrl({
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    productionHost: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  }),
});
