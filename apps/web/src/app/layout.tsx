import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { PostHogProvider } from '@/lib/posthog/client'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Folio', template: '%s | Folio' },
  description: 'Your reading life, finally organized. The smart TBR and book tracking app readers actually want.',
  metadataBase: new URL('https://foliotbr.app'),
  openGraph: {
    siteName: 'Folio',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  themeColor: '#1B3A2D',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PostHogProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#1B3A2D',
                color: '#F5EDD8',
                border: 'none',
                borderRadius: '40px',
                fontFamily: 'DM Sans, sans-serif',
              },
            }}
          />
        </PostHogProvider>
      </body>
    </html>
  )
}
