import test from 'node:test';
import assert from 'node:assert';
import { split, detectMode, crc16, paynowPayload } from './split.mjs';
const items = [{ id: 'a', price: 10 }, { id: 'b', price: 20 }, { id: 'c', price: 3.33 }];
const people = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
test('detect', () => {
  assert.equal(detectMode(items, 39.96), 'sg');
  assert.equal(detectMode(items, 36.33), 'gst');
  assert.equal(detectMode(items, 33.33), 'none');
});
test('shares sum exactly', () => {
  const r = split(items, people, { a: { x: 1 }, b: { x: 1, y: 1, z: 1 }, c: { y: 2, z: 1 } }, 'sg', 39.96);
  const sum = Object.values(r.shares).reduce((s, v) => s + Math.round(v * 100), 0);
  assert.equal(sum, 3996); assert.equal(r.shares._, 0);
});
test('crc', () => assert.equal(crc16('123456789'), '29B1'));
test('paynow', () => {
  const p = paynowPayload({ mobile: '91234567', amount: 12.5, ref: 'WeSplit' });
  assert.match(p, /SG\.PAYNOW.*\+6591234567.*540512\.50/);
  assert.equal(p.slice(-4), crc16(p.slice(0, -4)));
});
import { breakdown, charges } from './split.mjs';
const P2 = [{ id: 'me' }, { id: 'a' }];
const sum = (r) => Object.values(r.shares).reduce((s, v) => s + Math.round(v * 100), 0);
test('SG charges: service on subtotal, GST on subtotal + service', () => {
  assert.deepEqual(charges(10000, 'sg'), { sc: 1000, gst: 990, total: 11990 });
  assert.deepEqual(charges(3333, 'sg'), { sc: 333, gst: 330, total: 3996 });
  assert.deepEqual(charges(10000, 'gst'), { sc: 0, gst: 900, total: 10900 });
  assert.deepEqual(charges(10000, 'svc'), { sc: 1000, gst: 0, total: 11000 });
});
test('uneven 2:1 portions', () => {
  const r = split([{ id: 'x', price: 30 }], P2, { x: { me: 2, a: 1 } }, 'none');
  assert.equal(r.shares.me, 20); assert.equal(r.shares.a, 10);
});
test('per-item discount and 1-for-1 come off before charges', () => {
  const its = [{ id: 'x', price: 20, disc: 5 }, { id: 'y', price: 10, free: true }, { id: 'z', price: 10 }];
  const b = breakdown(its, 'sg');
  assert.equal(b.gross, 4000); assert.equal(b.itemDisc, 1500); assert.equal(b.sub, 2500);
  assert.equal(b.sc, 250); assert.equal(b.gst, 248); assert.equal(b.total, 2998);
  const r = split(its, P2, { x: { me: 1 }, y: { a: 1 }, z: { a: 1 } }, 'sg');
  assert.equal(sum(r), 2998); assert.equal(r.shares.me, 17.99); assert.equal(r.shares.a, 11.99);
});
test('percent voucher', () => {
  const its = [{ id: 'x', price: 60 }, { id: 'y', price: 40 }];
  const b = breakdown(its, 'sg', { kind: 'pct', value: 10 });
  assert.equal(b.voucher, 1000); assert.equal(b.sub, 9000); assert.equal(b.total, 10791);
  const r = split(its, P2, { x: { me: 1 }, y: { a: 1 } }, 'sg', null, { kind: 'pct', value: 10 });
  assert.equal(r.shares.me, 64.75); assert.equal(r.shares.a, 43.16); assert.equal(sum(r), 10791);
});
test('amount voucher is shared in proportion and never goes negative', () => {
  const its = [{ id: 'x', price: 15 }, { id: 'y', price: 5 }];
  const r = split(its, P2, { x: { me: 1 }, y: { a: 1 } }, 'gst', null, { kind: 'amt', value: 4 });
  assert.equal(sum(r), Math.round(1600 * 1.09)); assert.equal(r.shares.me, 13.08); assert.equal(r.shares.a, 4.36);
  assert.equal(breakdown(its, 'sg', { kind: 'amt', value: 99 }).total, 0);
});
test('printed total after discounts is detected and used', () => {
  const its = [{ id: 'x', price: 20, disc: 5 }, { id: 'y', price: 10, free: true }, { id: 'z', price: 10 }];
  assert.equal(detectMode(its, 29.98), 'sg');
  const r = split(its, P2, { x: { me: 1 }, z: { a: 1 } }, 'sg', 29.98);
  assert.equal(r.total, 29.98); assert.equal(r.shares._, 0);
});
