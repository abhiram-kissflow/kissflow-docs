import { createI18nMiddleware } from 'fumadocs-core/i18n/middleware';
import { i18n } from '@/lib/i18n';

export default createI18nMiddleware(i18n);

export const config = {
  // Skip API routes, static assets, and files with extensions.
  // Note: `api/` (not `api`) so /api-reference still gets the i18n rewrite.
  matcher: ['/((?!api/|_next|og|llms|favicon|.*\\..*).*)'],
};
