import './globals.css';
export const metadata = { title: 'WeSplit', description: 'Scan a receipt, split the bill, PayNow your friends.' };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#10b981' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('ws-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
