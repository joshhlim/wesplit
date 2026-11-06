import type { Metadata } from 'next';
import { getShared, money } from '@/lib/shared';
import { ShareProblem } from '@/components/share-problem';
import SharedBill from './shared-bill';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getShared(id);
  if (s.status !== 'ok') {
    const title = s.status === 'unavailable' ? "Couldn't connect" : 'Bill link';
    return { title, robots: { index: false } };
  }
  const host = s.data.people[0]?.name || 'A friend';
  const t = `${s.data.place} · ${money(s.data.total)}`;
  const d = `${host} split this bill with WeSplit. Tap your name to see what you owe and PayNow.`;
  return { title: t, description: d, robots: { index: false, follow: false }, openGraph: { title: t, description: d }, twitter: { card: 'summary_large_image', title: t, description: d } };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const s = await getShared(id);
  if (s.status !== 'ok') return <ShareProblem kind={s.status} />;
  return <SharedBill id={id} initial={s.data} />;
}
