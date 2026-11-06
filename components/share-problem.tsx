'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { Mark } from '@/components/brand';

export function ShareProblem({ kind }: { kind: 'unavailable' | 'missing' | 'revoked' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const revoked = kind === 'revoked';
  const down = kind === 'unavailable';
  const title = down ? "Couldn't connect" : revoked ? 'This link was turned off' : 'Bill not found';
  const body = down
    ? "We couldn't reach WeSplit to load this bill. Check your connection and try again."
    : revoked
      ? 'The person who shared it stopped sharing. Ask them for a new link.'
      : "This link doesn't match a bill. Check it and try again.";
  return (
    <main className="status">
      {down ? <span className="payme-ic"><WifiOff size={28} /></span> : <Mark size={56} />}
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <div className="status-actions">
        {down && (
          <button className="btn primary" disabled={busy} aria-busy={busy} onClick={() => { setBusy(true); router.refresh(); window.setTimeout(() => setBusy(false), 4000); }}>
            {busy ? 'Retrying…' : 'Retry'}
          </button>
        )}
        <Link href="/" className={'btn ' + (down ? 'ghost' : 'primary')}>Home</Link>
      </div>
    </main>
  );
}
