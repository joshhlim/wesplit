import Link from 'next/link';
import { Mark } from '@/components/brand';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="status">
      <Mark size={56} />
      <h1>Page not found</h1>
      <p className="muted">This link doesn&apos;t go anywhere. The bill splitter is still right here.</p>
      <div className="status-actions">
        <Link href="/" className="btn primary">Home</Link>
      </div>
    </main>
  );
}
