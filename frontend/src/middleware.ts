import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Locale negotiation + redirect to a locale-prefixed path (Req 17.1, 17.2).
export default createMiddleware(routing);

export const config = {
  // Match every path except Next internals, API route handlers, and static asset files.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
