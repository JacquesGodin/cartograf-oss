// Guards user-supplied URLs before they are placed in an href/src. Only
// absolute http(s) URLs are allowed through; `javascript:`, `data:`, `blob:`,
// `vbscript:`, relative, and unparseable values return undefined so they never
// become a clickable link. Parsing via the URL constructor also neutralises
// tab/newline/whitespace evasions the way a browser would when following a link.
export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return undefined;
  }

  return value;
}
