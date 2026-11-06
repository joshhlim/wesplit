'use client';
import './globals.css';
import { Nunito } from 'next/font/google';
import { Crash } from '@/components/crash';

const font = Nunito({ subsets: ['latin'], display: 'swap', variable: '--font' });

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-SG" className={font.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong · WeSplit</title>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('ws-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body>
        <Crash reset={reset} />
      </body>
    </html>
  );
}
