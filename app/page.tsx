'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, ChevronLeft, Plus, Minus, X, Check, Ellipsis, Sun, Moon, Share2, Download, Copy, Trash2, Lock, Receipt, CircleAlert, RotateCcw, MessageCircle, Send, PenLine, WifiOff, ArrowRight, QrCode, Users } from 'lucide-react';
import { MODES, detectMode, split, itemsSum, paynowPayload, normalizeMobile } from '@/lib/split.mjs';
import { Mark } from '@/components/brand';
import { History as HistoryIc, CircleCheck, Circle, Bell, UserRound, Mail, LogOut, Cloud, CloudOff } from 'lucide-react';
import { supa } from '@/lib/supabase';
import { syncAll } from '@/lib/sync';
import { createShare, updateShare, revokeShare, shareUrl, snapshotOf, type ShareRef } from '@/lib/share';
import { Link2, Link2Off } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

type Rec = { updatedAt?: number; items?: { name: string; qty: number | null; price: number; who: string[] }[]; share?: ShareRef; id: string; place: string; date: string; total: number; mode: string; payee: { mobile: string; name: string }; people: { id: string; name: string; color: string; share: number; paid: boolean }[] };
type Friend = { name: string; color: string; count: number };
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

type Item = { id: string; name: string; qty: number | null; price: number };
type Person = { id: string; name: string; color: string };
type Assign = Record<string, Record<string, number>>;
type Mode = keyof typeof MODES;
type Bill = { id?: string; merchant: string | null; total: number | null; items: Item[]; people: Person[]; assign: Assign; mode: Mode; payer: string };
type Up = (f: (b: Bill) => Bill) => void;
type Toast = { msg: string; undo?: () => void } | null;

// Person colours: all pass WCAG AA with white initials.
const COLORS = ['#0B7A5A', '#4F46E5', '#B45309', '#C81E1E', '#0E7490', '#BE185D', '#4D7C0F', '#7C3AED', '#C2410C', '#475569'];
const NAMES = ['Friend 1', 'Friend 2', 'Friend 3', 'Friend 4', 'Friend 5', 'Friend 6', 'Friend 7', 'Friend 8', 'Friend 9'];
const STEPS = ['Scan', 'People', 'Assign', 'Settle'] as const;
const REPO = 'https://github.com/joshhlim/wesplit';
const APP_URL = 'https://wesplit-sg.vercel.app';
const uid = () => Math.random().toString(36).slice(2, 9);
const money = (n: number) => 'S$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
const ini = (n: string) => { if (n.trim().toLowerCase() === 'you') return 'You'; const w = n.trim().split(/\s+/); return ((w.length > 1 ? w.map((x) => x[0]).join('') : n).slice(0, 2).toUpperCase()) || '?'; };
const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch {} };
const empty = (): Bill => ({ id: uid(), merchant: null, total: null, items: [], people: [{ id: 'me', name: 'You', color: COLORS[0] }], assign: {}, mode: 'sg', payer: '' });

