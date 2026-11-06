// Receipt photos: compressed JPEG in IndexedDB on this device; for signed-in users also a private
// Supabase Storage object at receipts/<user id>/<bill id>.jpg (RLS: only the owner can touch it).
// Photos are never part of public share links.
import { supa } from './supabase';

const DB = 'wesplit', STORE = 'photos';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const q = f(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export const putPhoto = (id: string, b: Blob) => tx('readwrite', (s) => s.put(b, id));
export const getLocal = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id)).catch(() => undefined);
export const delLocal = (id: string) => tx('readwrite', (s) => s.delete(id)).catch(() => {});
export async function moveLocal(from: string, to: string) { const b = await getLocal(from); if (b) { await putPhoto(to, b); await delLocal(from); } }

export async function compress(file: Blob, max = 1400, q = 0.72): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  let out: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', q));
  if (out.size > 900_000) out = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.5));
  return out;
}

const path = (uid: string, id: string) => `${uid}/${id.replace(/[^\w-]/g, '_')}.jpg`;
export async function upload(uid: string, id: string): Promise<'ok' | 'missing' | 'error'> {
  const sb = supa(); if (!sb) return 'error';
  const b = await getLocal(id); if (!b) return 'missing';
  const { error } = await sb.storage.from('receipts').upload(path(uid, id), b, { upsert: true, contentType: 'image/jpeg' });
  return error ? 'error' : 'ok';
}
export async function getPhoto(uid: string | null, id: string): Promise<Blob | undefined> {
  const l = await getLocal(id); if (l || !uid) return l;
  const sb = supa(); if (!sb) return;
  const { data } = await sb.storage.from('receipts').download(path(uid, id));
  if (data) await putPhoto(id, data).catch(() => {});
  return data || undefined;
}
export async function removeCloud(uid: string, ids: string[]) {
  const sb = supa(); if (!sb || !ids.length) return;
  await sb.storage.from('receipts').remove(ids.map((i) => path(uid, i)));
}
export async function removeAllCloud(uid: string) {
  const sb = supa(); if (!sb) return;
  for (let i = 0; i < 20; i++) {
    const { data } = await sb.storage.from('receipts').list(uid, { limit: 100 });
    if (!data?.length) return;
    await sb.storage.from('receipts').remove(data.map((f) => `${uid}/${f.name}`));
  }
}
