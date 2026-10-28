import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Overpass } from 'next/font/google';
import './globals.css';

const overpass = Overpass({ subsets: ['latin'], weight: ['400', '600', '700', '800', '900'], variable: '--font-overpass', display: 'swap' });

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: '¿Dónde quedamos? El sitio más justo para quedar',
  description: 'No el punto medio del mapa: el sitio donde todos tardáis lo mismo en llegar, vengáis en metro, en coche, en bici o andando.',
  applicationName: '¿Dónde quedamos?',
  appleWebApp: { capable: true, title: 'Dónde quedamos', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    title: '¿Dónde quedamos? El sitio más justo para quedar',
    description: 'El punto medio del mapa engaña. Esta web busca el bar donde todos tardáis lo mismo, cada uno con su transporte.',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F0F0EA' },
    { media: '(prefers-color-scheme: dark)', color: '#0C131C' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={overpass.variable}>
      <body>
        {children}
        {process.env.NODE_ENV === 'production' && <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
