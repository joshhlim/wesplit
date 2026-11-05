// Pure bill-splitting + PayNow helpers (no deps) so they can be unit tested.
export const MODES = {
  sg: { label: 'Service + GST', factor: 1.1 * 1.09 },
  gst: { label: 'GST only', factor: 1.09 },
  svc: { label: 'Service only', factor: 1.1 },
  none: { label: 'None', factor: 1 },
};
export const cents = (n) => Math.round((Number(n) || 0) * 100);

export function itemsSum(items) {
  return items.reduce((s, it) => s + cents(it.price), 0) / 100;
}

// ---- discounts ----
// Item: price, optional disc (S$ off this line) and free (1-for-1 / on the house).
export const itemNetCents = (it) => (it.free ? 0 : Math.max(0, cents(it.price) - cents(it.disc)));
// Bill voucher: { kind: 'pct' | 'amt', value }. Returns cents taken off the item subtotal.
export function voucherCents(subCents, v) {
  if (!v || !(v.value > 0) || !subCents) return 0;
  if (v.kind === 'pct') return Math.min(subCents, Math.round((subCents * Math.min(100, v.value)) / 100));
  return Math.min(subCents, cents(v.value));
}
// SG convention: discounts first, then 10% service charge, then 9% GST on (subtotal + service charge).
// Each charge is rounded to the cent, like a printed receipt.
const HAS = { sg: [1, 1], gst: [0, 1], svc: [1, 0], none: [0, 0] };
export function charges(subCents, mode) {
  const [s, g] = HAS[mode] || HAS.none;
  const sc = s ? Math.round(subCents * 0.1) : 0;
  const gst = g ? Math.round((subCents + sc) * 0.09) : 0;
  return { sc, gst, total: subCents + sc + gst };
}
export function breakdown(items, mode, voucher) {
  const gross = items.reduce((s, it) => s + cents(it.price), 0);
  const net = items.reduce((s, it) => s + itemNetCents(it), 0);
  const v = voucherCents(net, voucher);
  const c = charges(net - v, mode);
  return { gross, itemDisc: gross - net, voucher: v, sub: net - v, sc: c.sc, gst: c.gst, total: c.total };
}

// Pick the charge mode whose charges best explain the printed total, after discounts.
export function detectMode(items, total, voucher) {
  const sub = breakdown(items, 'none', voucher).sub;
  if (!total || !sub) return null;
  let best = null, diff = Infinity;
  for (const k of Object.keys(MODES)) {
    const d = Math.abs(cents(total) - charges(sub, k).total);
    if (d < diff) { diff = d; best = k; }
  }
  return diff <= Math.max(2, sub * 0.012) ? best : null;
}

// The amount to split: printed total when it agrees with the chosen mode, else computed.
export function targetTotal(items, mode, printedTotal, voucher) {
  const computed = breakdown(items, mode, voucher).total / 100;
  if (printedTotal && detectMode(items, printedTotal, voucher) === mode) return printedTotal;
  return computed;
}

// Largest-remainder rounding: integer cents per key summing exactly to totalCents.
function apportion(weights, totalCents) {
  const keys = Object.keys(weights);
  const W = keys.reduce((s, k) => s + weights[k], 0);
  if (!W) return Object.fromEntries(keys.map((k) => [k, 0]));
  const raw = keys.map((k) => ({ k, v: (weights[k] / W) * totalCents }));
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)]));
  let left = totalCents - Object.values(out).reduce((a, b) => a + b, 0);
  raw.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  for (let i = 0; left > 0; i = (i + 1) % raw.length, left--) out[raw[i].k]++;
  return out;
}

// assign: { [itemId]: { [personId]: portions } } e.g. {a:2,b:1} = 2:1. Unassigned items go to '_'.
// Each person pays their portion of each item's discounted price; the voucher, service charge and
// GST are then shared in proportion, and rounding makes shares add up exactly to the total.
export function split(items, people, assign, mode, printedTotal, voucher) {
  const base = Object.fromEntries(people.map((p) => [p.id, 0]));
  base._ = 0;
  for (const it of items) {
    const net = itemNetCents(it);
    const a = assign[it.id] || {};
    const ws = Object.entries(a).filter(([pid, w]) => w > 0 && pid in base);
    const W = ws.reduce((s, [, w]) => s + w, 0);
    if (!W) { base._ += net; continue; }
    for (const [pid, w] of ws) base[pid] += (net * w) / W;
  }
  const total = targetTotal(items, mode, printedTotal, voucher);
  const shares = apportion(base, cents(total));
  return { total, breakdown: breakdown(items, mode, voucher), shares: Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, v / 100])) };
}

// ---- PayNow / SGQR (EMVCo merchant-presented) ----
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
export function crc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function normalizeMobile(m) {
  const d = String(m || '').replace(/\D/g, '');
  if (/^[89]\d{7}$/.test(d)) return '+65' + d;
  if (/^65[89]\d{7}$/.test(d)) return '+' + d;
  return null;
}
export function paynowPayload({ mobile, amount, ref = '', name = 'NA' }) {
  const proxy = normalizeMobile(mobile);
  if (!proxy) throw new Error('Invalid SG mobile');
  const acct = tlv('00', 'SG.PAYNOW') + tlv('01', '0') + tlv('02', proxy) + tlv('03', '0');
  let p = tlv('00', '01') + tlv('01', '12') + tlv('26', acct) + tlv('52', '0000') + tlv('53', '702');
  if (amount) p += tlv('54', Number(amount).toFixed(2));
  p += tlv('58', 'SG') + tlv('59', name.slice(0, 25) || 'NA') + tlv('60', 'Singapore');
  const r = ref.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25);
  if (r) p += tlv('62', tlv('01', r));
  p += '6304';
  return p + crc16(p);
}
