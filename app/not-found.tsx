import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="cg-container" style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 720 }}>
      <p style={{ color: 'var(--accent)', fontStyle: 'italic' }}>404</p>
      <h1 style={{ color: 'var(--ink)', fontSize: 'clamp(40px, 5vw, 64px)', margin: '16px 0' }}>
        Page not found.
      </h1>
      <p style={{ color: 'var(--ink-mid)', fontSize: 18, lineHeight: 1.6 }}>
        The page you requested does not exist. Return to cartograf to map your project stack.
      </p>
      <Link href="/" className="cg-btn cg-btn-primary" style={{ display: 'inline-flex', marginTop: 28 }}>
        Back to cartograf
      </Link>
    </main>
  )
}
