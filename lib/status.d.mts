export type ShareClass = 'ok' | 'missing' | 'revoked' | 'unavailable';
export function classifyShare(status: number, body: unknown): { status: ShareClass; data?: unknown };
export function linkProblem(message: string): 'expired' | 'invalid' | 'other';
export function syncedLabel(at: number, now: number): string;
