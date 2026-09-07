import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About cartograf',
  alternates: { canonical: '/about' },
  description: 'Learn about cartograf, the open-source tool for mapping project dependencies and services.',
}

export default function AboutPage() {
  return (
    <main className="cg-container" style={{ maxWidth: 820, paddingTop: 72, paddingBottom: 120 }}>
      <p style={eyebrow}>about cartograf</p>
      <h1 style={heading}>A clearer view of the stack behind your work.</h1>
      <div style={body}>
        <p>
          cartograf is an open-source developer tool for mapping the libraries and services that power a software project. Modern products often depend on a mix of frameworks, databases, authentication providers, payment systems, hosting platforms, analytics, and other tooling. Those connections are easy to lose track of as repositories multiply and teams change.
        </p>
        <p>
          cartograf scans package metadata, deployment configuration, and selected source imports to identify those dependencies and present them as an interactive map. You can inspect a single project, compare several projects in one workspace, annotate the services you use, and identify integrations that still need account details. Local folder scans run in the browser, so source files selected for a local scan stay on your machine.
        </p>
        <p>
          The project is maintained by Exploraworks. cartograf is available as a self-hosted AGPL-3.0 application and as cartograf Cloud for people who want a managed workspace with cross-device sync. Read the <Link href="/privacy">Privacy Policy</Link>, explore the <a href="https://github.com/JacquesGodin/cartograf-oss">open-source repository</a>, or <Link href="/contact">contact us</Link> with questions.
        </p>
      </div>
    </main>
  )
}

const eyebrow: React.CSSProperties = { color: 'var(--accent)', fontStyle: 'italic', fontSize: 15, margin: '0 0 18px' }
const heading: React.CSSProperties = { color: 'var(--ink)', fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.05, margin: 0 }
const body: React.CSSProperties = { color: 'var(--ink-mid)', fontSize: 18, lineHeight: 1.7, marginTop: 28, maxWidth: '65ch' }
