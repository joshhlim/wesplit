'use client';
import { Mark } from '@/components/brand';

export function Crash({ reset, title = 'Something went wrong', body = 'WeSplit hit a snag loading this page. Your bills on this phone are still there.' }: { reset?: () => void; title?: string; body?: string }) {
  return (
    <main className="status">
      <Mark size={56} />
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      <div className="status-actions">
        {reset && <button className="btn primary" onClick={() => reset()}>Retry</button>}
        <a className="btn ghost" href="/">Home</a>
      </div>
    </main>
  );
}
