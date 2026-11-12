import type { MetadataRoute } from 'next';
import { evidenceTopics } from '@/lib/evidenceMap';
import { loadStatoryExport, typesWithCards } from '@/lib/statoryEvidence';
import { pageOpens, standingSections } from '@/lib/policyMap';

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
  '/evidence-map',
  // 정책 쪽 — 칸 일곱 가운데 넷 이상이 설 때만(SOC-R24 결정 7 · 주제 쪽은 noindex 라 넣지 않음)
  ...(pageOpens(standingSections()) ? ['/policy-map'] : []),
  // 근거 지도 주제는 index.json 에서 자동으로 (SOC-R2)
  ...evidenceTopics().map((tp) => `/evidence-map/${tp}`),
  // 연구는 무엇을 말하나 — 실물 Statory 카드가 있는 유형만(SOC-R22 ■3 · /preview 는 넣지 않음)
  ...evidenceTypePaths(),
];

function evidenceTypePaths(): string[] {
  const real = loadStatoryExport();
  return real ? typesWithCards(real.data).map((t) => `/evidence/${t}`) : [];
}

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
