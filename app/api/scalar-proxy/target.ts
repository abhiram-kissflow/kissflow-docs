// Target allowlist for the Scalar try-it proxy. Kept out of route.ts because
// Next.js only permits HTTP-handler + known config exports from a route file.
//
// ponytail: target is locked to *.kissflow.com — the only server in the spec.
// This makes it a purpose-built proxy, not an open SSRF relay, so no CIDR
// blocklist is needed. Add domains here if the spec ever gains more servers.
export const ALLOWED_SUFFIXES = ['.kissflow.com'];

/** True when `target` is an absolute http(s) URL on an allowed Kissflow host. */
export function isAllowedTarget(target: string | null): boolean {
  if (!target) return false;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
}
