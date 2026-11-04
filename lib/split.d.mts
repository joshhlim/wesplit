export const MODES: Record<'sg' | 'gst' | 'svc' | 'none', { label: string; factor: number }>;
export function cents(n: number): number;
export function itemsSum(items: { price: number }[]): number;
export function detectMode(items: { price: number }[], total: number | null): string | null;
export function targetTotal(items: { price: number }[], mode: string, printedTotal: number | null): number;
export function split(items: { id: string; price: number }[], people: { id: string }[], assign: Record<string, Record<string, number>>, mode: string, printedTotal: number | null): { total: number; shares: Record<string, number> };
export function crc16(s: string): string;
export function normalizeMobile(m: string): string | null;
export function paynowPayload(o: { mobile: string; amount?: number; ref?: string; name?: string }): string;
