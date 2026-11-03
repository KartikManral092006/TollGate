const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1)\b/;

// The address people use to reach the app. On a Vercel production deploy, Vercel's own
// production domain wins over a missing NEXT_PUBLIC_APP_URL or one copied from a local .env
// (which would break sign-in: Better Auth only trusts that origin, and magic links use it).
export function resolveAppUrl(input: {
  appUrl: string | undefined;
  vercelEnv: string | undefined;
  productionHost: string | undefined;
}): string | undefined {
  const { appUrl, vercelEnv, productionHost } = input;
  if (vercelEnv === "production" && productionHost && (!appUrl || LOCAL_URL.test(appUrl))) {
    return `https://${productionHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  return appUrl;
}
