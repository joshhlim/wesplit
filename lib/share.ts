// Public read-only bill links. Snapshots go through security-definer RPCs; the edit token
// (needed to update paid status or revoke) stays private inside the owner's own bill record.
import { supa } from './supabase';

export type ShareRef = { id: string; token: string };
type P = { id: string; name: string; color: string; share: number; paid: boolean };
export type ShareRec = { id: string; place: string; date: string; total: number; mode: string; payee: { mobile: string; name: string }; people: P[];
  items?: { name: string; qty: number | null; price: number; who: string[] }[]; share?: ShareRef };

export const snapshotOf = (r: ShareRec) => ({
  place: r.place, date: r.date, total: r.total, mode: r.mode, payee: r.payee, items: r.items || [],
  people: r.people.map((p, i) => ({ ...p, name: i === 0 ? (r.payee.name || 'Host') : p.name })),
});
export const shareUrl = (id: string) => `${location.origin}/b/${id}`;

export async function createShare(r: ShareRec): Promise<ShareRef> {
  const sb = supa(); if (!sb) throw new Error('Sharing is unavailable right now.');
  const { data, error } = await sb.rpc('create_share', { p_bill_id: r.id, p_snapshot: snapshotOf(r) });
  if (error) throw new Error(/mobile/i.test(error.message) ? 'Add a valid PayNow number first.' : "Couldn't create the link. Check your connection.");
  return data as ShareRef;
}
export async function updateShare(s: ShareRef, r: ShareRec) {
  const sb = supa(); if (!sb) return false;
  const { data, error } = await sb.rpc('update_share', { p_id: s.id, p_token: s.token, p_snapshot: snapshotOf(r), p_revoke: false });
  if (error) throw error; return !!data;
}
export async function revokeShare(s: ShareRef) {
  const sb = supa(); if (!sb) throw new Error('offline');
  const { error } = await sb.rpc('update_share', { p_id: s.id, p_token: s.token, p_snapshot: null, p_revoke: true });
  if (error) throw error;
}
