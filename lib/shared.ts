export type Shared = { revoked?: boolean; place: string; date: string; total: number; mode: string; payee: { mobile: string; name: string };
  people: { id: string; name: string; color: string; share: number; paid: boolean }[]; items: { name: string; qty: number | null; price: number; disc?: number | null; free?: boolean; w?: Record<string, number> | null; who: string[] }[]; updated_at: string;
  location?: string | null; voucher?: string | null; breakdown?: { gross: number; itemDisc: number; voucher: number; sub: number; sc: number; gst: number; total: number } | null };
export async function getShared(id: string): Promise<Shared | null> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(id)) return null;
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_share`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  if (!r.ok) return null;
  return (await r.json()) as Shared | null;
}
export const money = (n: number) => 'S$' + (Math.round((n || 0) * 100) / 100).toFixed(2);
