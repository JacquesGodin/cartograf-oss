type ServiceUrlEntry = {
  url: string;
  loginParam?: string; // query param to append the account email/username
};

const SERVICE_URLS: Record<string, ServiceUrlEntry> = {
  // Database
  "Supabase":        { url: "https://supabase.com/dashboard" },
  "Neon":            { url: "https://console.neon.tech" },
  "MongoDB":         { url: "https://cloud.mongodb.com" },
  "Firebase":        { url: "https://console.firebase.google.com" },
  "PlanetScale":     { url: "https://app.planetscale.com" },
  "Turso":           { url: "https://turso.tech/app" },
  "Convex":          { url: "https://dashboard.convex.dev" },
  "Upstash":         { url: "https://console.upstash.com" },

  // Auth
  "Clerk":           { url: "https://dashboard.clerk.com" },
  "Auth0":           { url: "https://manage.auth0.com" },
  "Kinde":           { url: "https://app.kinde.com" },

  // Storage
  "AWS S3":          { url: "https://s3.console.aws.amazon.com/s3" },
  "Cloudinary":      { url: "https://cloudinary.com/console" },
  "Uploadthing":     { url: "https://uploadthing.com/dashboard" },
  "Vercel Blob":     { url: "https://vercel.com/dashboard" },

  // Payments
  "Stripe":          { url: "https://dashboard.stripe.com" },
  "Lemon Squeezy":   { url: "https://app.lemonsqueezy.com" },
  "Paddle":          { url: "https://vendors.paddle.com" },
  "PayPal":          { url: "https://www.paypal.com/signin" },

  // Email
  "Resend":          { url: "https://resend.com/login" },
  "SendGrid":        { url: "https://app.sendgrid.com" },
  "Postmark":        { url: "https://account.postmarkapp.com/login" },
  "Mailgun":         { url: "https://app.mailgun.com" },

  // Analytics
  "PostHog":         { url: "https://app.posthog.com" },
  "Vercel Analytics":{ url: "https://vercel.com/analytics" },
  "Google Analytics":{ url: "https://analytics.google.com", loginParam: "authuser" },
  "Mixpanel":        { url: "https://mixpanel.com/login" },
  "Amplitude":       { url: "https://app.amplitude.com" },
  "Plausible":       { url: "https://plausible.io/login" },

  // Observability
  "Sentry":          { url: "https://sentry.io/auth/login/" },
  "Datadog":         { url: "https://app.datadoghq.com" },
  "Axiom":           { url: "https://app.axiom.co" },
  "Highlight":       { url: "https://app.highlight.io" },
  "Logtail":         { url: "https://logs.betterstack.com" },

  // Deployment
  "Vercel":          { url: "https://vercel.com/dashboard" },
  "Netlify":         { url: "https://app.netlify.com" },
  "Cloudflare":      { url: "https://dash.cloudflare.com" },
  "Railway":         { url: "https://railway.app/dashboard" },
  "AWS Amplify":     { url: "https://console.aws.amazon.com/amplify" },

  // AI
  "OpenAI":          { url: "https://platform.openai.com" },
  "Anthropic":       { url: "https://console.anthropic.com" },
  "Pinecone":        { url: "https://app.pinecone.io" },
  "Cohere":          { url: "https://dashboard.cohere.com" },

  // CMS
  "Sanity":          { url: "https://www.sanity.io/manage" },
  "Contentful":      { url: "https://app.contentful.com" },
  "Prismic":         { url: "https://prismic.io/dashboard" },
  "Storyblok":       { url: "https://app.storyblok.com" },

  // Search
  "Algolia":         { url: "https://dashboard.algolia.com" },

  // Queue / Realtime
  "Inngest":         { url: "https://app.inngest.com" },
  "Trigger.dev":     { url: "https://cloud.trigger.dev" },
  "Pusher":          { url: "https://dashboard.pusher.com" },
  "Ably":            { url: "https://ably.com/dashboard" },
  "Liveblocks":      { url: "https://liveblocks.io/dashboard" },
};

export function getDashboardUrl(techName: string, accountName?: string): string | null {
  const entry = SERVICE_URLS[techName];
  if (!entry) return null;

  if (entry.loginParam && accountName) {
    const url = new URL(entry.url);
    url.searchParams.set(entry.loginParam, accountName);
    return url.toString();
  }

  return entry.url;
}
