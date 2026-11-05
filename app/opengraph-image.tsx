import { ImageResponse } from 'next/og';
import { Mark, BRAND, INK } from '@/components/brand';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'WeSplit: scan a receipt, split the bill, PayNow your friends';
export default function OG() {
  const row = (n: string, a: string, c: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0', borderBottom: '2px solid #E6EAE8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: c, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{n.slice(0, 2).toUpperCase()}</div>
        <div style={{ fontSize: 28, color: INK }}>{n}</div>
      </div>
      <div style={{ fontSize: 28, color: INK, fontWeight: 700 }}>{a}</div>
    </div>
  );
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F6F8F7', padding: 72, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}><Mark size={72} /><div style={{ fontSize: 48, fontWeight: 700, color: INK }}>WeSplit</div></div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 64, fontWeight: 700, color: INK, lineHeight: 1.1, letterSpacing: -1.5 }}>Split the bill.</div>
          <div style={{ fontSize: 64, fontWeight: 700, color: BRAND, lineHeight: 1.1, letterSpacing: -1.5 }}>Not the friendship.</div>
          <div style={{ fontSize: 28, color: '#4B5753', marginTop: 24 }}>Scan a receipt, tap who had what, PayNow in seconds.</div>
        </div>
      </div>
      <div style={{ width: 440, display: 'flex', flexDirection: 'column', background: '#fff', border: '2px solid #E6EAE8', borderRadius: 28, padding: '28px 36px', alignSelf: 'center' }}>
        {row('Josh', 'S$24.10', '#0B7A5A')}{row('Amanda', 'S$18.65', '#4F46E5')}{row('Ben', 'S$21.30', '#B45309')}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, fontSize: 24, color: '#4B5753' }}><span>Total incl. service + GST</span><span style={{ color: INK, fontWeight: 700 }}>S$64.05</span></div>
      </div>
    </div>,
    size,
  );
}
