import test from 'node:test';
import assert from 'node:assert';
import { classifyShare, linkProblem, syncedLabel } from './status.mjs';

const bill = { place: 'Cafe', revoked: false };

test('share responses stay distinct', () => {
  assert.deepEqual(classifyShare(200, bill).status, 'ok');
  assert.equal(classifyShare(200, bill).data.place, 'Cafe');
  assert.equal(classifyShare(200, null).status, 'missing');
  assert.equal(classifyShare(404, null).status, 'missing');
  assert.equal(classifyShare(400, { message: 'bad' }).status, 'missing');
  assert.equal(classifyShare(200, { revoked: true, place: 'Cafe' }).status, 'revoked');
  assert.equal(classifyShare(503, null).status, 'unavailable');
  assert.equal(classifyShare(500, { revoked: true }).status, 'unavailable');
  assert.equal(classifyShare(0, null).status, 'unavailable');
  assert.equal(classifyShare(401, { message: 'nope' }).status, 'unavailable');
  assert.equal(classifyShare(408, null).status, 'unavailable');
  assert.equal(classifyShare(429, null).status, 'unavailable');
});

test('magic-link problems', () => {
  assert.equal(linkProblem(''), 'invalid');
  assert.equal(linkProblem('Email link is invalid or has expired'), 'expired');
  assert.equal(linkProblem('otp_expired Email link is invalid or has expired'), 'expired');
  assert.equal(linkProblem('invalid request'), 'invalid');
  assert.equal(linkProblem('Token has already been used'), 'invalid');
  assert.equal(linkProblem('provider is not enabled'), 'other');
});

test('synced label stays honest about age', () => {
  const now = 1_000_000_000_000;
  assert.equal(syncedLabel(now - 10_000, now), 'Synced just now');
  assert.equal(syncedLabel(now - 44_000, now), 'Synced just now');
  assert.equal(syncedLabel(now - 60_000, now), 'Synced 1 min ago');
  assert.equal(syncedLabel(now - 90 * 60_000, now), 'Synced 2 hr ago');
  assert.equal(syncedLabel(now - 26 * 60 * 60_000, now), 'Synced 1 day ago');
  assert.equal(syncedLabel(now - 3 * 24 * 60 * 60_000, now), 'Synced 3 days ago');
});
