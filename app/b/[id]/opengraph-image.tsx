import { ImageResponse } from 'next/og';
import { Mark, BRAND, INK } from '@/components/brand';
import { getShared, money } from '@/lib/shared';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A WeSplit bill';
export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShared(id);
  const ok = s && !s.revoked;
  const people = ok ? s.people.slice(1).filter((p) => p.share > 0).slice(0, 4) : [];
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F6F8F7', padding: 72, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><Mark size={64} /><div style={{ fontSize: 40, fontWeight: 700, color: INK }}>WeSplit</div></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, color: '#4B5753' }}>{ok ? `${s.people[0]?.name || 'A friend'} split the bill` : 'Bill link'}</div>
          <div style={{ fontSize: 68, fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 600 }}>{ok ? s.place.slice(0, 40) : 'Not available'}</div>
          {ok && <div style={{ fontSize: 56, fontWeight: 700, color: BRAND, marginTop: 8 }}>{money(s.total)}</div>}
          <div style={{ fontSize: 28, color: '#4B5753', marginTop: 20 }}>Tap your name to see what you owe.</div>
        </div>
      </div>
      {people.length > 0 && <div style={{ width: 420, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 40, padding: '24px 36px', alignSelf: 'center' }}>
        {people.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>{p.name.slice(0, 2).toUpperCase()}</div>
              <div style={{ fontSize: 28, color: INK }}>{p.name.slice(0, 14)}</div>
            </div>
            <div style={{ fontSize: 28, color: p.paid ? BRAND : INK, fontWeight: 700 }}>{p.paid ? 'Paid' : money(p.share)}</div>
          </div>
        ))}
      </div>}
    </div>, size);
}
