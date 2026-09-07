// Keep public discovery URLs on the final host while preserving self-hosted origins.
export function siteUrl(appUrl = process.env.NEXT_PUBLIC_APP_URL): string {
  const url = new URL(appUrl ?? "https://www.cartograf.dev");
  if (url.hostname === "cartograf.dev" || url.hostname === "www.cartograf.dev") {
    return "https://www.cartograf.dev";
  }
  return url.origin;
}
