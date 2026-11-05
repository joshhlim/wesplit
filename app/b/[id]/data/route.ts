import { getShared } from '@/lib/shared';
export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShared(id);
  return Response.json(s, { status: s ? 200 : 404, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
