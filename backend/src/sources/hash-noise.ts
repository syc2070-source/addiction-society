import { createHash } from 'crypto';

/**
 * 「날마다 바뀌는 글자」 거르기 (SOC-R9 ■2) — 본문 해시 감시(accessDetail.detect 'hash')만.
 *
 * 규칙: 해시 바뀜 ∧ 본문 길이 차 < 1% ∧ 바뀐 토막이 날짜·숫자 글자만 → 「발간 아님」.
 *  - 사건: changed 를 쌓지 않는다. 그날 확인(checked) 줄에 detail.notRelease 를 붙이고 감시 로그만.
 *  - 「날짜·숫자 글자만」 = 숫자와 달 이름을 0 으로 가린 본문(digitMask)의 해시가 같다.
 *  - 비교 기준(fingerprint: 정규화 본문 길이 + 가린 본문 해시)은 확인·변경 사건 detail.fp 에 남긴다
 *    (스키마 변경 0). 앞선 fp 가 없으면 규칙을 쓰지 않고 지금처럼 changed.
 * 그 밖의 바뀜은 지금처럼 changed. 게시판·ETag·Last-Modified 감시는 손대지 않는다.
 *
 * 잘못 쌓인 옛 사건은 지우지 않는다(사건 삭제 0) — 읽을 때 isNotRelease 로 표식만.
 */

export interface HashFingerprint {
  /** 정규화 본문 길이 */
  len: number;
  /** digitMask(본문) sha256 앞 16자 */
  masked: string;
}

export interface NotReleaseDetail {
  reason: 'digits-only';
  lenPrev: number;
  lenNew: number;
  /** |길이 차| / 앞 길이 (소수 넷째 자리) */
  lenDiffRatio: number;
  prevHash: string | null;
  newHash: string;
}

const MONTHS =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;

const YEAR = /^(?:19|20)\d{2}$/;

/**
 * 글자 부분의 숫자 덩이(자릿수·쉼표·소수점 포함)와 달 이름을 0 으로.
 * 리뷰 수리: 해(19xx·20xx)와 태그 안(href·src 의 /2026/…GSHR-2026.pdf)은 가리지 않는다 —
 * 새 판이 해만 바꿔 나와도 「발간 아님」으로 묻히지 않게.
 */
export function digitMask(body: string): string {
  return body
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part
            .replace(MONTHS, '0')
            .replace(/\d[\d,.]*/g, (n) => (YEAR.test(n) ? n : '0')),
    )
    .join('');
}

export function fingerprint(normalizedBody: string): HashFingerprint {
  return {
    len: normalizedBody.length,
    masked: createHash('sha256')
      .update(digitMask(normalizedBody))
      .digest('hex')
      .slice(0, 16),
  };
}

/** detail.fp 꼴 확인 */
export function readFingerprint(detail: unknown): HashFingerprint | null {
  const fp = (detail as { fp?: unknown } | null)?.fp as
    | Partial<HashFingerprint>
    | undefined;
  return fp && typeof fp.len === 'number' && typeof fp.masked === 'string'
    ? { len: fp.len, masked: fp.masked }
    : null;
}

/** 규칙 판정. 앞 fp 가 없으면 null(판정 못 함 → 지금처럼 changed). */
export function judgeHashChange(
  prev: HashFingerprint | null,
  next: HashFingerprint,
  hashes: { prevHash: string | null; newHash: string },
): NotReleaseDetail | null {
  if (!prev || prev.len <= 0) return null;
  const ratio = Math.abs(next.len - prev.len) / prev.len;
  if (ratio >= 0.01) return null;
  if (prev.masked !== next.masked) return null;
  return {
    reason: 'digits-only',
    lenPrev: prev.len,
    lenNew: next.len,
    lenDiffRatio: Math.round(ratio * 10000) / 10000,
    prevHash: hashes.prevHash,
    newHash: hashes.newHash,
  };
}

/** 이 감시 방식이 Last-Modified·ETag 를 버리고 본문 해시로 바뀐 출처인가(hri_gshr) */
export function watchesBodyHash(accessDetail: unknown): boolean {
  return (accessDetail as { detect?: unknown } | null)?.detect === 'hash';
}

/**
 * 읽을 때의 「발간 아님」 표식.
 *  ① 새 규칙으로 남은 확인 줄(detail.notRelease)
 *  ② 본문 해시 감시로 바뀐 출처의 옛 ETag·Last-Modified changed — 10월 hri 6건:
 *     같은 달 본문은 그대로였고(10-18 79,059바이트 · 해시 e1e8f848… = 10-19 기준선) 최신판은 2024 그대로.
 */
export function isNotRelease(
  e: {
    eventType: string;
    detail?: Record<string, unknown> | null;
    detectedAt?: Date | string | null;
  },
  sourceAccessDetail: unknown,
): boolean {
  if (e.detail?.notRelease) return true;
  if (e.eventType !== 'changed' || !watchesBodyHash(sourceAccessDetail)) {
    return false;
  }
  const method = e.detail?.method;
  if (method !== 'last-modified' && method !== 'etag') return false;
  // 리뷰 수리: 되짚어 본 달(2026-10 · 해시 감시로 바꾸기 전)만 — 그 밖의 옛 사건은 판정하지 않았다
  const at = e.detectedAt ? new Date(e.detectedAt).getTime() : NaN;
  return at >= RECLASSIFIED_FROM && at < RECLASSIFIED_UNTIL;
}

/** 되짚어 분류한 구간: 2026-10-01 00:00 KST ~ SOC-R8 해시 감시 전환(migration 1788700000002 · 10-18 05:18:08Z) */
const RECLASSIFIED_FROM = Date.parse('2026-09-30T15:00:00Z');
const RECLASSIFIED_UNTIL = Date.parse('2026-10-18T05:18:08Z');
