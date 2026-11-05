import { ImageResponse } from 'next/og';
import { Mark } from '@/components/brand';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export default function Icon() { return new ImageResponse(<Mark size={180} radius={0} pad={0.12} />, size); }
