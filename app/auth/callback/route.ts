import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { linkProblem } from '@/lib/status.mjs';

function back(url: URL, message: string) {
  const kind = linkProblem(message);
  if (kind === 'expired' || kind === 'invalid') return NextResponse.redirect(new URL('/?link=' + kind, url.origin));
  return NextResponse.redirect(new URL('/?authError=' + encodeURIComponent(message), url.origin));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const err = [url.searchParams.get('error_code'), url.searchParams.get('error_description')].filter(Boolean).join(' ');
  if (code) {
    const store = await cookies();
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => store.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)) },
    });
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/?signedin=1', url.origin));
    return back(url, error.message);
  }
  return back(url, err || 'Sign-in link was invalid or expired.');
}
