import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font' });

export const metadata: Metadata = {
  metadataBase: new URL('https://wesplit-sg.vercel.app'),
  title: { default: 'WeSplit', template: '%s · WeSplit' },
  description: 'Scan a receipt, tap who had what, and PayNow your friends. Built for Singapore.',
  applicationName: 'WeSplit',
  appleWebApp: { capable: true, title: 'WeSplit', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: { type: 'website', siteName: 'WeSplit', title: 'WeSplit', description: 'Scan a receipt, tap who had what, and PayNow your friends.', url: '/' },
  twitter: { card: 'summary_large_image', title: 'WeSplit', description: 'Scan a receipt, tap who had what, and PayNow your friends.' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FFFFFF' }, { media: '(prefers-color-scheme: dark)', color: '#0D1110' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-SG" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('ws-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
