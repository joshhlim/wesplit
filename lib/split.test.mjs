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
