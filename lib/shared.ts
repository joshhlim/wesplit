import { cache } from 'react';
import { classifyShare } from './status.mjs';

export type Shared = { revoked?: boolean; place: string; date: string; total: number; mode: string; payee: { mobile: string; name: string };
  people: { id: string; name: string; color: string; share: number; paid: boolean }[]; items: { name: string; qty: number | null; price: number; disc?: number | null; free?: boolean; w?: Record<string, number> | null; who: string[] }[]; updated_at: string;
  location?: string | null; voucher?: string | null; rlabel?: string | null; breakdown?: { gross: number; itemDisc: number; receiptDisc?: number | null; voucher: number; sub: number; sc: number; gst: number; total: number } | null };

export type ShareResult =
  | { status: 'ok'; data: Shared }
  | { status: 'missing' }
  | { status: 'revoked' }
  | { status: 'unavailable' };

export const getShared = cache(async (id: string): Promise<ShareResult> => {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return { status: 'missing' };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return { status: 'unavailable' };
  try {
    const r = await fetch(`${base}/rest/v1/rpc/get_share`, {
      method: 'POST', cache: 'no-store',
      headers: { apikey: key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ p_id: id }),
    });
    const body = await r.json().catch(() => null);
    const out = classifyShare(r.status, body);
    if (out.status === 'ok' && out.data && typeof out.data === 'object') return { status: 'ok', data: out.data as Shared };
    if (out.status === 'revoked') return { status: 'revoked' };
    if (out.status === 'unavailable') return { status: 'unavailable' };
    return { status: 'missing' };
  } catch {
    return { status: 'unavailable' };
  }
});
export const money = (n: number) => 'S$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
