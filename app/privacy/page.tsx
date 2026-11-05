import Link from 'next/link';
export const metadata = { title: 'Privacy' };
export default function Privacy() {
  return (
    <main className="privacy">
      <h1>Privacy</h1>
      <p><b>Without an account</b>, everything stays on your phone (browser storage). Nothing is sent to us except receipt photos you scan.</p>
      <p><b>Receipt photos</b> are sent to Google Gemini to read the items, then discarded. We don&apos;t store them.</p>
      <p><b>With an account</b>, we store your email, your PayNow number and name, your saved bills (place, date, total, items, people, shares and paid status) and your friends list, so they sync across your devices. Data is kept in Supabase (Singapore) and only you can read it.</p>
      <p><b>Delete anytime</b> from the account menu. This removes your account and all synced data.</p>
      <p>WeSplit has no ads or trackers. <a href="https://github.com/joshhlim/wesplit">The code is open source.</a></p>
      <Link href="/" className="btn primary">Back to WeSplit</Link>
    </main>
  );
}
