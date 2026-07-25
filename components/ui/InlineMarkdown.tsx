'use client'

import React from 'react'

/* ── Tiny inline markdown renderer ─────────────────────────────────────────
   Handles: **bold**, *italic*, __underline__, <<highlight>>.
   No dependency needed — avoids ESM issues with react-markdown v9+.
   Shared by the daily brief and the onboarding/check-in chats so model output
   renders the same way everywhere.
─────────────────────────────────────────────────────────────────────────── */

export function renderInline(raw: string, key: string): React.ReactNode {
  // Split on **bold**, *italic*, __underline__, and <<highlight>> tokens
  const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|<<.+?>>)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${key}-b${i}`} style={{ fontWeight: 600, color: 'var(--text-0)' }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${key}-i${i}`} style={{ fontStyle: 'italic', color: 'var(--text-3)', fontWeight: 300 }}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <span key={`${key}-u${i}`} style={{ textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'rgba(242,235,224,0.35)' }}>{part.slice(2, -2)}</span>
    }
    if (part.startsWith('<<') && part.endsWith('>>')) {
      return (
        <mark key={`${key}-h${i}`} style={{
          background:   'rgba(212,168,83,0.18)',
          color:        'var(--gold)',
          borderRadius: '3px',
          padding:      '1px 4px',
          fontStyle:    'normal',
        }}>
          {part.slice(2, -2)}
        </mark>
      )
    }
    return part
  })
}

/** Renders a single run of model text — inline formatting only, no paragraph splitting. */
export default function InlineMarkdown({ text, id = 'md' }: { text: string; id?: string }) {
  return <>{renderInline(text, id)}</>
}
