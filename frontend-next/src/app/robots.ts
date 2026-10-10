import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** robots.txt — 전체 허용(관리자 검수 창 제외) + sitemap 안내 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/en/admin'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
