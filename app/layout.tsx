import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Holidays Mode — A small break goes a long way.',
  description:
    'Pick a destination, beat your best and fill your passport. A free block puzzle. Bali, Tokyo, Ibiza, Rio. Switch Holidays Mode ON.',
  metadataBase: new URL('https://holidaysmode.me'),
  alternates: { canonical: '/' },
  icons: {
    icon: '/brand/holidays-mode-icon.png',
    apple: '/brand/holidays-mode-icon.png',
  },
  openGraph: {
    title: 'Holidays Mode',
    description:
      'A small break goes a long way. Pick a destination, beat your best and fill your passport.',
    url: 'https://holidaysmode.me',
    type: 'website',
    images: [
      {
        url: '/brand/holidays-mode-banner.png',
        width: 1500,
        height: 500,
        alt: 'Holidays Mode — Bali, Tokyo, Ibiza, Rio',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@HolidaysMode',
    title: 'Holidays Mode',
    description: 'A small break goes a long way.',
    images: ['/brand/holidays-mode-banner.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/archivo-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/nunito-sans-latin-wght-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
