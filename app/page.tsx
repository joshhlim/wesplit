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
      {step === 2 && <AssignStep bill={bill} up={up} next={() => setStep(3)} detected={detected} total={result.total} unassigned={result.shares._} />}
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

function AssignStep({ bill, up, next, detected, total, unassigned }: { bill: Bill; up: (f: (b: Bill) => Bill) => void; next: () => void; detected: string | null; total: number; unassigned: number }) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; name: string } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const give = (itemId: string, pid: string) => up((b) => {
    const a = (b.assign[itemId] ||= {});
    if (pid === '*') { b.people.forEach((p) => (a[p.id] = 1)); } else a[pid] = a[pid] ? 0 : 1;
    return b;
  });
  const target = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('[data-pid]')?.getAttribute('data-pid') || null;

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => { setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY }); setHover(target(e.clientX, e.clientY)); };
    const end = (e: PointerEvent) => { const t = target(e.clientX, e.clientY); if (t) give(drag.id, t); setDrag(null); setHover(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  const sum = itemsSum(bill.items);
  return (
    <section>
      <div className="drop">
        {bill.people.map((p) => (
          <div key={p.id} data-pid={p.id} className={'target' + (hover === p.id ? ' hot' : '')}><Avatar p={p} /><small>{p.name}</small></div>
        ))}
        <div data-pid="*" className={'target' + (hover === '*' ? ' hot' : '')}><span className="av all">ALL</span><small>Everyone</small></div>
      </div>
      <p className="muted hint">Drag ⠿ onto a person, or tap an item for options.</p>
      <ul className="items">
        {bill.items.map((it) => {
          const a = bill.assign[it.id] || {};
          const who = bill.people.filter((p) => a[p.id] > 0);
          return (
            <li key={it.id} className={who.length ? '' : 'todo'}>
              <div className="irow">
                <span className="handle" onPointerDown={(e) => { e.preventDefault(); setDrag({ id: it.id, x: e.clientX, y: e.clientY, name: it.name }); }}>⠿</span>
                <input className="iname" value={it.name} aria-label="Item name" onChange={(e) => up((b) => { b.items.find((x) => x.id === it.id)!.name = e.target.value; return b; })} />
                <input className="iprice" inputMode="decimal" aria-label="Price" defaultValue={it.price.toFixed(2)} onBlur={(e) => { const v = parseFloat(e.target.value); up((b) => { b.items.find((x) => x.id === it.id)!.price = isNaN(v) ? 0 : Math.round(v * 100) / 100; return b; }); e.target.value = (isNaN(v) ? 0 : v).toFixed(2); }} />
                <button className="ghost sm" aria-label="Options" onClick={() => setOpen(open === it.id ? null : it.id)}>{open === it.id ? '▴' : '▾'}</button>
              </div>
              <div className="who">
                {who.map((p) => <Avatar key={p.id} p={p} size={24} />)}
                <select value="" aria-label="Assign to" onChange={(e) => e.target.value && give(it.id, e.target.value)}>
                  <option value="">{who.length ? 'Add / remove…' : 'Assign to…'}</option>
                  <option value="*">Everyone (split evenly)</option>
                  {bill.people.map((p) => <option key={p.id} value={p.id}>{a[p.id] ? '✓ ' : ''}{p.name}</option>)}
                </select>
              </div>
              {open === it.id && (
                <div className="opts">
                  {bill.people.map((p) => (
                    <div key={p.id} className="orow">
                      <Avatar p={p} size={24} /><span>{p.name}</span>
                      <Stepper value={a[p.id] || 0} set={(n) => up((b) => { (b.assign[it.id] ||= {})[p.id] = n; return b; })} />
                    </div>
                  ))}
                  <p className="muted">Shares: e.g. 2 and 1 means one person pays twice as much.</p>
                  <button className="link danger" onClick={() => up((b) => { b.items = b.items.filter((x) => x.id !== it.id); delete b.assign[it.id]; return b; })}>Delete item</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button className="link" onClick={() => up((b) => { b.items.push({ id: uid(), name: 'Item', qty: 1, price: 0 }); return b; })}>+ Add item</button>

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
      {drag && <div className="ghostitem" style={{ left: drag.x, top: drag.y }}>{drag.name}</div>}
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
            {p.id !== payer.id && valid && (shares[p.id] || 0) > 0 && <PayQR mobile={mobile} amount={shares[p.id]} who={p.name} />}
            {p.id === payer.id && <small className="muted">Paid the bill</small>}
          </li>
        ))}
      </ul>
      {shares._ > 0 && <p className="warn">{money(shares._)} is still unassigned.</p>}
      <button className="primary" onClick={async () => { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied ✓' : 'Copy summary'}</button>
    </section>
  );
}

function PayQR({ mobile, amount, who }: { mobile: string; amount: number; who: string }) {
  const [src, setSrc] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    QRCode.toDataURL(paynowPayload({ mobile, amount, ref: 'WeSplit ' + who }), { margin: 1, width: 240, color: { dark: '#7c1a78' } }).then(setSrc);
  }, [show, mobile, amount, who]);
  return show ? (
    <div className="qr" onClick={() => setShow(false)}>
      {src && <img src={src} alt={`PayNow QR for ${money(amount)}`} />}
      <small>Scan with any SG banking app · {money(amount)}</small>
    </div>
  ) : <button className="ghost sm paynow" onClick={() => setShow(true)}>Show PayNow QR</button>;
}
