/**
 * 영어 화면 한글 0 관문 (SOC-R9 ■1).
 *
 * en 빌드 산출 HTML 에서 손님 눈에 닿는 글(본문 글자 + title·alt·aria-label·placeholder·
 * meta content)만 본다. <script>·<style> 안(RSC 실림짐)은 화면 글이 아니라 뺀다.
 * 예외 = 출처 고유명 허용 목록(출처의 한국어 공식 이름 titleKo·orgKo) — /en/sources 의
 * 원어 부제처럼 「고유명 그대로」 보여 주는 자리만. 그 밖의 한글은 모두 걸린다.
 *
 * 의존 없음(시험: node --test src/lib/enHangulGate.test.mts).
 */

export const HANGUL_RE = /[가-힣ㄱ-ㆎ]/;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** 화면에 보이는 글 조각들(본문 글자 + 보이는 속성) */
export function visibleTexts(html: string): string[] {
  const body = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ');
  const out: string[] = [];
  for (const m of body.matchAll(
    /\s(?:title|alt|aria-label|placeholder|content)="([^"]*)"/gi,
  )) {
    out.push(decode(m[1]));
  }
  for (const piece of body.replace(/<!--[\s\S]*?-->/g, ' ').split(/<[^>]*>/)) {
    const t = decode(piece).trim();
    if (t) out.push(t);
  }
  return out;
}

/** 허용 목록 이름을 지운 뒤에도 한글이 남은 조각 */
export function hangulLeaks(html: string, allow: Iterable<string>): string[] {
  const names = [...new Set(allow)]
    .filter((n) => n && HANGUL_RE.test(n))
    .sort((a, b) => b.length - a.length);
  const leaks: string[] = [];
  for (const text of visibleTexts(html)) {
    if (!HANGUL_RE.test(text)) continue;
    let rest = text;
    for (const n of names) rest = rest.split(n).join(' ');
    if (HANGUL_RE.test(rest)) leaks.push(text);
  }
  return [...new Set(leaks)];
}

/** sources.seed.ts 의 titleKo · orgKo (출처 고유명) */
export function sourceProperNames(seedSource: string): string[] {
  return [
    ...seedSource.matchAll(/\b(?:titleKo|orgKo):\s*'([^']+)'/g),
  ].map((m) => m[1]);
}
