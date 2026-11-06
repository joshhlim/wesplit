import { getShared } from '@/lib/shared';
export const dynamic = 'force-dynamic';
const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShared(id);
  if (s.status === 'unavailable') return Response.json({ error: 'unavailable' }, { status: 503, headers });
  if (s.status === 'missing') return Response.json(null, { status: 404, headers });
  if (s.status === 'revoked') return Response.json({ revoked: true }, { status: 200, headers });
  return Response.json(s.data, { status: 200, headers });
}
