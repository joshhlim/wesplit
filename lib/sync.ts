// Two-way sync between the on-device cache (localStorage) and Supabase.
// Bills: last write wins per bill (by updatedAt). Deletions are detected by comparing with the
// set of ids we last saw on the server, and pushed as soft deletes so other devices drop them too.
import type { SupabaseClient } from '@supabase/supabase-js';
import { upload, removeCloud, delLocal } from './photos';

export type SRec = { id: string; place: string; date: string; total: number; mode: string; payee: { mobile: string; name: string }; updatedAt?: number; photo?: boolean;
  people: { id: string; name: string; color: string; share: number; paid: boolean }[] };
export type SFriend = { name: string; color: string; count: number };
export type SPayee = { mobile: string; name: string };

const getSet = (k: string) => new Set<string>(JSON.parse(localStorage.getItem(k) || '[]'));
const putSet = (k: string, s: Set<string>) => localStorage.setItem(k, JSON.stringify([...s]));

export async function syncAll(sb: SupabaseClient, uid: string, local: { history: SRec[]; friends: SFriend[]; payee: SPayee }) {
  const seenKey = `ws-seen-bills-${uid}`, seenF = `ws-seen-friends-${uid}`;
  const seen = getSet(seenKey), seenFr = getSet(seenF);

  // ---- bills
  const { data: rb, error: e1 } = await sb.from('bills').select('id,data,updated_at,deleted_at');
  if (e1) throw e1;
  const remote = new Map((rb || []).map((r) => [r.id as string, { rec: r.data as SRec, at: Date.parse(r.updated_at), deleted: !!r.deleted_at }]));
  const localIds = new Set(local.history.map((r) => r.id));
  const push: SRec[] = [], out = new Map<string, SRec>();
  for (const r of local.history) {
    const rm = remote.get(r.id);
    if (!rm) push.push(r), out.set(r.id, r);
    else if (rm.deleted) { /* deleted elsewhere: drop */ }
    else if ((r.updatedAt || 0) > rm.at) push.push(r), out.set(r.id, r);
    else out.set(r.id, { ...rm.rec, updatedAt: rm.at });
  }
  const tomb: string[] = [];
  for (const [id, rm] of remote) {
    if (rm.deleted || localIds.has(id)) continue;
    if (seen.has(id)) tomb.push(id); // was synced before, now gone locally -> deleted on this device
    else out.set(id, { ...rm.rec, updatedAt: rm.at });
  }
  if (push.length) {
    const { error } = await sb.from('bills').upsert(push.map((r) => ({ user_id: uid, id: r.id, place: r.place.slice(0, 120), bill_date: r.date, total: r.total, charges_mode: r.mode, data: r, deleted_at: null })));
    if (error) throw error;
    const rows = push.flatMap((r) => r.people.map((p, i) => ({ user_id: uid, bill_id: r.id, person_id: p.id, name: p.name.slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#475569', is_me: i === 0, share: p.share, paid: p.paid, paid_at: p.paid ? new Date().toISOString() : null })));
    if (rows.length) { const { error: e2 } = await sb.from('bill_people').upsert(rows); if (e2) throw e2; }
  }
  if (tomb.length) { const { error } = await sb.from('bills').update({ deleted_at: new Date().toISOString() }).in('id', tomb); if (error) throw error; await removeCloud(uid, tomb).catch(() => {}); }
  // receipt photos: upload ones not yet in the cloud; drop cloud copies of bills deleted elsewhere.
  // A missing local file is not a failure (it may live on another device). A storage error is.
  const upKey = `ws-photo-up-${uid}`, up = getSet(upKey);
  const photoFailed: string[] = [];
  for (const r of out.values()) {
    if (!r.photo || up.has(r.id)) continue;
    const res = await upload(uid, r.id).catch(() => 'error' as const);
    if (res === 'ok') up.add(r.id);
    else if (res === 'error') photoFailed.push(r.id);
  }
  for (const [id, rm] of remote) if (rm.deleted) { up.delete(id); delLocal(id); }
  putSet(upKey, up);
  putSet(seenKey, new Set(out.keys()));

  // ---- friends (union by lower-case name; deletions via seen set)
  const { data: rf, error: e3 } = await sb.from('friends').select('name_key,name,color,count,deleted_at');
  if (e3) throw e3;
  const fm = new Map<string, SFriend>();
  const localKeys = new Set(local.friends.map((f) => f.name.toLowerCase()));
  for (const f of local.friends) fm.set(f.name.toLowerCase(), f);
  const fTomb: string[] = [];
  for (const r of rf || []) {
    if (r.deleted_at) { if (!localKeys.has(r.name_key) || !seenFr.has(r.name_key)) fm.delete(r.name_key); continue; }
    const l = fm.get(r.name_key);
    if (l) l.count = Math.max(l.count, r.count);
    else if (seenFr.has(r.name_key)) fTomb.push(r.name_key);
    else fm.set(r.name_key, { name: r.name, color: r.color, count: r.count });
  }
  const friends = [...fm.values()];
  if (friends.length) { const { error } = await sb.from('friends').upsert(friends.map((f) => ({ user_id: uid, name_key: f.name.toLowerCase().slice(0, 40), name: f.name.slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : '#475569', count: f.count, deleted_at: null }))); if (error) throw error; }
  if (fTomb.length) await sb.from('friends').update({ deleted_at: new Date().toISOString() }).in('name_key', fTomb);
  putSet(seenF, new Set(friends.map((f) => f.name.toLowerCase())));

  // ---- profile (PayNow number + name): local wins when set
  let payee = local.payee;
  const { data: prof } = await sb.from('profiles').select('display_name,paynow_mobile').maybeSingle();
  if (payee.mobile) await sb.from('profiles').upsert({ id: uid, paynow_mobile: payee.mobile, display_name: payee.name || null });
  else if (prof?.paynow_mobile) payee = { mobile: prof.paynow_mobile, name: prof.display_name || '' };

  const history = [...out.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { history, friends, payee, photoFailed };
}
