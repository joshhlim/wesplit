import { ImageResponse } from 'next/og';
import { Mark } from '@/components/brand';
export const dynamic = 'force-static';
export function GET() { return new ImageResponse(<Mark size={512} radius={0.22} />, { width: 512, height: 512 }); }
