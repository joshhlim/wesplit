'use client';
import { Crash } from '@/components/crash';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Crash reset={reset} />;
}
