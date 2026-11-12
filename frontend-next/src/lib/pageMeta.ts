/**
 * 쪽마다 제 대표 주소(canonical) · hreflang (SOC-R24 ■5 · 결정 6).
 * 레이아웃은 더 이상 canonical 을 대문(/)으로 박지 않는다 — 쪽이 제 길을 넘긴다.
 * path = locale 접두사 없는 길('' = 대문 · '/policy-map' …). 쿼리는 넣지 않는다(목록 쪽 ?page= 는 같은 쪽).
 * 기준 호스트는 레이아웃의 metadataBase(NEXT_PUBLIC_SITE_URL)를 그대로 쓴다.
 */
export function selfAlternates(locale: string, path: string) {
  const ko = path || '/';
  return {
    canonical: locale === 'ko' ? ko : `/${locale}${path}`,
    languages: { ko, en: `/en${path}`, 'x-default': ko },
  };
}
