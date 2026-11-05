'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { MODES, detectMode, split, itemsSum, paynowPayload, normalizeMobile } from '@/lib/split.mjs';

type Item = { id: string; name: string; qty: number | null; price: number };
type Person = { id: string; name: string; color: string };
type Assign = Record<string, Record<string, number>>;
type Mode = keyof typeof MODES;
type Bill = { merchant: string | null; total: number | null; items: Item[]; people: Person[]; assign: Assign; mode: Mode; payer: string };

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6', '#f97316', '#14b8a6'];
const NAMES = ['Me', 'Friend 1', 'Friend 2', 'Friend 3', 'Friend 4', 'Friend 5', 'Friend 6', 'Friend 7', 'Friend 8', 'Friend 9'];
const uid = () => Math.random().toString(36).slice(2, 9);
const money = (n: number) => 'S$' + n.toFixed(2);
const empty = (): Bill => ({ merchant: null, total: null, items: [], people: [{ id: uid(), name: 'Me', color: COLORS[0] }], assign: {}, mode: 'sg', payer: '' });
const STEPS = ['Scan', 'People', 'Assign', 'Settle'] as const;

async function shrink(file: File): Promise<Blob> {
  if (file.size < 1.5e6 && /jpeg|png|webp/.test(file.type)) return file;
  const img = await createImageBitmap(file);
  const s = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.85));
}

export default function Home() {
  const [bill, setBill] = useState<Bill>(empty);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mobile, setMobile] = useState('');
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    try {
      const b = localStorage.getItem('ws-bill'); if (b) setBill(JSON.parse(b));
      const s = localStorage.getItem('ws-step'); if (s) setStep(+s);
      setMobile(localStorage.getItem('ws-mobile') || '');
    } catch {}
    setTheme(document.documentElement.dataset.theme || 'light');
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { localStorage.setItem('ws-bill', JSON.stringify(bill)); localStorage.setItem('ws-step', String(step)); } }, [bill, step, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem('ws-mobile', mobile); }, [mobile, loaded]);
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; localStorage.setItem('ws-theme', t); };

  const up = (f: (b: Bill) => Bill) => setBill((b) => f(structuredClone(b)));

  async function scan(file: File) {
    setErr(''); setBusy(true);
    try {
      const fd = new FormData(); fd.append('image', await shrink(file), 'receipt.jpg');
      const r = await fetch('/api/scan', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({ error: 'Something went wrong.' }));
      if (!r.ok) throw new Error(d.error);
      const items: Item[] = d.items.map((i: { name: string; qty: number | null; price: number }) => ({ id: uid(), name: i.name, qty: i.qty, price: i.price }));
      up((b) => {
        const auto = detectMode(items, d.total) as Mode | null;
        return { ...b, merchant: d.merchant, total: d.total, items, assign: {}, mode: auto || (d.gst ? (d.serviceCharge ? 'sg' : 'gst') : 'sg') };
      });
      setStep(1);
    } catch (e) { setErr((e as Error).message || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  const result = useMemo(() => split(bill.items, bill.people, bill.assign, bill.mode, bill.total), [bill]);
  const detected = detectMode(bill.items, bill.total);

  return (
    <main>
      <header>
        <b className="logo">We<span>Split</span></b>
        <div className="row">
          {bill.items.length > 0 && <button className="ghost sm" onClick={() => { if (confirm('Start a new bill?')) { setBill(empty()); setStep(0); } }}>New</button>}
          <button className="ghost sm" aria-label="Toggle theme" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </header>
      <nav className="steps">
        {STEPS.map((s, i) => (
          <button key={s} className={i === step ? 'on' : ''} disabled={i > 0 && !bill.items.length} onClick={() => setStep(i)}>{i + 1}. {s}</button>
        ))}
      </nav>

      {step === 0 && <ScanStep busy={busy} err={err} onFile={scan} onManual={() => { up((b) => ({ ...b, items: [{ id: uid(), name: 'Item', qty: 1, price: 0 }] })); setStep(2); }} />}
      {step === 1 && <PeopleStep bill={bill} up={up} next={() => setStep(2)} />}
      {step === 2 && <AssignStep bill={bill} up={up} next={() => setStep(3)} detected={detected} total={result.total} unassigned={result.shares._} shares={result.shares} />}
      {step === 3 && <SettleStep bill={bill} up={up} shares={result.shares} total={result.total} mobile={mobile} setMobile={setMobile} />}
      <footer>Everything stays on this device.</footer>
    </main>
  );
}

function ScanStep({ busy, err, onFile, onManual }: { busy: boolean; err: string; onFile: (f: File) => void; onManual: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <section className="center">
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button className="big" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <><span className="spin" /> Reading receipt…</> : <><span className="cam">📷</span> Scan receipt</>}
      </button>
      <p className="muted">Take a photo or pick one from your gallery.</p>
      {err && <p className="err">{err}</p>}
      <button className="link" onClick={onManual}>or enter items by hand</button>
    </section>
  );
}

function Stepper({ value, set, min = 0, max = 99 }: { value: number; set: (n: number) => void; min?: number; max?: number }) {
  return (
    <span className="stepper">
      <button onClick={() => set(Math.max(min, value - 1))} aria-label="less">−</button>
      <b>{value}</b>
      <button onClick={() => set(Math.min(max, value + 1))} aria-label="more">+</button>
    </span>
  );
}

function Avatar({ p, size = 40 }: { p: Person; size?: number }) {
  return <span className="av" style={{ background: p.color, width: size, height: size, fontSize: size * 0.4 }}>{(p.name.trim().split(/\s+/).length > 1 ? p.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) : p.name.slice(0, 2)).toUpperCase() || '?'}</span>;
}

