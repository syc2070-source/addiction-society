import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** 현존 페이지 (locale 무접두사 기준). 새 페이지 추가 시 여기에도 등록할 것 */
const PATHS = [
  '',
  '/sources',
  '/calendar',
  '/indicators',
  '/timeline',
  '/lab',
  '/policy',
  '/research',
  '/recovery',
  '/about',
];

/** sitemap.xml — ko(무접두사)·en 쌍 + hreflang alternate */
export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((p) => ({
    url: `${SITE_URL}${p || '/'}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: p === '' ? 1 : 0.7,
    alternates: {
      languages: {
        ko: `${SITE_URL}${p || '/'}`,
        en: `${SITE_URL}/en${p}`,
      },
    },
  }));
}
