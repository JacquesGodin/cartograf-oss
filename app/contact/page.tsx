import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact cartograf',
  alternates: { canonical: '/contact' },
  description: 'Contact the team behind cartograf for product, support, or self-hosting questions.',
}

export default function ContactPage() {
  return (
    <main className="cg-container" style={{ maxWidth: 820, paddingTop: 72, paddingBottom: 120 }}>
      <p style={eyebrow}>contact</p>
      <h1 style={heading}>Let&apos;s map it out.</h1>
      <div style={body}>
        <p>
          Questions about cartograf, cartograf Cloud, or self-hosting the open-source edition are welcome. The fastest way to reach the team is by email. Include a short description of your project, the repositories or integrations involved, and whether you are using the hosted or self-hosted version so we can point you in the right direction.
        </p>
        <p>
          For product questions, team plans, technical support, or feedback, email <a href="mailto:hello@exploraworks.com">hello@exploraworks.com</a>. For privacy requests, including access or deletion requests, email <a href="mailto:privacy@exploraworks.com">privacy@exploraworks.com</a>. We use email rather than a public issue tracker for account-specific questions to avoid exposing project information.
        </p>
        <p>
          If you are evaluating cartograf for a larger team, tell us how many repositories and collaborators you expect to map, along with any self-hosting requirements. You can also inspect the <a href="https://github.com/JacquesGodin/cartograf-oss">OSS source code</a> and read our <Link href="/privacy">Privacy Policy</Link> before getting started.
        </p>
      </div>
    </main>
  )
}

const eyebrow: React.CSSProperties = { color: 'var(--accent)', fontStyle: 'italic', fontSize: 15, margin: '0 0 18px' }
const heading: React.CSSProperties = { color: 'var(--ink)', fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }
const body: React.CSSProperties = { color: 'var(--ink-mid)', fontSize: 18, lineHeight: 1.7, marginTop: 28, maxWidth: '65ch' }