// Lightweight proof of work: find a nonce so sha256("ts.nonce.size") starts with 14 zero bits (~16k hashes).
async function proofOfWork(size: number) {
  const ts = Date.now(), enc = new TextEncoder();
  for (let n = 0; n < 2_000_000; n++) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${ts}.${n}.${size}`)));
    if (h[0] === 0 && h[1] < 4) return `${ts}.${n}`;
  }
  return `${ts}.0`;
}

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
  const [dir, setDir] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [payee, setPayee] = useState<Payee>({ mobile: '', name: '' });
  const [theme, setTheme] = useState('light');
  const [toast, setToastState] = useState<Toast>(null);
  const [history, setHistory] = useState<Rec[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [view, setView] = useState<null | 'history' | string>(null);
  const tt = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [acct, setAcct] = useState(false);
  const [sync, setSync] = useState<'idle' | 'busy' | 'ok' | 'off' | 'err'>('idle');
  const syncing = useRef(false), again = useRef(false), st = useRef(0), latest = useRef({ history, friends, payee });
  latest.current = { history, friends, payee };
  const runSync = useCallback(async () => {
    const sb = supa(); if (!sb || !user) return;
    if (!navigator.onLine) { setSync('off'); return; }
    if (syncing.current) { again.current = true; return; }
    syncing.current = true; setSync('busy');
    try {
      const out = await syncAll(sb, user.id, latest.current);
      const same = JSON.stringify(out.history) === JSON.stringify(latest.current.history) && JSON.stringify(out.friends) === JSON.stringify(latest.current.friends);
      if (!same) { setHistory(out.history as Rec[]); setFriends(out.friends); }
      if (out.payee.mobile !== latest.current.payee.mobile) setPayee(out.payee);
      setSync('ok');
    } catch { setSync(navigator.onLine ? 'err' : 'off'); }
    syncing.current = false;
    if (again.current) { again.current = false; runSync(); }
  }, [user]);
  useEffect(() => {
    const sb = supa(); if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    const q = new URLSearchParams(location.search);
    if (q.has('signedin') || q.has('authError')) {
      if (q.get('authError')) setTimeout(() => notify({ msg: q.get('authError')! }), 50); else setTimeout(() => notify({ msg: 'Signed in. Your bills will sync.' }), 50);
      window.history.replaceState(null, '', '/');
    }
    return () => sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!user || !loaded) return; clearTimeout(st.current); st.current = window.setTimeout(runSync, 1200); }, [user, loaded, history, friends, payee, runSync]);
  // Keep public share links in step with the bill (paid status, edits). Retries on the next change if offline.
  const shareT = useRef(0);
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(shareT.current);
    shareT.current = window.setTimeout(async () => {
      const sigs: Record<string, string> = load('ws-share-sig', {});
      for (const r of history) {
        if (!r.share) continue;
        const sig = JSON.stringify(snapshotOf(r));
        if (sigs[r.share.id] === sig) continue;
        try { await updateShare(r.share, r); sigs[r.share.id] = sig; } catch {}
      }
      localStorage.setItem('ws-share-sig', JSON.stringify(sigs));
    }, 800);
  }, [history, loaded]);
  useEffect(() => { const on = () => runSync(), off = () => setSync('off'); addEventListener('online', on); addEventListener('offline', off); return () => { removeEventListener('online', on); removeEventListener('offline', off); }; }, [runSync]);

  useEffect(() => {
    try {
      const b = localStorage.getItem('ws-bill');
      setHistory(load('ws-history', [])); setFriends(load('ws-friends', []));
      if (b) { const x: Bill = JSON.parse(b); if (!x.id) x.id = uid(); if (x.people?.[0] && x.people[0].name === 'Me') x.people[0].name = 'You'; if (!x.people?.length) x.people = empty().people; setBill(x); }
      const pe = localStorage.getItem('ws-payee'); if (pe) setPayee(JSON.parse(pe));
      else { const m = localStorage.getItem('ws-mobile'); if (m && normalizeMobile(m)) setPayee({ mobile: normalizeMobile(m)!, name: '' }); }
      const s = localStorage.getItem('ws-step'); if (s) setStep(+s);
    } catch {}
    setTheme(document.documentElement.dataset.theme || 'light');
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) { localStorage.setItem('ws-bill', JSON.stringify(bill)); localStorage.setItem('ws-step', String(step)); } }, [bill, step, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem('ws-payee', JSON.stringify(payee)); }, [payee, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem('ws-history', JSON.stringify(history)); }, [history, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem('ws-friends', JSON.stringify(friends)); }, [friends, loaded]);
  useEffect(() => { if ('serviceWorker' in navigator && location.hostname !== 'localhost') navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  const saveRec = useCallback((r: Rec) => {
    setHistory((h) => {
      const old = h.find((x) => x.id === r.id);
      if (!old) setFriends((fs) => {
        const out = [...fs];
        for (const p of r.people.slice(1)) { const f = out.find((x) => x.name.toLowerCase() === p.name.trim().toLowerCase()); if (f) { f.count++; f.color = p.color; } else if (p.name.trim() && !/^Friend \d+$/.test(p.name)) out.push({ name: p.name.trim(), color: p.color, count: 1 }); }
        return out;
      });
      const merged = { ...r, share: old?.share, date: old?.date || r.date, updatedAt: Date.now(), people: r.people.map((p) => ({ ...p, paid: old?.people.find((q) => q.id === p.id)?.paid || false })) };
      return [merged, ...h.filter((x) => x.id !== r.id)];
    });
  }, []);

  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; localStorage.setItem('ws-theme', t); };
  const up: Up = useCallback((f) => setBill((b) => f(structuredClone(b))), []);
  const notify = useCallback((t: Toast) => { clearTimeout(tt.current); setToastState(t); if (t) tt.current = window.setTimeout(() => setToastState(null), t.undo ? 4000 : 2500); }, []);
  const go = (n: number) => { setView(null); setDir(n >= step ? 1 : -1); setStep(n); window.scrollTo({ top: 0 }); };

  async function scan(file: File) {
    setErr('');
    if (!navigator.onLine) { setErr("You're offline. Connect to the internet to scan, or enter items yourself."); return; }
    setBusy(true);
    try {
      const img = await shrink(file);
      const fd = new FormData(); fd.append('image', img, 'receipt.jpg'); fd.append('pow', await proofOfWork(img.size));
      const r = await fetch('/api/scan', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({ error: 'Something went wrong. Please try again.' }));
      if (!r.ok) throw new Error(d.error);
      if (!d.items?.length) throw new Error("We couldn't find any items. Try a sharper photo, or enter them yourself.");
      const items: Item[] = d.items.map((i: { name: string; qty: number | null; price: number }) => ({ id: uid(), name: i.name, qty: i.qty, price: i.price }));
      up((b) => {
        const auto = detectMode(items, d.total) as Mode | null;
        return { ...b, merchant: d.merchant, total: d.total, items, assign: {}, mode: auto || (d.gst ? (d.serviceCharge ? 'sg' : 'gst') : 'sg') };
      });
      go(1);
    } catch (e) {
      const m = (e as Error).message;
      setErr(m && !/fetch|network/i.test(m) ? m : "We couldn't reach WeSplit. Check your connection and try again.");
    } finally { setBusy(false); }
  }
  const newBill = () => {
    const prev = { bill, step };
    setBill(empty()); go(0);
    notify({ msg: 'Started a new bill', undo: () => { setBill(prev.bill); setStep(prev.step); } });
  };

  const result = useMemo(() => split(bill.items, bill.people, bill.assign, bill.mode, bill.total), [bill]);
  const detected = detectMode(bill.items, bill.total);
  const can = (i: number) => i === 0 || bill.items.length > 0;

  return (
    <main className={step === 2 ? 'has-bar' : ''}>
      <header className="top">
        {view ? <button className="icon-btn" aria-label="Back" onClick={() => setView(view === 'history' ? null : 'history')}><ChevronLeft size={22} /></button>
          : step > 0 ? <button className="icon-btn" aria-label="Back" onClick={() => go(step - 1)}><ChevronLeft size={22} /></button>
          : <span className="brand"><Mark size={28} />{!toast && <b>WeSplit</b>}</span>}
        {toast ? (
          <div className="toast" role="status">
            <span>{toast.msg}</span>
            {toast.undo && <button onClick={() => { toast.undo!(); notify(null); }}>Undo</button>}
          </div>
        ) : (view || step > 0) && <span className="title">{view ? 'History' : STEPS[step]}</span>}
        <div className="row gap4">
          {loaded && supa() && <button className={'icon-btn acct' + (user ? ' in' : '')} aria-label={user ? 'Account' : 'Sign in'} onClick={() => setAcct(true)}>{user ? (user.email || '?')[0].toUpperCase() : <UserRound size={18} />}</button>}
          {!view && bill.items.length > 0 && <button className="icon-btn" aria-label="New bill" onClick={newBill}><RotateCcw size={18} /></button>}
          <button className="icon-btn" aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </header>
      {view ? <div className="screen fwd">{view === 'history'
        ? <HistoryList history={history} open={(id) => setView(id)} />
        : <BillDetail rec={history.find((r) => r.id === view)} setHistory={setHistory} notify={notify} close={() => setView('history')} />}</div> : <>
      <nav className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s} className={'step' + (i === step ? ' on' : '') + (i < step ? ' done' : '')} disabled={!can(i)} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
            <span className="bar" /><span className="lbl">{s}</span>
          </button>
        ))}
      </nav>

      <div key={step} className={'screen ' + (dir > 0 ? 'fwd' : 'back')}>
        {step === 0 && <ScanStep busy={busy} err={err} onFile={scan} hasBill={bill.items.length > 0} resume={() => go(2)} openHistory={() => setView('history')} owed={history.reduce((s, r) => s + r.people.slice(1).filter((p) => !p.paid).reduce((a, p) => a + Math.round(p.share * 100), 0), 0) / 100}
          onManual={() => { up((b) => ({ ...b, merchant: null, total: null, assign: {}, items: [{ id: uid(), name: 'Item 1', qty: 1, price: 0 }] })); go(1); }} />}
        {step === 1 && <PeopleStep bill={bill} up={up} notify={notify} next={() => go(2)} friends={friends} setFriends={setFriends} />}
        {step === 2 && <AssignStep bill={bill} up={up} notify={notify} next={() => go(3)} detected={detected} total={result.total} shares={result.shares} />}
        {step === 3 && <SettleStep bill={bill} notify={notify} shares={result.shares} total={result.total} payee={payee} setPayee={setPayee} saveRec={saveRec} />}
      </div></>}

      <footer className="foot">
        <span><Lock size={12} /> {user ? 'Synced privately to your account.' : 'Your data stays on your phone.'}</span>
        <a href="/privacy">Privacy</a>
        <a href={REPO} target="_blank" rel="noopener">Source on GitHub</a>
      </footer>
      {acct && <AccountSheet user={user} sync={sync} close={() => setAcct(false)} notify={notify} />}
    </main>
  );
}

function AccountSheet({ user, sync, close, notify }: { user: User | null; sync: string; close: () => void; notify: (t: Toast) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(0);
  useEffect(() => { if (confirm > 1) { const t = setTimeout(() => setConfirm((c) => c - 1), 1000); return () => clearTimeout(t); } }, [confirm]);
  const sb = supa()!;
  const cb = location.origin + '/auth/callback';
  const google = async () => {
    setErr(''); const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cb } });
    if (error) setErr(/not enabled|provider/i.test(error.message) ? 'Google sign-in isn\'t switched on yet. Use the email link for now.' : error.message);
  };
  const magic = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: cb } });
    setBusy(false);
    if (error) setErr(/rate/i.test(error.message) ? 'Too many emails sent. Try again in a little while.' : error.message); else setSent(true);
  };
  const out = async () => { await sb.auth.signOut(); close(); notify({ msg: 'Signed out. Bills stay on this phone.' }); };
  const del = () => {
    close();
    let undone = false;
    notify({ msg: 'Deleting your account…', undo: () => { undone = true; } });
    setTimeout(async () => {
      if (undone) return;
      const { error } = await sb.rpc('delete_my_account');
      if (error) { notify({ msg: "Couldn't delete your account. Try again." }); return; }
      await sb.auth.signOut();
      notify({ msg: 'Account and synced data deleted.' });
    }, 4200);
  };
  const status = sync === 'busy' ? 'Syncing…' : sync === 'off' ? 'Offline. Will sync when you\'re back.' : sync === 'err' ? 'Sync paused. Retrying soon.' : 'All bills synced';
  return (
    <div className="backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={user ? 'Account' : 'Sign in'} onClick={(e) => e.stopPropagation()}>
        <span className="grabber" />
        <button className="icon-btn sheet-x" aria-label="Close" onClick={close}><X size={18} /></button>
        {!user ? sent ? <div className="sheet-body center">
            <span className="sheet-ic"><Mail size={26} /></span>
            <h2>Check your email</h2>
            <p className="muted">We sent a sign-in link to <b>{email}</b>. Open it on this phone.</p>
            <button className="btn ghost" onClick={() => setSent(false)}>Use a different email</button>
          </div> : <div className="sheet-body">
            <h2>Keep your bills everywhere</h2>
            <p className="muted">Sign in to sync bills, paid status and friends across your devices. Optional. WeSplit works fine without it.</p>
            <button className="btn google" onClick={google}><GoogleG /> Continue with Google</button>
            <div className="or"><span>or</span></div>
            <form onSubmit={magic} className="col gap8" noValidate>
              <input className="pill-input" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
              <button className="btn primary" disabled={busy}><Mail size={18} /> {busy ? 'Sending…' : 'Email me a link'}</button>
            </form>
            {err && <p className="err" role="alert"><CircleAlert size={14} /> {err}</p>}
            <p className="fine">Bills already on this phone are added to your account. <a href="/privacy">Privacy</a></p>
          </div>
          : <div className="sheet-body">
            <div className="who"><span className="acct in big">{(user.email || '?')[0].toUpperCase()}</span><div><b>{user.email}</b><span className="muted">{sync === 'off' || sync === 'err' ? <CloudOff size={13} /> : <Cloud size={13} />} {status}</span></div></div>
            <button className="btn ghost" onClick={out}><LogOut size={18} /> Sign out</button>
            {!confirm ? <button className="btn danger-link" onClick={() => setConfirm(4)}><Trash2 size={16} /> Delete account and data</button>
              : <div className="confirm">
                <p><b>Delete your account?</b> This removes your synced bills, friends and PayNow details from our servers. Bills on this phone stay.</p>
                <div className="row gap8"><button className="btn ghost" onClick={() => setConfirm(0)}>Keep account</button><button className="btn del" disabled={confirm > 1} onClick={del}>{confirm > 1 ? `Delete (${confirm - 1})` : 'Delete'}</button></div>
              </div>}
            <p className="fine"><a href="/privacy">What we store</a></p>
          </div>}
      </div>
    </div>
  );
}
const GoogleG = () => <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;

/* ---------- shared bits ---------- */
function Avatar({ p, size = 40 }: { p: Person; size?: number }) {
  return <span className="av" style={{ background: p.color, width: size, height: size, fontSize: Math.round(size * 0.36) }}>{ini(p.name) === "You" ? "You" : ini(p.name)}</span>;
}
function Stepper({ value, set, min = 0, max = 20, label }: { value: number; set: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button onClick={() => set(Math.max(min, value - 1))} aria-label="Decrease" disabled={value <= min}><Minus size={16} /></button>
      <b className="num">{value}</b>
      <button onClick={() => set(Math.min(max, value + 1))} aria-label="Increase" disabled={value >= max}><Plus size={16} /></button>
    </span>
  );
}

/* ---------- 1. Scan ---------- */
function ScanStep({ busy, err, onFile, onManual, hasBill, resume, openHistory, owed }: { busy: boolean; err: string; onFile: (f: File) => void; onManual: () => void; hasBill: boolean; resume: () => void; openHistory: () => void; owed: number }) {
  const ref = useRef<HTMLInputElement>(null);
  if (busy) return (
    <section className="stack">
      <div className="skel-receipt" aria-busy="true" aria-label="Reading receipt">
        <div className="sk w40 h16" /><div className="sk w60" />
        <hr />
        {[70, 55, 80, 45, 65].map((w, i) => <div key={i} className="sk-row"><div className="sk" style={{ width: w + '%' }} /><div className="sk w15" /></div>)}
        <hr />
        <div className="sk-row"><div className="sk w30" /><div className="sk w20 h16" /></div>
      </div>
      <p className="muted center">Reading your receipt…</p>
    </section>
  );
  return (
    <section className="stack">
      <div className="hero">
        <h1>Split a bill</h1>
        <p className="muted">Snap the receipt. We&apos;ll list the items for you.</p>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button className="scan-tile" onClick={() => ref.current?.click()}>
        <span className="scan-ic"><Camera size={28} /></span>
        <b>Scan receipt</b>
        <span className="muted">Take a photo or choose one</span>
      </button>
      {err && <div className="alert" role="alert">{/offline/i.test(err) ? <WifiOff size={18} /> : <CircleAlert size={18} />}<span>{err}</span></div>}
      <button className="btn ghost" onClick={onManual}><PenLine size={18} /> Enter items yourself</button>
      {hasBill && <button className="btn ghost" onClick={resume}>Continue current bill <ArrowRight size={18} /></button>}
      <button className="btn ghost" onClick={openHistory}><HistoryIc size={18} /> History{owed > 0 && <span className="pill-num num">{money(owed)} owed</span>}</button>
    </section>
  );
}

/* ---------- 2. People ---------- */
function PeopleStep({ bill, up, notify, next, friends, setFriends }: { bill: Bill; up: Up; notify: (t: Toast) => void; next: () => void; friends: Friend[]; setFriends: (f: Friend[] | ((f: Friend[]) => Friend[])) => void }) {
  const [manage, setManage] = useState(false);
  const inBill = new Set(bill.people.map((p) => p.name.trim().toLowerCase()));
  const sugg = [...friends].sort((a, b) => b.count - a.count).filter((f) => !inBill.has(f.name.toLowerCase()));
  const addFriend = (f: Friend) => { buzz(10); up((b) => { if (b.people.length >= 10) return b; const used = new Set(b.people.map((p) => p.color)); b.people.push({ id: uid(), name: f.name, color: used.has(f.color) ? COLORS.find((c) => !used.has(c)) || f.color : f.color }); return b; }); };
  const forget = (f: Friend) => { const snap = friends; setFriends((fs) => fs.filter((x) => x.name !== f.name)); notify({ msg: `Forgot ${f.name}`, undo: () => setFriends(snap) }); };
  const add = () => { buzz(8); up((b) => { const n = b.people.length; if (n >= 10) return b; const used = new Set(b.people.map((p) => p.color)); b.people.push({ id: uid(), name: NAMES.find((x) => !b.people.some((p) => p.name === x)) || `Friend ${n}`, color: COLORS.find((c) => !used.has(c)) || COLORS[n % 10] }); return b; }); };
  const remove = (p: Person) => {
    const snap = structuredClone(bill);
    up((b) => { b.people = b.people.filter((x) => x.id !== p.id); for (const a of Object.values(b.assign)) delete a[p.id]; return b; });
    notify({ msg: `Removed ${p.name}`, undo: () => up(() => snap) });
  };
  return (
    <section className="stack">
      <div className="hero"><h1>Who&apos;s splitting?</h1><p className="muted">Add everyone at the table. Tap a name to change it.</p></div>
      <ul className="people">
        {bill.people.map((p, i) => (
          <li key={p.id} className="person" style={{ ['--pc' as string]: p.color }}>
            <Avatar p={p} size={40} />
            <input value={p.name} aria-label="Name" maxLength={16} onChange={(e) => up((b) => { b.people.find((x) => x.id === p.id)!.name = e.target.value; return b; })} />
            {i === 0 ? <span className="you-tag">You</span> : <button className="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}><X size={18} /></button>}
          </li>
        ))}
      </ul>
      {bill.people.length < 10 && <button className="btn ghost" onClick={add}><Plus size={18} /> Add person</button>}
      {(sugg.length > 0 || manage) && (
        <div className="friends">
          <div className="row between"><span className="sub">Friends</span><button className="btn text sm-text" onClick={() => setManage((m) => !m)}>{manage ? 'Done' : 'Manage'}</button></div>
          <div className="fchips">
            {(manage ? [...friends].sort((a, b) => b.count - a.count) : sugg).map((f) => (
              <button key={f.name} className={'fchip' + (manage ? ' manage' : '')} style={{ ['--pc' as string]: f.color }} onClick={() => (manage ? forget(f) : addFriend(f))} aria-label={manage ? `Forget ${f.name}` : `Add ${f.name}`}>
                <span className="av" style={{ background: f.color, width: 32, height: 32, fontSize: 12 }}>{ini(f.name)}</span>{f.name}{manage ? <X size={14} /> : <Plus size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
            <button className="btn primary" onClick={next}>Continue</button>
    </section>
  );
}

/* ---------- 3. Assign ---------- */
function AssignStep({ bill, up, notify, next, detected, total, shares }: { bill: Bill; up: Up; notify: (t: Toast) => void; next: () => void; detected: string | null; total: number; shares: Record<string, number> }) {
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
  const addItem = () => { const id = uid(); up((b) => { b.items.push({ id, name: `Item ${b.items.length + 1}`, qty: 1, price: 0 }); return b; }); setSheet(id); };
  const del = (id: string) => {
    const snap = structuredClone(bill); const name = bill.items.find((i) => i.id === id)?.name;
    up((b) => { b.items = b.items.filter((x) => x.id !== id); delete b.assign[id]; return b; }); setSheet(null);
    notify({ msg: `Deleted ${name}`, undo: () => up(() => snap) });
  };

  const done = bill.items.filter((it) => Object.values(bill.assign[it.id] || {}).some((w) => w > 0)).length;
  const sum = itemsSum(bill.items);
  const sheetItem = sheet ? bill.items.find((i) => i.id === sheet) : null;
  const left = bill.items.length - done;
  const prevLeft = useRef(left);
  const [party, setParty] = useState(0);
  useEffect(() => { if (prevLeft.current > 0 && left === 0) { buzz(30); setParty((n) => n + 1); } prevLeft.current = left; }, [left]);

  if (!bill.items.length) return (
    <section className="stack">
      <div className="empty"><Receipt size={32} /><b>No items yet</b><span className="muted">Scan a receipt or add items yourself.</span></div>
      <button className="btn ghost" onClick={addItem}><Plus size={18} /> Add item</button>
    </section>
  );

  return (
    <section className="stack">
      {party > 0 && <Celebrate key={party} colors={bill.people.map((p) => p.color)} />}
      <div className="progress-wrap">
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={bill.items.length} aria-valuenow={done}><div style={{ width: `${(done / bill.items.length) * 100}%` }} /></div>
        <p className="small muted">{left ? <>Who had this? <span className="num">{done} of {bill.items.length}</span> assigned</> : <span className="ok"><Check size={14} /> Everything&apos;s assigned</span>}</p>
      </div>
      <ul className="rlist">
        {bill.items.map((it) => {
          const a = bill.assign[it.id] || {};
          const who = bill.people.filter((p) => a[p.id] > 0);
          const all = who.length === bill.people.length && who.length > 0;
          const cls = 'ritem' + (who.length ? '' : ' todo') + (focus ? (a[focus] > 0 ? ' hl' : ' faded') : '');
          return (
            <li key={it.id} className={cls} onPointerDown={(e) => startPress(e, it.id)} onPointerMove={movePress} onPointerUp={endPress} onPointerCancel={endPress} onContextMenu={(e) => e.preventDefault()}>
              <span className="strip" aria-hidden="true">{who.map((p) => <i key={p.id} style={{ background: p.color, flex: a[p.id] }} />)}</span>
              <div className="rhead">
                <span className="rname">{it.qty && it.qty > 1 ? <span className="qty num">{it.qty}×</span> : null}{it.name}</span>
                <span className="price num">{money(it.price)}</span>
                <button className="icon-btn sm" aria-label={`Edit ${it.name}`} onClick={() => setSheet(it.id)}><Ellipsis size={18} /></button>
              </div>
              <div className={'bubbles' + (bill.people.length >= 7 ? ' scroll' : '')} role="group" aria-label={`Who had ${it.name}?`}>
                {bill.people.map((p) => {
                  const w = a[p.id] || 0;
                  return (
                    <button key={p.id} className={'bub' + (w ? ' on' : '')} style={{ ['--pc' as string]: p.color }} aria-pressed={w > 0} aria-label={p.name}
                      onClick={() => { buzz(w ? 6 : 12); toggle(it.id, p.id); }}>
                      {ini(p.name)}{w > 0 && <span className="chk">{w > 1 ? <span className="num">×{w}</span> : <Check size={10} strokeWidth={3.5} />}</span>}
                    </button>
                  );
                })}
                <button className={'bub allb' + (all ? ' on' : '')} aria-pressed={all} aria-label="Everyone" onClick={() => { buzz(12); toggle(it.id, '*'); }}>All</button>
              </div>
            </li>
          );
        })}
      </ul>
      <button className="btn ghost" onClick={addItem}><Plus size={18} /> Add item</button>

      <div className="soft">
        <div className="line"><span>Items</span><b className="num">{money(sum)}</b></div>
        <div className="line">
          <span>Charges</span>
          <select value={bill.mode} aria-label="Charges" onChange={(e) => up((b) => ({ ...b, mode: e.target.value as Mode }))}>
            {Object.entries(MODES).map(([k, m]) => <option key={k} value={k}>{m.label}{detected === k ? ' (detected)' : ''}</option>)}
          </select>
        </div>
        <div className="line total"><span>Total</span><b className="num">{money(total)}</b></div>
        {bill.total != null && Math.abs(bill.total - total) > 0.01 && <p className="note warn">The receipt says {money(bill.total)}. Check the items or charges.</p>}
        {shares._ > 0 && <p className="note warn"><span className="num">{money(shares._)}</span> still needs an owner.</p>}
      </div>
      <button className="btn primary" onClick={next}>Settle up</button>

      <div className="totbar" role="toolbar" aria-label="Totals per person">
        {bill.people.map((p) => (
          <button key={p.id} className={'tot' + (focus === p.id ? ' on' : '')} style={{ ['--pc' as string]: p.color }} aria-pressed={focus === p.id}
            onClick={() => { buzz(6); setFocus((f) => (f === p.id ? null : p.id)); }}>
            <Avatar p={p} size={32} /><span><small>{p.name}</small><b className="num">{money(shares[p.id] || 0)}</b></span>
          </button>
        ))}
      </div>

      {sheetItem && (
        <div className="backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-label={`Edit ${sheetItem.name}`} onClick={(e) => e.stopPropagation()}>
            <span className="grabber" aria-hidden="true" />
            <div className="fields">
              <label className="field grow"><span>Item</span><input value={sheetItem.name} onChange={(e) => up((b) => { b.items.find((x) => x.id === sheetItem.id)!.name = e.target.value; return b; })} /></label>
              <label className="field price-f"><span>Price</span><input className="num" inputMode="decimal" defaultValue={sheetItem.price.toFixed(2)} onBlur={(e) => { const v = parseFloat(e.target.value); up((b) => { b.items.find((x) => x.id === sheetItem.id)!.price = isNaN(v) ? 0 : Math.round(v * 100) / 100; return b; }); e.target.value = (isNaN(v) ? 0 : v).toFixed(2); }} /></label>
            </div>
            <label className="field"><span>Assign to</span>
              <select value="" onChange={(e) => e.target.value && toggle(sheetItem.id, e.target.value)}>
                <option value="">Choose a person…</option>
                <option value="*">Everyone, split evenly</option>
                {bill.people.map((p) => <option key={p.id} value={p.id}>{bill.assign[sheetItem.id]?.[p.id] ? '✓ ' : ''}{p.name}</option>)}
              </select>
            </label>
            <div className="sub">Shares</div>
            {bill.people.map((p) => {
              const w = bill.assign[sheetItem.id]?.[p.id] || 0;
              return (
                <div key={p.id} className="line">
                  <span className="row gap8"><Avatar p={p} size={28} />{p.name}</span>
                  <Stepper label={`${p.name}'s shares`} value={w} set={(n) => { buzz(6); up((b) => { (b.assign[sheetItem.id] ||= {})[p.id] = n; return b; }); }} />
                </div>
              );
            })}
            <p className="small muted">2 shares pays twice as much as 1.</p>
            <div className="row between">
              <button className="btn text danger" onClick={() => del(sheetItem.id)}><Trash2 size={18} /> Delete</button>
              <button className="btn primary compact" onClick={() => setSheet(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- 4. Settle ---------- */
type Payee = { mobile: string; name: string };
const fmtSG = (m: string) => { const d = (normalizeMobile(m) || '').slice(3); return d ? `+65 ${d.slice(0, 4)} ${d.slice(4)}` : ''; };
const maskSG = (m: string) => { const d = (normalizeMobile(m) || '').slice(3); return d ? `+65 •••• ${d.slice(4)}` : ''; };

function PayMe({ initial, onSave, onCancel }: { initial: Payee; onSave: (p: Payee) => void; onCancel?: () => void }) {
  const [num, setNum] = useState((normalizeMobile(initial.mobile) || '').slice(3));
  const [name, setName] = useState(initial.name);
  const [touched, setTouched] = useState(false);
  const ok = /^[89]\d{7}$/.test(num);
  return (
    <section className="stack payme">
      <span className="payme-ic"><QrCode size={28} /></span>
      <div className="hero center"><h1>How should we pay you?</h1><p className="muted">Friends will scan a PayNow QR to pay this number. It stays on your phone.</p></div>
      <label className="pill-field">
        <span className="prefix">+65</span>
        <input aria-label="PayNow mobile number" className="num" inputMode="numeric" autoComplete="tel-national" placeholder="9123 4567" maxLength={9} autoFocus
          value={num.length > 4 ? `${num.slice(0, 4)} ${num.slice(4)}` : num}
          onChange={(e) => setNum(e.target.value.replace(/\D/g, '').replace(/^65(?=\d{8})/, '').slice(0, 8))} onBlur={() => setTouched(true)} />
      </label>
      {touched && num && !ok && <p className="note warn center">Enter an 8-digit Singapore mobile starting with 8 or 9.</p>}
      <label className="pill-field">
        <input aria-label="Your name (optional)" placeholder="Your name (optional)" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" disabled={!ok} onClick={() => { buzz(12); onSave({ mobile: '+65' + num, name: name.trim() }); }}>Save</button>
      {onCancel && <button className="btn text" onClick={onCancel}>Cancel</button>}
    </section>
  );
}

function SettleStep({ bill, notify, shares, total, payee, setPayee, saveRec }: { bill: Bill; notify: (t: Toast) => void; shares: Record<string, number>; total: number; payee: Payee; setPayee: (p: Payee) => void; saveRec: (r: Rec) => void }) {
  const sig = JSON.stringify([bill.id, bill.people, shares, total, payee, bill.merchant]);
  useEffect(() => {
    if (!normalizeMobile(payee.mobile) || !bill.id || bill.people.length < 2 || !bill.items.length) return;
    saveRec({ id: bill.id, place: bill.merchant || 'Bill', date: new Date().toISOString(), total, mode: MODES[bill.mode as Mode].label, payee, items: bill.items.map((it) => ({ name: it.name, qty: it.qty, price: it.price, who: Object.keys(bill.assign[it.id] || {}).filter((k) => (bill.assign[it.id][k] || 0) > 0) })), people: bill.people.map((p) => ({ id: p.id, name: p.name, color: p.color, share: shares[p.id] || 0, paid: false })) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [editing, setEditing] = useState(false);
  const me = bill.people[0];
  const valid = normalizeMobile(payee.mobile);
  const place = bill.merchant || 'the bill';
  const payTo = payee.name || fmtSG(payee.mobile);
  const owing = bill.people.slice(1).filter((p) => (shares[p.id] || 0) > 0);
  const allSet = !shares._;
  if (!valid || editing) return <PayMe initial={payee} onSave={(p) => { setPayee(p); setEditing(false); notify({ msg: 'PayNow number saved' }); }} onCancel={valid ? () => setEditing(false) : undefined} />;
  const summary = [
    `${bill.merchant || 'Bill'}: ${money(total)} (${MODES[bill.mode as Mode].label})`,
    ...owing.map((p) => `${p.name} owes ${money(shares[p.id])}`),
    `${me.name === 'You' ? 'My share' : me.name}: ${money(shares[me.id] || 0)}`,
    ...(shares._ ? [`Unassigned: ${money(shares._)}`] : []),
    `PayNow ${payee.name ? payee.name + ' ' : ''}${fmtSG(payee.mobile)}`,
  ].join('\n');
  const owed = owing.reduce((s, p) => s + Math.round(shares[p.id] * 100), 0) / 100;
  return (
    <section className="stack">
      {allSet && <Celebrate colors={bill.people.map((p) => p.color)} />}
      <div className="hero center">
        <p className="muted">You&apos;re owed</p>
        <h1 className="num huge">{money(owed)}</h1>
        <p className="muted small">{bill.merchant || 'Your bill'} · {money(total)} total · {MODES[bill.mode as Mode].label}</p>
      </div>
      <button className="paychip" onClick={() => setEditing(true)} aria-label="Change PayNow number"><QrCode size={16} /> Paying to <b className="num">{maskSG(payee.mobile)}</b><PenLine size={14} /></button>
      {owing.length === 0 && <div className="empty soft"><Users size={28} /><b>Nobody owes you yet</b><span className="muted">Assign items to your friends first.</span></div>}
      <ul className="settle">
        {owing.map((p) => (
          <li key={p.id} className="owe" style={{ ['--pc' as string]: p.color }}>
            <div className="line"><span className="row gap12"><Avatar p={p} size={44} /><b>{p.name}</b></span><b className="num big">{money(shares[p.id])}</b></div>
            <PayQR mobile={payee.mobile} amount={shares[p.id]} who={p.name} payTo={payTo} place={place} />
          </li>
        ))}
      </ul>
      <p className="center muted small">Your share: <b className="num">{money(shares[me.id] || 0)}</b></p>
      {shares._ > 0 && <p className="note warn center"><span className="num">{money(shares._)}</span> is still unassigned.</p>}
      {owing.length > 1 && (
        <div className="group-share">
          <span className="row gap8"><Users size={18} /> Send to the group</span>
          <ShareRow make={() => makeCard(owing.map((p) => ({ name: p.name, amount: shares[p.id] })), { mobile: payee.mobile, payTo, place })} text={summary} file="WeSplit-group.png" />
        </div>
      )}
      <button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(summary); notify({ msg: 'Summary copied' }); } catch { notify({ msg: "Couldn't copy. Try again." }); } }}><Copy size={18} /> Copy summary</button>
    </section>
  );
}

function Celebrate({ colors }: { colors: string[] }) {
  const dots = Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; const r = 70 + (i % 3) * 26; return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7 - 20, c: colors[i % colors.length], s: 6 + (i % 3) * 3, d: (i % 4) * 30 }; });
  return (
    <div className="celebrate" aria-hidden="true">
      {dots.map((d, i) => <i key={i} style={{ ['--x' as string]: d.x + 'px', ['--y' as string]: d.y + 'px', background: d.c, width: d.s, height: d.s, animationDelay: d.d + 'ms' }} />)}
    </div>
  );
}

