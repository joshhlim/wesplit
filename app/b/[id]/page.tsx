import type { Metadata } from 'next';
import Link from 'next/link';
import { Mark } from '@/components/brand';
import { getShared, money } from '@/lib/shared';
import SharedBill from './shared-bill';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getShared(id);
  if (!s || s.revoked) return { title: 'Bill link', robots: { index: false } };
  const host = s.people[0]?.name || 'A friend';
  const t = `${s.place} · ${money(s.total)}`;
  const d = `${host} split this bill with WeSplit. Tap your name to see what you owe and PayNow.`;
  return { title: t, description: d, robots: { index: false, follow: false }, openGraph: { title: t, description: d }, twitter: { card: 'summary_large_image', title: t, description: d } };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const s = await getShared(id);
  if (!s || s.revoked) return (
    <main className="shared">
      <div className="empty"><Mark size={48} /><b>{s?.revoked ? 'This link was turned off' : 'Bill not found'}</b>
        <span className="muted">{s?.revoked ? 'The person who shared it stopped sharing. Ask them for a new link.' : 'Check the link and try again.'}</span></div>
      <Link href="/" className="btn primary">Split your own bill</Link>
    </main>
  );
  return <SharedBill id={id} initial={s} />;
}