function PeopleStep({ bill, up, next }: { bill: Bill; up: (f: (b: Bill) => Bill) => void; next: () => void }) {
  const add = () => up((b) => { const n = b.people.length; if (n >= 10) return b; b.people.push({ id: uid(), name: NAMES.find((x) => !b.people.some((p) => p.name === x)) || `Friend ${n}`, color: COLORS[n % COLORS.length] }); return b; });
  return (
    <section>
      <h2>Who&apos;s splitting?</h2>
      <div className="chips">
        {bill.people.map((p) => (
          <div key={p.id} className="chip">
            <Avatar p={p} />
            <input value={p.name} aria-label="Name" onChange={(e) => up((b) => { b.people.find((x) => x.id === p.id)!.name = e.target.value.slice(0, 16); return b; })} />
            {bill.people.length > 1 && <button className="x" aria-label="Remove" onClick={() => up((b) => { b.people = b.people.filter((x) => x.id !== p.id); for (const a of Object.values(b.assign)) delete a[p.id]; return b; })}>×</button>}
          </div>
        ))}
        <button className="add" onClick={add} aria-label="Add person">+</button>
      </div>
      <p className="muted">Tap a name to rename. Default names are fine too.</p>
      <button className="primary" onClick={next}>Next: assign items →</button>
    </section>
  );
}

const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };
const ini = (n: string) => { const w = n.trim().split(/\s+/); return ((w.length > 1 ? w.map((x) => x[0]).join('') : n).slice(0, 2).toUpperCase()) || '?'; };