const shareText = (who: string, place: string, amount: number, payTo: string, mobile: string) =>
  `Hi ${who}, your share for ${place} is ${money(amount)}. Scan to PayNow ${payTo === fmtSG(mobile) ? fmtSG(mobile) : `${payTo} (${fmtSG(mobile)})`}.`;
const waLink = (t: string) => 'https://wa.me/?text=' + encodeURIComponent(t);
const tgLink = (t: string) => 'https://t.me/share/url?url=' + encodeURIComponent(APP_URL) + '&text=' + encodeURIComponent(t);
const safe = (s: string) => s.replace(/[^\w-]+/g, '_');

type Entry = { name: string; amount: number };
function fit(c: CanvasRenderingContext2D, t: string, w: number) { while (t.length > 3 && c.measureText(t).width > w) t = t.slice(0, -2) + '…'; return t; }

// Share card PNG in the app's brand: white card, hairline border, ink QR, brand accent.
async function makeCard(list: Entry[], o: { mobile: string; payTo: string; place: string }): Promise<Blob> {
  const W = 720, CH = 860, PAD = 40, BR = '#0B7A5A', INK = '#0F1A17', MUT = '#4B5753', LINE = '#E3E8E6';
  const F = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = 150 + list.length * (CH + 24) + 64;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#F6F8F7'; c.fillRect(0, 0, cv.width, cv.height);
  // mark
  c.fillStyle = BR; c.beginPath(); c.roundRect(PAD, 44, 48, 48, 13); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.moveTo(PAD + 22.1, 54.8); c.arc(PAD + 22.1, 68, 13.2, -Math.PI / 2, Math.PI / 2, true); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(PAD + 25.9, 57.8); c.arc(PAD + 25.9, 71, 13.2, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
  c.font = `700 36px ${F}`; c.fillStyle = INK; c.fillText('WeSplit', PAD + 64, 81);
  c.font = `500 24px ${F}`; c.fillStyle = MUT; c.textAlign = 'right'; c.fillText(fit(c, o.place, 360), W - PAD, 80); c.textAlign = 'left';
  let y = 130;
  for (const e of list) {
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(PAD, y, W - 2 * PAD, CH, 24); c.fill();
    c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
    c.textAlign = 'center';
    c.font = `500 28px ${F}`; c.fillStyle = MUT; c.fillText(fit(c, `${e.name}'s share`, W - 4 * PAD), W / 2, y + 66);
    c.font = `700 76px ${F}`; c.fillStyle = INK; c.fillText(money(e.amount), W / 2, y + 150);
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, paynowPayload({ mobile: o.mobile, amount: e.amount, ref: 'WeSplit ' + e.name }), { margin: 1, width: 460, color: { dark: INK } });
    c.drawImage(qr, (W - 460) / 2, y + 190, 460, 460);
    c.font = `600 28px ${F}`; c.fillStyle = BR; c.fillText(fit(c, `PayNow to ${o.payTo}`, W - 4 * PAD), W / 2, y + 712);
    c.font = `500 24px ${F}`; c.fillStyle = MUT; c.fillText(o.payTo === fmtSG(o.mobile) ? '' : fmtSG(o.mobile), W / 2, y + 752);
    c.fillText('Scan with any Singapore banking app', W / 2, y + 800);
    c.textAlign = 'left';
    y += CH + 24;
  }
  c.font = `500 20px ${F}`; c.fillStyle = MUT; c.textAlign = 'center'; c.fillText('Split with WeSplit · wesplit-sg.vercel.app', W / 2, cv.height - 30);
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
      <button className="chip-btn" disabled={busy} onClick={share} aria-label="Share"><Share2 size={16} /> Share</button>
      {fallback && <>
        <a className="chip-btn" href={waLink(text)} target="_blank" rel="noopener" aria-label="Send on WhatsApp"><MessageCircle size={16} /> WhatsApp</a>
        <a className="chip-btn" href={tgLink(text)} target="_blank" rel="noopener" aria-label="Send on Telegram"><Send size={16} /> Telegram</a>
        <button className="chip-btn" onClick={download} aria-label="Download QR"><Download size={16} /> Save image</button>
      </>}
    </div>
  );
}

