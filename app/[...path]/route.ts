const markdown = `# Page not found

The requested page does not exist.

- Homepage: https://cartograf.dev/
- App: https://cartograf.dev/app
- Agent guide: https://cartograf.dev/llms.txt
- Sitemap: https://cartograf.dev/sitemap.xml
`

export function GET(request: Request) {
  const acceptsMarkdown = request.headers.get('accept')?.includes('text/markdown')

  return new Response(acceptsMarkdown ? markdown : 'Page not found', {
    status: 404,
    headers: {
      'Content-Type': acceptsMarkdown ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
      Vary: 'Accept',
    },
  })
}
