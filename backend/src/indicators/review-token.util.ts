import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 검수 배치용 서명 토큰 (AS-PDF-RUN).
 *
 * ── 왜 이런 게 필요한가 ────────────────────────────────────────────────
 * 사용자는 관리자 계정을 쓰지 않는다. 그런데 PDF 표 추출값은 기계 오독 위험이
 * 있어 사람 검수가 필수다(원칙 8). 관리자 UI를 만들 여력이 없으면 검수가
 * 병목이 되고, 병목이 되면 파이프를 켤 수 없다.
 * → 알림(Discord)만으로 검수가 끝나야 한다.
 *
 * ── 원칙 12(쓰기·승인은 admin만)와의 관계 ──────────────────────────────
 * 이 토큰은 **세션이 아니라 능력(capability)**이다. 원칙 12를 우회하는 것이
 * 아니라, 그 권한의 아주 얇은 조각 하나를 서명해서 위임한다.
 *
 *  1. 범위: 특정 배치 1건의 승인/폐기만. 다른 데이터 생성·수정·조회 불가.
 *  2. 전달 경로: Discord 관측소 채널. 웹훅 URL 자체가 비밀값(원칙 10)이고
 *     채널은 운영자 전용이므로, 토큰을 볼 수 있는 사람 = 이미 운영자다.
 *  3. 위조 불가: 서버 비밀키(REVIEW_TOKEN_SECRET, 없으면 JWT_SECRET 파생)로
 *     HMAC-SHA256 서명. 비교는 timingSafeEqual.
 *  4. 만료: 기본 14일. 회차가 연 1회라 넉넉하되 영구 링크는 아니다.
 *  5. 1회성: 배치가 처리되면 pending이 사라져 재사용해도 무효(0건 처리).
 *  6. GET은 절대 상태를 바꾸지 않는다 — 확인 화면만 렌더한다. 실제 처리는
 *     그 화면의 버튼(POST)에서 일어난다. Discord·메신저의 링크 미리보기
 *     크롤러가 자동 승인해 버리는 사고를 막기 위한 것이다.
 *
 * 남는 위험은 "Discord 채널이 털리면 승인도 털린다"인데, 그 시점엔 이미
 * 웹훅으로 관측소 알림을 위조할 수 있으므로 이 토큰이 추가로 늘리는 공격면은
 * 사실상 없다. 반대로 얻는 것은 "검수가 실제로 일어난다"이다.
 */

const SEP = '.';
const DEFAULT_TTL_DAYS = 14;

export interface ReviewTokenPayload {
  batch: string;
  /** 만료 시각(epoch 초) */
  exp: number;
}

/** base64url — URL에 그대로 넣을 수 있게 */
function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(data: string, secret: string): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

/**
 * 배치 검수 토큰 발급. `<payload>.<signature>` 형태.
 * secret은 호출자가 주입한다(ConfigService 의존을 여기 두지 않기 위함).
 */
export function issueReviewToken(
  batch: string,
  secret: string,
  ttlDays = DEFAULT_TTL_DAYS,
  now: Date = new Date(),
): string {
  const exp = Math.floor(now.getTime() / 1000) + ttlDays * 86400;
  const payload: ReviewTokenPayload = { batch, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${body}${SEP}${sign(body, secret)}`;
}

/** 검증 결과 — 실패 사유를 사람이 읽을 수 있게 돌려준다. */
export type ReviewTokenResult =
  | { ok: true; batch: string; exp: number }
  | { ok: false; reason: '형식 오류' | '서명 불일치' | '만료됨' };

export function verifyReviewToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): ReviewTokenResult {
  const parts = token.split(SEP);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: '형식 오류' };
  }
  const [body, sig] = parts;

  const expected = sign(body, secret);
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  // 길이가 다르면 timingSafeEqual이 throw 하므로 먼저 거른다.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: '서명 불일치' };
  }

  let payload: ReviewTokenPayload;
  try {
    payload = JSON.parse(
      fromB64url(body).toString('utf8'),
    ) as ReviewTokenPayload;
  } catch {
    return { ok: false, reason: '형식 오류' };
  }
  if (!payload?.batch || typeof payload.exp !== 'number') {
    return { ok: false, reason: '형식 오류' };
  }
  if (payload.exp * 1000 < now.getTime()) {
    return { ok: false, reason: '만료됨' };
  }
  return { ok: true, batch: payload.batch, exp: payload.exp };
}

/** 배치 id 생성: `<소스>:<회차>:<타임스탬프36>` — 사람이 로그에서 알아볼 수 있게. */
export function newBatchId(
  sourceId: string,
  period: string,
  now: Date = new Date(),
): string {
  return `${sourceId}:${period}:${now.getTime().toString(36)}`;
}
