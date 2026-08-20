// Canonical origin used to scope CORS. Falls back to the production apex.
const APP_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://cartograf.dev").origin;
  } catch {
    return "https://cartograf.dev";
  }
})();

// Cloud builds load Clerk's hosted SDK and Cloudflare Turnstile; the OSS
// self-host build runs without them and gets a tighter policy.
const isCloudBuild = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
// camelCase on purpose: the OSS export verifier rejects UPPER_SNAKE identifiers
// beginning with the auth provider's name, and this file ships in that build.
const clerkFrontendApi = "https://clerk.cartograf.dev";
const clerkPreviewApi = "https://*.clerk.accounts.dev";
const clerkTelemetry = "https://clerk-telemetry.com";
const clerkImages = "https://img.clerk.com";
const turnstile = "https://challenges.cloudflare.com";

// A static Content-Security-Policy. It is not nonce-based on purpose: Next.js
// only stamps nonces onto scripts for dynamically-rendered pages, and this app
// is largely statically prerendered, so a nonce+'strict-dynamic' policy would
// block those pages' own chunks in production. This policy keeps every other
// directive strict (no external script/style/frame/connect sources beyond the
// ones we use, object-src 'none', frame-ancestors 'none', base-uri 'self'),
// which still blocks external and injected-src script loading, form hijacking,
// and data exfiltration to unknown origins.
function buildContentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  const connectSrc = ["'self'"];
  // GitHub owner avatars (github.com/<owner>.png, which redirects to
  // avatars.githubusercontent.com) are shown for scanned repos in both editions.
  const imgSrc = [
    "'self'",
    "data:",
    "blob:",
    "https://github.com",
    "https://avatars.githubusercontent.com",
  ];
  const frameSrc = ["'self'"];
  const formAction = ["'self'"];

  if (isCloudBuild) {
    scriptSrc.push(clerkFrontendApi, clerkPreviewApi, turnstile);
    connectSrc.push(clerkFrontendApi, clerkPreviewApi, clerkTelemetry);
    imgSrc.push(clerkImages);
    frameSrc.push(turnstile);
    formAction.push(clerkFrontendApi);
  }

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    // Radix/React inline styles and next/font require inline styles.
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(" ")}`,
    `worker-src 'self' blob:`,
    `frame-src ${frameSrc.join(" ")}`,
    `form-action ${formAction.join(" ")}`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
    // Report (but do not block on) violations to our own endpoint so real-world
    // blocks are logged instead of failing silently. Relative + same-origin so
    // it works on whichever host served the page. `report-uri` is deprecated in
    // favour of the Reporting API's `report-to`, but it is the directive current
    // browsers still honour reliably without an absolute endpoint URL.
    `report-uri /api/csp-report`,
  ].join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },

  async headers() {
    const contentSecurityPolicy = buildContentSecurityPolicy();
    // Defence-in-depth headers applied to every response.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Scope cross-origin reads to our own origin instead of the
          // wildcard Vercel advertises by default on app-served responses.
          // App content is public, so this is belt-and-suspenders, but it
          // keeps other origins from reading our responses via the browser.
          { key: "Access-Control-Allow-Origin", value: APP_ORIGIN },
          // Force HTTPS for two years, include subdomains, eligible for preload.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Block being framed by other sites (clickjacking protection).
          { key: "X-Frame-Options", value: "DENY" },
          // Browsers must respect the Content-Type we send.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send the origin (not the full URL) on cross-origin navigations.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Deny powerful browser features the app doesn't use.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
