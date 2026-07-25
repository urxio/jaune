import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Jaune — AI Life OS',
  description: 'Your AI-native life operating system',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the pre-paint script below sets data-theme, which the server HTML can't know
  return (
    <html lang="en" className={`${cormorant.variable} ${plusJakarta.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Prevent flash: set theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('locus-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  )
}