function PayQR({ mobile, amount, who, payTo, place }: { mobile: string; amount: number; who: string; payTo: string; place: string }) {
  const [src, setSrc] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    QRCode.toDataURL(paynowPayload({ mobile, amount, ref: 'WeSplit ' + who }), { margin: 1, width: 240, color: { dark: '#0F1A17' } }).then(setSrc);
  }, [show, mobile, amount, who]);
  return (
    <>
      {show && (
        <button className="qr" onClick={() => setShow(false)} aria-label="Hide QR">
          {src && <img src={src} alt={`PayNow QR for ${money(amount)}`} />}
          <small className="muted">Scan with any Singapore banking app</small>
        </button>
      )}
      <div className="share">
        {!show && <button className="chip-btn" onClick={() => setShow(true)}><QrCode size={16} /> Show QR</button>}
        <ShareRow make={() => makeCard([{ name: who, amount }], { mobile, payTo, place })} text={shareText(who, place, amount, payTo, mobile)} file={`WeSplit-${safe(who)}.png`} />
      </div>
    </>
  );
}

/* ---------- History ---------- */
const owedOf = (r: Rec) => r.people.slice(1).filter((p) => !p.paid && p.share > 0).reduce((a, p) => a + Math.round(p.share * 100), 0) / 100;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