function AssignStep({ bill, up, next, detected, total, unassigned, shares }: { bill: Bill; up: (f: (b: Bill) => Bill) => void; next: () => void; detected: string | null; total: number; unassigned: number; shares: Record<string, number> }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);

  const toggle = (id: string, pid: string) => up((b) => {
    const a = (b.assign[id] ||= {});
    if (pid === '*') { const all = b.people.every((p) => a[p.id] > 0); b.people.forEach((p) => (a[p.id] = all ? 0 : a[p.id] || 1)); }
    else a[pid] = a[pid] ? 0 : 1;
    return b;
  });
  const startPress = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('button,input,select')) return;
    const t = window.setTimeout(() => { buzz(15); setSheet(id); press.current = null; }, 450);
    press.current = { t, x: e.clientX, y: e.clientY };
  };
  const movePress = (e: React.PointerEvent) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { clearTimeout(p.t); press.current = null; } };
  const endPress = () => { if (press.current) { clearTimeout(press.current.t); press.current = null; } };

  const done = bill.items.filter((it) => Object.values(bill.assign[it.id] || {}).some((w) => w > 0)).length;
  const sum = itemsSum(bill.items);
  const sheetItem = sheet ? bill.items.find((i) => i.id === sheet) : null;

  return (
    <section className="assign2">
      <div className="progress"><div style={{ width: `${bill.items.length ? (done / bill.items.length) * 100 : 0}%` }} /></div>
      <p className="muted hint">{done === bill.items.length ? '✓ All items assigned' : `${done} of ${bill.items.length} assigned · tap who had each item`}</p>
      <ul className="rlist">
        {bill.items.map((it) => {
          const a = bill.assign[it.id] || {};
          const who = bill.people.filter((p) => a[p.id] > 0);
          const all = who.length === bill.people.length && who.length > 0;
          const cls = 'ritem' + (who.length ? '' : ' todo') + (focus ? (a[focus] > 0 ? ' hl' : ' faded') : '');
          return (
            <li key={it.id} className={cls} onPointerDown={(e) => startPress(e, it.id)} onPointerMove={movePress} onPointerUp={endPress} onPointerCancel={endPress} onContextMenu={(e) => e.preventDefault()}>
              <span className="strip">{who.map((p) => <i key={p.id} style={{ background: p.color, flex: a[p.id] }} />)}</span>
              <div className="rhead">
                <span className="rname">{it.name}</span>
                <span className="rprice">{money(it.price)}</span>
                <button className="more" aria-label={`Edit ${it.name}`} onClick={() => setSheet(it.id)}>⋯</button>
              </div>
              <div className="bubbles">
                {bill.people.map((p) => {
                  const w = a[p.id] || 0;
                  return (
                    <button key={p.id} className={'bub' + (w ? ' on' : '')} style={{ ['--pc' as string]: p.color }} aria-pressed={w > 0} aria-label={`${p.name}${w ? ' (selected)' : ''}`}
                      onClick={() => { buzz(w ? 6 : 12); toggle(it.id, p.id); }}>
                      {ini(p.name)}{w > 0 && <span className="chk">{w > 1 ? '×' + w : '✓'}</span>}
                    </button>
                  );
                })}
                <button className={'bub allb' + (all ? ' on' : '')} aria-pressed={all} aria-label="Everyone" onClick={() => { buzz(12); toggle(it.id, '*'); }}>All{all && <span className="chk">✓</span>}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button className="link" onClick={() => { const id = uid(); up((b) => { b.items.push({ id, name: 'Item', qty: 1, price: 0 }); return b; }); setSheet(id); }}>+ Add item</button>

      <div className="card charges">
        <div className="orow"><span>Items</span><b>{money(sum)}</b></div>
        <div className="orow">
          <span>Charges</span>
          <select value={bill.mode} onChange={(e) => up((b) => ({ ...b, mode: e.target.value as Mode }))}>
            {Object.entries(MODES).map(([k, m]) => <option key={k} value={k}>{m.label}{detected === k ? ' (detected)' : ''}</option>)}
          </select>
        </div>
        <div className="orow"><span>Total</span><b>{money(total)}</b></div>
        {bill.total != null && Math.abs(bill.total - total) > 0.01 && <p className="warn">Receipt says {money(bill.total)}. Check items or charges.</p>}
        {unassigned > 0 && <p className="warn">{money(unassigned)} not assigned yet.</p>}
      </div>
      <button className="primary" onClick={next}>Next: settle up →</button>

      <div className="totbar" role="toolbar" aria-label="Totals per person">
        {bill.people.map((p) => (
          <button key={p.id} className={'tot' + (focus === p.id ? ' on' : '')} style={{ ['--pc' as string]: p.color }} aria-pressed={focus === p.id}
            onClick={() => { buzz(6); setFocus((f) => (f === p.id ? null : p.id)); }}>
            <Avatar p={p} size={28} /><span><small>{p.name}</small><b>{money(shares[p.id] || 0)}</b></span>
          </button>
        ))}
      </div>

      {sheetItem && (
        <div className="backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="irow">
              <input className="iname" value={sheetItem.name} aria-label="Item name" onChange={(e) => up((b) => { b.items.find((x) => x.id === sheetItem.id)!.name = e.target.value; return b; })} />
              <input className="iprice" inputMode="decimal" aria-label="Price" defaultValue={sheetItem.price.toFixed(2)} onBlur={(e) => { const v = parseFloat(e.target.value); up((b) => { b.items.find((x) => x.id === sheetItem.id)!.price = isNaN(v) ? 0 : Math.round(v * 100) / 100; return b; }); }} />
            </div>
            <select value="" aria-label="Assign to" onChange={(e) => e.target.value && toggle(sheetItem.id, e.target.value)}>
              <option value="">Assign to…</option>
              <option value="*">Everyone (split evenly)</option>
              {bill.people.map((p) => <option key={p.id} value={p.id}>{bill.assign[sheetItem.id]?.[p.id] ? '✓ ' : ''}{p.name}</option>)}
            </select>
            {bill.people.map((p) => {
              const w = bill.assign[sheetItem.id]?.[p.id] || 0;
              return (
                <div key={p.id} className="orow">
                  <Avatar p={p} size={28} /><span className="grow">{p.name}</span>
                  <Stepper value={w} set={(n) => { buzz(6); up((b) => { (b.assign[sheetItem.id] ||= {})[p.id] = n; return b; }); }} />
                </div>
              );
            })}
            <p className="muted">Shares: 2 and 1 means one person pays twice as much.</p>
            <div className="row between">
              <button className="link danger" onClick={() => { up((b) => { b.items = b.items.filter((x) => x.id !== sheetItem.id); delete b.assign[sheetItem.id]; return b; }); setSheet(null); }}>Delete item</button>
              <button className="ghost" onClick={() => setSheet(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SettleStep({ bill, up, shares, total, mobile, setMobile }: { bill: Bill; up: (f: (b: Bill) => Bill) => void; shares: Record<string, number>; total: number; mobile: string; setMobile: (s: string) => void }) {
  const payer = bill.people.find((p) => p.id === bill.payer) || bill.people[0];
  const valid = normalizeMobile(mobile);
  const [copied, setCopied] = useState(false);
  const summary = [
    `${bill.merchant || 'Bill'}: ${money(total)} (${MODES[bill.mode as Mode].label})`,
    ...bill.people.map((p) => `${p.name}: ${money(shares[p.id] || 0)}${p.id === payer.id ? ' (paid)' : ''}`),
    ...(shares._ ? [`Unassigned: ${money(shares._)}`] : []),
    valid ? `PayNow ${payer.name}: ${valid}` : '',
  ].filter(Boolean).join('\n');
  return (
    <section>
      <div className="card">
        <div className="orow"><span>Who paid?</span>
          <select value={payer.id} onChange={(e) => up((b) => ({ ...b, payer: e.target.value }))}>
            {bill.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="orow"><span>{payer.name}&apos;s PayNow mobile</span>
          <input className="mobile" inputMode="tel" placeholder="8123 4567" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d +]/g, '').slice(0, 14))} />
        </div>
        {mobile && !valid && <p className="warn">Enter an 8-digit SG mobile number.</p>}
      </div>
      <ul className="settle">
        {bill.people.map((p) => (
          <li key={p.id}>
            <div className="orow"><span className="row"><Avatar p={p} size={32} /> {p.name}</span><b>{money(shares[p.id] || 0)}</b></div>
            {p.id !== payer.id && valid && (shares[p.id] || 0) > 0 && <PayQR mobile={mobile} amount={shares[p.id]} who={p.name} payer={payer.name} place={bill.merchant || 'the bill'} />}
            {p.id === payer.id && <small className="muted">Paid the bill</small>}
          </li>
        ))}
      </ul>
      {shares._ > 0 && <p className="warn">{money(shares._)} is still unassigned.</p>}
      {valid && <ShareAll list={bill.people.filter((p) => p.id !== payer.id && (shares[p.id] || 0) > 0).map((p) => ({ name: p.name, amount: shares[p.id] }))} mobile={mobile} payer={payer.name} place={bill.merchant || 'the bill'} summary={summary} />}
      <button className="primary" onClick={async () => { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy summary'}</button>
    </section>
  );
}


const APP_URL = 'https://wesplit-sg.vercel.app';
const shareText = (who: string, place: string, amount: number, payer: string, mobile: string) =>
  `Hi ${who}, your share for ${place} is $${amount.toFixed(2)}. Scan to PayNow ${payer} (${normalizeMobile(mobile)}).`;
const waLink = (t: string) => 'https://wa.me/?text=' + encodeURIComponent(t);
const tgLink = (t: string) => 'https://t.me/share/url?url=' + encodeURIComponent(APP_URL) + '&text=' + encodeURIComponent(t);
const safe = (s: string) => s.replace(/[^\w-]+/g, '_');

type Entry = { name: string; amount: number };
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function fit(c: CanvasRenderingContext2D, t: string, w: number) { while (t.length > 3 && c.measureText(t).width > w) t = t.slice(0, -2) + '…'; return t; }

// Draw share cards (one per entry) on a single PNG: clean app style, white card, PayNow-purple QR.
async function makeCard(list: Entry[], o: { mobile: string; payer: string; place: string }): Promise<Blob> {
  const W = 720, CH = 860, PAD = 40;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = 150 + list.length * (CH + 30) + 60;
  const c = cv.getContext('2d')!;
  const F = 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
  c.fillStyle = '#f7f8fa'; c.fillRect(0, 0, cv.width, cv.height);
  c.textBaseline = 'alphabetic';
  c.font = `800 44px ${F}`; c.fillStyle = '#111827'; c.fillText('We', PAD, 80);
  const ww = c.measureText('We').width; c.fillStyle = '#10b981'; c.fillText('Split', PAD + ww, 80);
  c.font = `500 26px ${F}`; c.fillStyle = '#6b7280'; c.fillText(fit(c, o.place, W - 2 * PAD), PAD, 122);
  let y = 150;
  for (const e of list) {
    c.fillStyle = '#fff'; rr(c, PAD, y, W - 2 * PAD, CH, 32); c.fill();
    c.strokeStyle = '#e5e7eb'; c.lineWidth = 2; c.stroke();
    c.textAlign = 'center';
    c.font = `600 34px ${F}`; c.fillStyle = '#111827'; c.fillText(fit(c, e.name, W - 4 * PAD), W / 2, y + 70);
    c.font = `800 72px ${F}`; c.fillStyle = '#10b981'; c.fillText('S$' + e.amount.toFixed(2), W / 2, y + 155);
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, paynowPayload({ mobile: o.mobile, amount: e.amount, ref: 'WeSplit ' + e.name }), { margin: 1, width: 480, color: { dark: '#7c1a78' } });
    c.drawImage(qr, (W - 480) / 2, y + 190, 480, 480);
    c.font = `600 28px ${F}`; c.fillStyle = '#7c1a78'; c.fillText(fit(c, `PayNow to ${o.payer}`, W - 4 * PAD), W / 2, y + 725);
    c.font = `500 24px ${F}`; c.fillStyle = '#6b7280'; c.fillText(normalizeMobile(o.mobile) || '', W / 2, y + 765);
    c.fillText('Scan with any SG banking app', W / 2, y + 805);
    c.textAlign = 'left';
    y += CH + 30;
  }
  c.font = `500 20px ${F}`; c.fillStyle = '#9ca3af'; c.textAlign = 'center'; c.fillText('wesplit-sg.vercel.app', W / 2, cv.height - 28);
  return new Promise((r) => cv.toBlob((b) => r(b!), 'image/png'));
}

function canShareFiles(f: File) { try { return !!navigator.canShare?.({ files: [f] }); } catch { return false; } }

function ShareRow({ make, text, file }: { make: () => Promise<Blob>; text: string; file: string }) {
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    try {
      const f = new File([await make()], file, { type: 'image/png' });
      if (canShareFiles(f)) await navigator.share({ files: [f], text });
      else setFallback(true);
    } catch (e) { if ((e as Error).name !== 'AbortError') setFallback(true); }
    finally { setBusy(false); }
  }
  async function download() {
    const u = URL.createObjectURL(await make());
    const a = document.createElement('a'); a.href = u; a.download = file; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }
  return (
    <div className="share">
      <button className="ghost sm" disabled={busy} onClick={share} aria-label="Share">⤴ Share</button>
      {fallback && <>
        <a className="ghost sm wa" href={waLink(text)} target="_blank" rel="noopener">WhatsApp</a>
        <a className="ghost sm tg" href={tgLink(text)} target="_blank" rel="noopener">Telegram</a>
        <button className="ghost sm" onClick={download} aria-label="Download QR">⬇ QR</button>
      </>}
    </div>
  );
}

function PayQR({ mobile, amount, who, payer, place }: { mobile: string; amount: number; who: string; payer: string; place: string }) {
  const [src, setSrc] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    QRCode.toDataURL(paynowPayload({ mobile, amount, ref: 'WeSplit ' + who }), { margin: 1, width: 240, color: { dark: '#7c1a78' } }).then(setSrc);
  }, [show, mobile, amount, who]);
  const text = shareText(who, place, amount, payer, mobile);
  return (
    <>
      {show ? (
        <div className="qr" onClick={() => setShow(false)}>
          {src && <img src={src} alt={`PayNow QR for ${money(amount)}`} />}
          <small>Scan with any SG banking app · {money(amount)}</small>
        </div>
      ) : <button className="ghost sm paynow" onClick={() => setShow(true)}>Show PayNow QR</button>}
      <ShareRow make={() => makeCard([{ name: who, amount }], { mobile, payer, place })} text={text} file={`WeSplit-${safe(who)}.png`} />
    </>
  );
}

function ShareAll({ list, mobile, payer, place, summary }: { list: Entry[]; mobile: string; payer: string; place: string; summary: string }) {
  if (list.length < 2) return null;
  return (
    <div className="card shareall">
      <div className="orow"><b>Share with the group</b></div>
      <ShareRow make={() => makeCard(list, { mobile, payer, place })} text={summary} file="WeSplit-all.png" />
    </div>
  );
}
