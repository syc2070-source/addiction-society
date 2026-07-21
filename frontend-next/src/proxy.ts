import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * locale 라우팅 프록시 (Next 16에서 middleware.ts의 새 이름).
 * '/'는 ko(무접두사), '/en/...'만 영어. api·정적 자산은 제외.
 */
export default createMiddleware(routing);

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
