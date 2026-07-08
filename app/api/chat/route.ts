import { after } from 'next/server';
import { bot } from '@/lib/bot';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
const STALE_WINDOW_MS = 10 * WINDOW_MS;

type RateLimitBucket = {
  count: number;
  windowStart: number;
  lastSeen: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getRateLimitPerMinute(): number {
  const raw = Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE ?? DEFAULT_RATE_LIMIT_PER_MINUTE);
  if (!Number.isFinite(raw)) return DEFAULT_RATE_LIMIT_PER_MINUTE;
  return Math.max(1, Math.floor(raw));
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp || 'unknown';
}

function parseAllowedOrigins(): string[] {
  const raw = process.env.CHAT_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = forwardedHost || request.headers.get('host') || new URL(request.url).host;
    return originUrl.host === host;
  } catch {
    return false;
  }
}

function cleanStaleBuckets(now: number): void {
  if (buckets.size < 2000) return;
  for (const [ip, bucket] of buckets.entries()) {
    if (now - bucket.lastSeen > STALE_WINDOW_MS) {
      buckets.delete(ip);
    }
  }
}

function checkRateLimit(request: Request): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const limit = getRateLimitPerMinute();
  const ip = getClientIp(request);

  cleanStaleBuckets(now);

  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now, lastSeen: now });
    return { ok: true };
  }

  bucket.lastSeen = now;
  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  bucket.count += 1;
  return { ok: true };
}

export async function POST(request: Request): Promise<Response> {
  if (!isAllowedOrigin(request)) {
    return Response.json(
      { error: 'Origin not allowed' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: 'Payload too large' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const rateLimit = checkRateLimit(request);
  if (!rateLimit.ok) {
    return Response.json(
      { error: 'Too many requests. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return bot.webhooks.web(request, {
    waitUntil: (task) => after(() => task),
  });
}
