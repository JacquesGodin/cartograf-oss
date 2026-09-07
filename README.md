# cartograf

Map the services and libraries detected in JavaScript and TypeScript stacks.

cartograf scans `package.json`-based projects and renders an interactive radial map of the recognized technology stack: services, libraries, databases, auth providers, payments, deployment targets, and more.

## What it does

Point cartograf at a repo or a local folder and it parses `package.json`, classifies recognized technologies, samples JavaScript/TypeScript source usage, and draws a radial map. You can annotate nodes, attach account labels, and keep multiple projects open at once on a zoomable canvas.

The OSS app has no account system and no server database. Workspace data stays in browser storage unless you export it yourself.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000/app](http://localhost:3000/app).

No environment variables are required for local use.

## Scanning a project

**GitHub URL** - paste any public repo URL directly into the input field. cartograf fetches the root `package.json`, samples a bounded set of source/config files through the GitHub API, and builds the map.

**Local folder** - click "Open folder" and select a directory from your machine (Chrome/Edge only - requires the File System Access API). cartograf looks for a `package.json`, then scans within fixed file and size limits.

**Manual** - drop a `package.json` onto the canvas.

## Accuracy and limits

cartograf is a best-effort stack map, not an exhaustive software inventory.

- Detection is based on a curated technology catalogue, package names, deployment config files, scripts, and JavaScript/TypeScript import patterns.
- GitHub scans intentionally inspect bounded repository data: the root `package.json`, deployment config paths, and a sample of eligible source files.
- Local folder scans run in the browser with fixed file-count, source-file, and file-size limits.
- Monorepos are treated conservatively: cartograf chooses the shallowest `package.json` instead of recursively building every workspace package.
- Browser uploads are capped before parsing: `package.json` uploads must be under 1 MB and cartograf JSON imports under 5 MB.

These limits keep scans fast, predictable, and safer for public/self-hosted deployments. Missing detections should be treated as expected product limitations rather than proof that a technology is absent.

## Supported manifests

| File | Ecosystem |
|---|---|
| `package.json` | Node / JavaScript |

## Self-hosting

Set `NEXT_PUBLIC_APP_URL` to your domain when deploying publicly so sitemap and OG tags resolve correctly.

```bash
pnpm build
pnpm start
```

If you expose a self-hosted instance to the public internet, put it behind your platform's normal edge protections or WAF. The app includes a best-effort `/api/stack` throttle, but it is per-process and not a substitute for infrastructure rate limiting.

By default the OSS throttle does not trust `x-forwarded-for` or `x-real-ip`, because a directly exposed server can receive forged header values. Set `CARTOGRAF_TRUST_PROXY_HEADERS=true` only when the app sits behind a proxy you control that overwrites those headers.

## License

AGPL-3.0 - see [LICENSE](LICENSE).
