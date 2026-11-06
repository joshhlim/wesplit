// Pure UI-state helpers. No network, no DOM. Kept separate so the labels can be tested
// without booting Next or touching the split maths.

export function classifyShare(status, body) {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return { status: 'unavailable' };
  if (body && typeof body === 'object' && body.revoked) return { status: 'revoked' };
  if (status === 404 || status === 400 || status === 406 || body == null) return { status: 'missing' };
  if (status >= 200 && status < 300 && typeof body === 'object') return { status: 'ok', data: body };
  return { status: 'unavailable' };
}

export function linkProblem(message) {
  const m = String(message || '').toLowerCase();
  if (!m.trim()) return 'invalid';
  if (m.includes('expired')) return 'expired';
  if (m.includes('invalid') || m.includes('otp') || m.includes('not found') || m.includes('already been used')) return 'invalid';
  return 'other';
}

export function syncedLabel(at, now) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'Synced just now';
  const m = Math.round(s / 60);
  if (m < 60) return `Synced ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Synced ${h} hr ago`;
  const d = Math.round(h / 24);
  return `Synced ${d} day${d === 1 ? '' : 's'} ago`;
}
