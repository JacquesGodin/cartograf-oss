import * as Sentry from "@sentry/nextjs";
import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

function parseOtlpHeaders(value: string | undefined) {
  const headers: Record<string, string> = {};

  for (const pair of value?.split(",") ?? []) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;

    try {
      const key = decodeURIComponent(pair.slice(0, separator).trim());
      const headerValue = decodeURIComponent(pair.slice(separator + 1).trim());
      if (key && headerValue) headers[key] = headerValue;
    } catch {
      // Ignore malformed optional exporter headers.
    }
  }

  return headers;
}

export async function register() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "");

  if (endpoint) {
    registerOTel({
      serviceName: process.env.OTEL_SERVICE_NAME ?? "cartograf",
      // Export directly to Grafana Cloud instead of relying on Vercel drains.
      traceExporter: new OTLPHttpProtoTraceExporter({
        url: `${endpoint}/v1/traces`,
        headers: parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      }),
    });
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
