import { connection } from "next/server";
import { readBody, requireMember, requireWriter } from "@/features/teams/server/http";
import { AiConfigError, loadAiConfig, providerFromInput } from "@/features/why/server/config";
import { explainWith, WhyUnavailableError } from "@/features/why/server/explain";
import { builtinExplanation } from "@/features/why/shared/builtin";
import { aiConfigSchema } from "@/features/why/shared/providers";
import { db } from "@/lib/db";
import { json } from "@/lib/http";

const SAMPLE = {
  command: "npx prisma migrate deploy",
  context: 'ALTER TABLE "invoices" DROP COLUMN "legacy_total";',
  preset: "db-migrate",
  env: "staging",
  repo: "example/billing",
};

const TEST_ERRORS: Record<string, string> = {
  auth: "The provider rejected the API key.",
  rate_limited: "The provider is rate-limiting this key. Try again shortly.",
  bad_request: "The provider rejected the request. Check the model name and base URL.",
  failed: "Couldn't reach the provider. Check the base URL.",
  unsafe_url: "The base URL must be a public https address.",
  key_required: "This provider needs an API key.",
};

// Owner only: runs the unsaved settings against a sample migration before saving them.
export async function POST(request: Request, ctx: RouteContext<"/api/teams/[id]/ai/test">) {
  await connection();
  const auth = await requireWriter(request, { name: "aitest", rule: { window: 600, max: 10 } });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const member = await requireMember(id, auth.user.id, ["owner"]);
  if (!member.ok) return member.response;
  const body = await readBody(request, aiConfigSchema);
  if (!body.ok) return body.response;

  try {
    const provider = await providerFromInput(body.data, await loadAiConfig(db, id));
    if (!provider) return json({ ok: true, text: builtinExplanation(SAMPLE) });
    const text = await explainWith(provider, SAMPLE);
    return text
      ? json({ ok: true, text })
      : json({ ok: false, error: "The model returned no explanation." });
  } catch (error) {
    if (error instanceof AiConfigError || error instanceof WhyUnavailableError) {
      return json({ ok: false, error: TEST_ERRORS[error.reason] ?? "The test failed." });
    }
    throw error;
  }
}
