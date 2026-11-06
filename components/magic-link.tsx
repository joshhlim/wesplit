'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { Mark } from '@/components/brand';
import { supa } from '@/lib/supabase';

const COOL_KEY = 'ws-magic-cool';
const COOL_MS = 60_000;

export function coolLeft() {
  try { return Math.max(0, Number(sessionStorage.getItem(COOL_KEY) || 0) - Date.now()); } catch { return 0; }
}
export function startCool() {
  try { sessionStorage.setItem(COOL_KEY, String(Date.now() + COOL_MS)); } catch {}
}
export function formatCool(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function useMagicCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(coolLeft());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);
  return { left, start: () => { startCool(); setLeft(COOL_MS); } };
}

const hint = 'Open the link on this phone. A link opened on another device won’t sign this one in.';

export function MagicLink({ kind, online, onHome }: { kind: 'expired' | 'invalid'; online: boolean; onHome?: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const { left, start } = useMagicCooldown();
  const title = kind === 'expired' ? 'This sign-in link has expired' : 'This sign-in link isn’t valid';
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!online) { setErr('Connect to the internet to send a new link.'); return; }
    if (left > 0) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter a valid email address.'); return; }
    const sb = supa();
    if (!sb) { setErr('Sign-in is unavailable right now.'); return; }
    setSending(true);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + '/auth/callback' } });
    setSending(false);
    if (error) {
      if (/rate/i.test(error.message)) start();
      setErr(/rate/i.test(error.message) ? 'Too many emails just now. Wait a moment and try again.' : error.message);
      return;
    }
    start();
    setSent(true);
  };
  return (
    <section className="stack status-card">
      <Mark size={56} />
      <div className="hero center">
        <h1>{sent ? 'Check your email' : title}</h1>
        <p className="muted">{sent ? <>We sent a new sign-in link to <b>{email}</b>.</> : 'Request a fresh link and tap it here.'}</p>
      </div>
      <p className="note center">{hint}</p>
      {!sent && (
        <form onSubmit={send} className="col gap8" noValidate>
          <input className="pill-input" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn primary" disabled={sending || left > 0 || !online}>
            <Mail size={18} /> {sending ? 'Sending…' : left > 0 ? `Resend in ${formatCool(left)}` : 'Email me a new link'}
          </button>
        </form>
      )}
      {sent && left > 0 && <p className="fine center">You can resend in {formatCool(left)}.</p>}
      {!online && <p className="off-why center">Connect to the internet to send a new link.</p>}
      {err && <p className="err center" role="alert">{err}</p>}
      <Link href="/" className="btn ghost" onClick={() => onHome?.()}>Home</Link>
    </section>
  );
}