function HistoryList({ history, open }: { history: Rec[]; open: (id: string) => void }) {
  const owed = history.reduce((s, r) => s + Math.round(owedOf(r) * 100), 0) / 100;
  if (!history.length) return (
    <section className="stack">
      <div className="empty"><HistoryIc size={32} /><b>No bills yet</b><span className="muted">Bills you settle will show up here.</span></div>
    </section>
  );
  return (
    <section className="stack">
      <div className="hero center"><p className="muted">Owed to you</p><h1 className="num huge">{money(owed)}</h1><p className="muted small">across {history.length} bill{history.length > 1 ? 's' : ''}</p></div>
      <ul className="hlist">
        {history.map((r) => {
          const others = r.people.slice(1).filter((p) => p.share > 0);
          const paid = others.filter((p) => p.paid).length;
          return (
            <li key={r.id}>
              <button className="hrow" onClick={() => open(r.id)}>
                <span className="hmain"><b>{r.place}</b><small className="muted">{fmtDate(r.date)} · {paid === others.length ? <span className="ok">All paid</span> : `${paid} of ${others.length} paid`}</small></span>
                <span className="havs">{others.slice(0, 4).map((p) => <span key={p.id} className={'av' + (p.paid ? ' paid' : '')} style={{ background: p.color, width: 28, height: 28, fontSize: 10 }}>{ini(p.name)}</span>)}</span>
                <b className="num">{money(owedOf(r))}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BillDetail({ rec, setHistory, notify, close }: { rec?: Rec; setHistory: (f: (h: Rec[]) => Rec[]) => void; notify: (t: Toast) => void; close: () => void }) {
  if (!rec) return <section className="stack"><div className="empty"><b>Bill not found</b></div></section>;
  const others = rec.people.slice(1).filter((p) => p.share > 0);
  const paid = others.filter((p) => p.paid).length;
  const payTo = rec.payee.name || fmtSG(rec.payee.mobile);
  const toggle = (pid: string) => { buzz(12); setHistory((h) => h.map((r) => (r.id !== rec.id ? r : { ...r, updatedAt: Date.now(), people: r.people.map((p) => (p.id === pid ? { ...p, paid: !p.paid } : p)) }))); };
  const del = () => { let snap: Rec[] = []; setHistory((h) => { snap = h; return h.filter((r) => r.id !== rec.id); }); close(); notify({ msg: 'Bill deleted', undo: () => setHistory(() => snap) }); };
  const ensureLink = async (): Promise<string | null> => {
    if (rec.share) return shareUrl(rec.share.id);
    if (!navigator.onLine) { notify({ msg: 'Connect to the internet to make a link.' }); return null; }
    try {
      const s = await createShare(rec);
      const sigs = load<Record<string, string>>('ws-share-sig', {}); sigs[s.id] = JSON.stringify(snapshotOf(rec)); localStorage.setItem('ws-share-sig', JSON.stringify(sigs));
      setHistory((h) => h.map((r) => (r.id === rec.id ? { ...r, share: s, updatedAt: Date.now() } : r)));
      return shareUrl(s.id);
    } catch (e) { notify({ msg: (e as Error).message }); return null; }
  };
  return (
    <section className="stack">
      {others.length > 0 && paid === others.length && <Celebrate colors={rec.people.map((p) => p.color)} />}
      <div className="hero center">
        <p className="muted">{rec.place} · {fmtDate(rec.date)}</p>
        <h1 className="num huge">{money(owedOf(rec))}</h1>
        <p className="muted small">{paid === others.length ? 'Everyone has paid' : `${paid} of ${others.length} paid`} · {money(rec.total)} total</p>
      </div>
      <ul className="settle">
        {others.map((p) => (
          <li key={p.id} className={'owe' + (p.paid ? ' is-paid' : '')} style={{ ['--pc' as string]: p.color }}>
            <div className="line"><span className="row gap12"><Avatar p={p} size={44} /><b>{p.name}</b></span><b className="num big">{money(p.share)}</b></div>
            <div className="share">
              <button className={'chip-btn paid-btn' + (p.paid ? ' on' : '')} aria-pressed={p.paid} onClick={() => toggle(p.id)}>{p.paid ? <CircleCheck size={16} /> : <Circle size={16} />} {p.paid ? 'Paid' : 'Mark as paid'}</button>
              {!p.paid && <NudgeRow rec={rec} who={p.name} amount={p.share} payTo={payTo} ensure={ensureLink} />}
            </div>
          </li>
        ))}
      </ul>
      <ShareLink rec={rec} ensure={ensureLink} notify={notify} revoke={async () => {
        try { await revokeShare(rec.share!); setHistory((h) => h.map((r) => (r.id === rec.id ? { ...r, share: undefined, updatedAt: Date.now() } : r))); notify({ msg: 'Link turned off' }); }
        catch { notify({ msg: "Couldn't turn off the link. Check your connection." }); }
      }} />
      <button className="btn text danger" onClick={del}><Trash2 size={18} /> Delete bill</button>
    </section>
  );
}

function TextShare({ text, url, label = 'Share' }: { text: string; url: string; label?: string }) {
  const native = typeof navigator !== 'undefined' && !!navigator.share;
  const full = text + ' ' + url;
  return (
    <div className="share">
      <a className="chip-btn" href={'https://wa.me/?text=' + encodeURIComponent(full)} target="_blank" rel="noopener" aria-label="Send on WhatsApp"><MessageCircle size={16} /> WhatsApp</a>
      <a className="chip-btn" href={'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text)} target="_blank" rel="noopener" aria-label="Send on Telegram"><Send size={16} /> Telegram</a>
      {native && <button className="chip-btn" onClick={() => navigator.share({ text, url }).catch(() => {})}><Share2 size={16} /> {label}</button>}
    </div>
  );
}

function ShareLink({ rec, ensure, revoke, notify }: { rec: Rec; ensure: () => Promise<string | null>; revoke: () => void; notify: (t: Toast) => void }) {
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  if (!rec.share) return (
    <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); await ensure(); setBusy(false); }}><Link2 size={18} /> {busy ? 'Making link…' : 'Share bill link'}</button>
  );
  const url = shareUrl(rec.share.id);
  const host = rec.payee.name ? `${rec.payee.name} here! ` : '';
  return (
    <div className="linkbox">
      <b><Link2 size={16} /> Anyone with this link can see the bill</b>
      <span className="url">{url.replace(/^https?:\/\//, '')}</span>
      <small className="muted">Friends tap their name to see their share and your PayNow QR. Paid status updates automatically.</small>
      <TextShare text={`${host}Here's the split for ${rec.place} (${money(rec.total)}). Tap your name to see what you owe:`} url={url} />
      <div className="share">
        <button className="chip-btn" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); notify({ msg: 'Link copied' }); }}><Copy size={16} /> Copy link</button>
        {!sure ? <button className="chip-btn danger" onClick={() => setSure(true)}><Link2Off size={16} /> Stop sharing</button>
          : <button className="chip-btn danger" onClick={() => { setSure(false); revoke(); }}><Link2Off size={16} /> Tap again to turn off</button>}
      </div>
    </div>
  );
}

function NudgeRow({ rec, who, amount, payTo, ensure }: { rec: Rec; who: string; amount: number; payTo: string; ensure: () => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(rec.share ? shareUrl(rec.share.id) : null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="chip-btn" disabled={busy} onClick={async () => { setBusy(true); const u = await ensure(); setBusy(false); if (u) { setUrl(u); setOpen(true); } }}><Bell size={16} /> {busy ? 'Nudge…' : 'Nudge'}</button>;
  const text = `Hey ${who}! Gentle nudge for ${rec.place} 🙏 Your share is ${money(amount)}. PayNow ${payTo === fmtSG(rec.payee.mobile) ? fmtSG(rec.payee.mobile) : `${payTo} (${fmtSG(rec.payee.mobile)})`} or tap your name here for the QR:`;
  return <TextShare text={text} url={url!} label="More" />;
}
