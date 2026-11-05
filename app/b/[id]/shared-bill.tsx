'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import Link from 'next/link';
import { CircleCheck, Copy, Check, RefreshCw, MapPin, Tag } from 'lucide-react';
import { paynowPayload } from '@/lib/split.mjs';
import { Mark } from '@/components/brand';
import { money, type Shared } from '@/lib/shared';

const ini = (n: string) => { const w = n.trim().split(/\s+/); return ((w.length > 1 ? w.map((x) => x[0]).join('') : n).slice(0, 2).toUpperCase()) || '?'; };
const fmtSG = (m: string) => { const d = m.replace(/^\+65/, ''); return `+65 ${d.slice(0, 4)} ${d.slice(4)}`; };

export default function SharedBill({ id, initial }: { id: string; initial: Shared }) {
  const [s, setS] = useState(initial);
  const [me, setMe] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const host = s.people[0], friends = s.people.slice(1).filter((p) => p.share > 0);
  const p = friends.find((x) => x.id === me);
  const payTo = s.payee.name || fmtSG(s.payee.mobile);

  useEffect(() => { try { const k = localStorage.getItem('ws-me-' + id); if (k) setMe(k); } catch {} }, [id]);
  useEffect(() => { if (me) try { localStorage.setItem('ws-me-' + id, me); } catch {} }, [me, id]);
  const refresh = async () => { const r = await fetch(location.pathname + '/data', { cache: 'no-store' }); if (r.ok) { const d = await r.json(); if (d && !d.revoked) setS(d); else location.reload(); } };
  useEffect(() => { const t = setInterval(refresh, 20000); const v = () => document.visibilityState === 'visible' && refresh(); document.addEventListener('visibilitychange', v); return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); }; });
  useEffect(() => { setQr(''); if (p && !p.paid) QRCode.toDataURL(paynowPayload({ mobile: s.payee.mobile, amount: p.share, ref: 'WeSplit ' + p.name }), { margin: 1, width: 260, color: { dark: '#0F1A17' } }).then(setQr); }, [p, s.payee.mobile]);
  const copy = async () => { await navigator.clipboard.writeText(s.payee.mobile.replace('+65', '')); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const nameOf = (pid: string) => s.people.find((x) => x.id === pid)?.name || '';

  return (
    <main className="shared">
      <header className="top"><Link href="/" className="brand"><Mark size={28} /><b>WeSplit</b></Link><button className="icon-btn" aria-label="Refresh" onClick={refresh}><RefreshCw size={18} /></button></header>
      <div className="hero center">
        <p className="muted">{host?.name || 'Your friend'} split this bill</p>
        <h1>{s.place}</h1>
        {s.location && <p className="muted small"><MapPin size={13} /> {s.location}</p>}
        <p className="muted small">{new Date(s.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {money(s.total)} total{s.mode ? ` · ${s.mode}` : ''}</p>
      </div>

      <section className="stack">
        <h2 className="sub center">Who are you?</h2>
        <div className="faces">
          {friends.map((x) => (
            <button key={x.id} className={'face' + (me === x.id ? ' on' : '') + (x.paid ? ' paid' : '')} aria-pressed={me === x.id} onClick={() => setMe(x.id)} style={{ ['--pc' as string]: x.color }}>
              <span className="av" style={{ background: x.color }}>{ini(x.name)}{x.paid && <i><CircleCheck size={16} /></i>}</span>
              <b>{x.name}</b><small className="num">{money(x.share)}</small>
            </button>
          ))}
        </div>

        {p && (p.paid ? (
          <div className="youowe paid"><CircleCheck size={36} /><b>You&apos;re all paid</b><span className="muted">{payTo} marked your {money(p.share)} as paid. Thanks!</span></div>
        ) : (
          <div className="youowe">
            <span className="muted">{p.name}, you owe {payTo}</span>
            <b className="num huge">{money(p.share)}</b>
            {qr && <img src={qr} alt={`PayNow QR for ${money(p.share)}`} width={220} height={220} />}
            <small className="muted">Screenshot and scan in your banking app, or PayNow to</small>
            <button className="chip-btn" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {fmtSG(s.payee.mobile)}</button>
          </div>
        ))}
      </section>

      {s.items.length > 0 && (
        <section className="stack">
          <h2 className="sub">What was ordered</h2>
          <ul className="slist">
            {s.items.map((it, i) => {
              const W = it.w ? Object.values(it.w).reduce((a, b) => a + b, 0) : 0;
              const uneven = it.w && new Set(Object.values(it.w)).size > 1;
              const net = it.free ? 0 : Math.max(0, it.price - (it.disc || 0));
              return (
                <li key={i} className={me && it.who.includes(me) ? 'mine' : ''}>
                  <span><b>{it.name}</b>{it.who.length > 0 && <small className="muted">{it.who.map((w) => nameOf(w) + (uneven && it.w ? ` ${it.w[w]}/${W}` : '')).filter(Boolean).join(', ')}</small>}</span>
                  <span className="num">{it.free ? <><s>{money(it.price)}</s> <em className="freetag">Free</em></> : it.disc ? <><s>{money(it.price)}</s> {money(net)}</> : money(it.price)}</span>
                </li>
              );
            })}
          </ul>
          {s.breakdown && <div className="soft">
            <div className="line"><span>Items</span><span className="num">{money(s.breakdown.gross / 100)}</span></div>
            {s.breakdown.itemDisc > 0 && <div className="line disc"><span>Item discounts</span><span className="num">−{money(s.breakdown.itemDisc / 100)}</span></div>}
            {s.breakdown.voucher > 0 && <div className="line disc"><span><Tag size={13} /> Voucher{s.voucher ? ` (${s.voucher})` : ''}</span><span className="num">−{money(s.breakdown.voucher / 100)}</span></div>}
            {s.breakdown.sc > 0 && <div className="line muted"><span>Service charge 10%</span><span className="num">{money(s.breakdown.sc / 100)}</span></div>}
            {s.breakdown.gst > 0 && <div className="line muted"><span>GST 9%</span><span className="num">{money(s.breakdown.gst / 100)}</span></div>}
            <div className="line total"><span>Total</span><b className="num">{money(s.total)}</b></div>
          </div>}
          <p className="muted small center">Discounts come off first, then service charge and GST, shared by what each person had. Shares add up exactly to {money(s.total)}.</p>
        </section>
      )}

      <footer className="foot"><span>Read-only link. Nothing to install.</span><Link href="/">Split your own bill</Link></footer>
    </main>
  );
}
