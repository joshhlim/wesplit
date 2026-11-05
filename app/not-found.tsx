import Link from 'next/link';
import { Mark } from '@/components/brand';
export const metadata = { title: 'Page not found' };
export default function NotFound() {
  return (
    <main className="nf">
      <Mark size={48} />
      <h1>Page not found</h1>
      <p className="muted">This link doesn&apos;t go anywhere.</p>
      <Link href="/" className="btn primary">Back to WeSplit</Link>
    </main>
  );
}
