import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Locus',
  description: 'How Locus collects, uses, and protects your personal data.',
}

const LAST_UPDATED = 'May 12, 2025'
const CONTACT_EMAIL = 'privacy@locusai.space'
const APP_NAME = 'Locus'
const APP_URL = 'https://locusai.space'

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      color: '#e8e4dc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '60px 24px 100px',
      }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <a
            href={APP_URL}
            style={{
              fontSize: '13px', color: '#8a8070', textDecoration: 'none',
              display: 'inline-block', marginBottom: '32px',
            }}
          >
            ← {APP_NAME}
          </a>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '38px', fontWeight: 400,
            color: '#f0ece4', margin: '0 0 12px',
            lineHeight: 1.2,
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: '14px', color: '#6a6560', margin: 0 }}>
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <Prose>

          <P>
            {APP_NAME} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is an AI-powered personal life operating system
            available at <a href={APP_URL} style={linkStyle}>{APP_URL}</a>. This Privacy Policy explains
            what information we collect, how we use it, and how we protect it.
          </P>

          <H2>1. Information We Collect</H2>

          <H3>Account information</H3>
          <P>
            When you sign up, we collect your name and email address. You may optionally
            provide a profile photo URL. This information is stored securely via Supabase.
          </P>

          <H3>Personal data you enter</H3>
          <P>
            {APP_NAME} is a personal productivity app. You may choose to enter information
            such as daily energy levels, mood notes, goals, habits, and journal entries.
            This data is stored in your private account and is not shared with other users.
          </P>

          <H3>Google Calendar data</H3>
          <P>
            If you choose to connect your Google Calendar, {APP_NAME} requests access using
            the scope{' '}
            <code style={codeStyle}>https://www.googleapis.com/auth/calendar</code>.
            We use this access to:
          </P>
          <Ul>
            <li>Read your upcoming calendar events (next 7 days) from all calendars you have access to</li>
            <li>Surface relevant events in your daily AI brief, home dashboard widget, weekly reflection, and planner</li>
            <li>Create new calendar events on your behalf when you use the &ldquo;New Calendar Event&rdquo; feature in the Planner — events are created in your primary Google Calendar</li>
          </Ul>
          <P>
            We do <strong>not</strong> modify or delete existing calendar events. We do{' '}
            <strong>not</strong> share your calendar data with third parties. Calendar events
            are cached temporarily (up to 30 minutes) to reduce API calls and improve
            performance, then re-fetched automatically.
          </P>
          <P>
            Your Google OAuth tokens (access token and refresh token) are stored securely
            in our database with row-level security — only you can access your own tokens.
            You can disconnect Google Calendar at any time from the Settings page, which
            immediately deletes your tokens and all cached calendar data.
          </P>

          <H3>Usage data</H3>
          <P>
            We may collect basic server logs (IP addresses, timestamps, request paths) for
            security and debugging purposes. We do not use third-party analytics trackers.
          </P>

          <H2>2. How We Use Your Data</H2>
          <P>We use the data you provide to:</P>
          <Ul>
            <li>Generate your personalised daily brief, pulse message, and weekly reflection using AI (Anthropic Claude)</li>
            <li>Track your habits, goals, and energy patterns over time</li>
            <li>Surface calendar events in your AI context so the AI can give more relevant advice</li>
            <li>Improve your experience within the app</li>
          </Ul>
          <P>
            We do <strong>not</strong> sell your data. We do <strong>not</strong> use your
            personal data to train AI models. Your journal entries, mood notes, and goals
            are used solely to generate responses within your own session.
          </P>

          <H2>3. AI Processing</H2>
          <P>
            {APP_NAME} uses Anthropic&apos;s Claude API to generate personalised insights.
            When you use AI features, relevant portions of your data (energy levels, habits,
            goals, calendar events, journal entries) are sent to Anthropic&apos;s API to
            generate a response. This processing is governed by{' '}
            <a href="https://www.anthropic.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">
              Anthropic&apos;s Privacy Policy
            </a>.
            We do not send more data than necessary for each request.
          </P>

          <H2>4. Data Storage and Security</H2>
          <P>
            Your data is stored in a PostgreSQL database managed by Supabase, hosted on AWS
            infrastructure. All data is encrypted at rest and in transit (TLS). Access to
            your data is enforced using row-level security — database queries are
            automatically scoped to your account.
          </P>
          <P>
            OAuth tokens (including Google Calendar tokens) are stored in the same
            secured database and are only accessible by your authenticated session.
          </P>

          <H2>5. Data Retention and Deletion</H2>
          <P>
            Your data is retained for as long as your account is active. You can delete
            your account at any time by contacting us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
            Upon deletion, all your personal data — including journal entries, check-ins,
            goals, habits, memory, and OAuth tokens — will be permanently removed.
          </P>
          <P>
            You can disconnect Google Calendar at any time from Settings → Integrations.
            This immediately revokes our access and deletes your stored tokens and
            cached calendar data.
          </P>

          <H2>6. Third-Party Services</H2>
          <P>We use the following third-party services:</P>
          <Ul>
            <li><strong>Supabase</strong> — authentication and database (<a href="https://supabase.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Anthropic Claude</strong> — AI generation (<a href="https://www.anthropic.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Google Calendar API</strong> — calendar access, only if you connect it (<a href="https://policies.google.com/privacy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
            <li><strong>Vercel</strong> — hosting and deployment (<a href="https://vercel.com/legal/privacy-policy" style={linkStyle} target="_blank" rel="noopener noreferrer">Privacy Policy</a>)</li>
          </Ul>

          <H2>7. Your Rights</H2>
          <P>You have the right to:</P>
          <Ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and all associated data</li>
            <li>Revoke Google Calendar access at any time from within the app or via your <a href="https://myaccount.google.com/permissions" style={linkStyle} target="_blank" rel="noopener noreferrer">Google Account permissions page</a></li>
          </Ul>
          <P>
            To exercise any of these rights, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
          </P>

          <H2>8. Children&apos;s Privacy</H2>
          <P>
            {APP_NAME} is not directed at children under 13. We do not knowingly collect
            personal information from children under 13.
          </P>

          <H2>9. Changes to This Policy</H2>
          <P>
            We may update this Privacy Policy from time to time. When we do, we will update
            the &quot;Last updated&quot; date at the top of this page. Continued use of{' '}
            {APP_NAME} after changes constitutes acceptance of the updated policy.
          </P>

          <H2>10. Contact</H2>
          <P>
            If you have any questions about this Privacy Policy, contact us at:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
          </P>

        </Prose>
      </div>
    </div>
  )
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return <div style={{ lineHeight: 1.75 }}>{children}</div>
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'Georgia, serif',
      fontSize: '22px', fontWeight: 400,
      color: '#f0ece4', margin: '44px 0 12px',
      paddingTop: '8px', borderTop: '1px solid #2a2a2a',
    }}>
      {children}
    </h2>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: '15px', fontWeight: 600,
      color: '#c8c4bc', margin: '24px 0 8px',
    }}>
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '15px', color: '#b8b4ac', margin: '0 0 16px' }}>
      {children}
    </p>
  )
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{
      fontSize: '15px', color: '#b8b4ac',
      margin: '0 0 16px', paddingLeft: '20px',
      display: 'flex', flexDirection: 'column', gap: '6px',
    }}>
      {children}
    </ul>
  )
}

const linkStyle: React.CSSProperties = {
  color: '#c8a96e',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(200,169,110,0.4)',
}

const codeStyle: React.CSSProperties = {
  fontSize: '12px',
  background: '#1e1e1e',
  border: '1px solid #2e2e2e',
  borderRadius: '4px',
  padding: '2px 6px',
  color: '#a8c4a0',
  fontFamily: 'monospace',
}
