/**
 * 정책문서 시드 스크립트 (AS-FILL-2 / 2c, 멱등 + URL 실검증 + 봇차단 구제).
 *
 * 실행: npm run seed:documents
 *
 * 후보 두 갈래:
 *  (a) 현행 법률 6종 — documents.data.json (law.go.kr lsId 기반 현행 '본문' 상세 링크)
 *  (b) sources 레지스트리의 소스별 대표 산출물 1건 — 런타임에 sources 테이블에서 생성.
 *      title=titleKo, sourceUrl=url 재활용, source_id로 소스와 연계.
 *
 * URL 실검증 정책(추측 URL 금지):
 *  브라우저 User-Agent로 HEAD → 실패 시 GET 재시도.
 *  - 2xx: 검증 통과 → upsert(verified).
 *  - 403/405(봇 차단): 서버는 살아있으나 자동수집기를 막는 경우. law.go.kr·SAMHSA·
 *    Lancet 등 '사람 방문자는 열람 가능한 공식 1차 출처'는 humanVerified 플래그가 있으면
 *    '실브라우저 접근 가능·봇 차단' 주석과 함께 등록한다(원칙 부합 — 사람이 여는 실링크).
 *  - 그 외(404/네트워크/타임아웃): 보류(held).
 *  ⚠️ 조직 egress가 외부 도메인을 막는 샌드박스에서는 대부분 보류/구제로 잡힌다.
 *     실제 판정은 인터넷이 열린 운영 환경(Render Shell)에서 확정된다.
 *
 * 멱등성: 법률은 title, 소스 산출물은 source_id 기준 upsert(있으면 갱신/없으면 삽입).
 * 스키마 변경 없음(source_id 컬럼은 마이그레이션으로 선행 추가). synchronize 사용 안 함.
 * deploy-init에는 태우지 않는다(외부 URL 검증이 매 배포마다 돌 필요 없음). 수동 1회 실행.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Document } from '../entities/document.entity';
import { Source } from '../../sources/entities/source.entity';
import { RegionCode } from '../../common/enums';
import lawsData from './documents.data.json';

// 실브라우저 UA. 공공기관/학술지 페이지의 데이터센터-봇 차단(403)을 줄이기 위해 사용.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 사람은 열람 가능하나 봇을 차단하는 공식 1차 출처(소스 레지스트리 id 기준).
// 403/405여도 humanVerified로 간주해 주석과 함께 등록한다(검색으로 실링크 확인 완료).
const BOT_BLOCK_HUMAN_VERIFIED = new Map<string, string>([
  [
    'samhsa_nsduh',
    '미국 SAMHSA NSDUH 데이터 페이지 · 실브라우저 접근 가능, 봇 차단',
  ],
  [
    'samhsa_nsumhss',
    '미국 SAMHSA 데이터 리포트 페이지 · 실브라우저 접근 가능, 봇 차단',
  ],
  [
    'lancet_gambling',
    'The Lancet Public Health 도박 커미션 · 실브라우저 접근 가능, 봇 차단',
  ],
]);

interface LawRow {
  title: string;
  country: string;
  source: string;
  year: number | null;
  domain: string;
  description: string;
  sourceUrl: string;
  humanVerified?: boolean;
  accessNote?: string;
}

interface Candidate {
  key: { title?: string; sourceId?: string };
  payload: Partial<Document>;
  url: string;
  label: string;
  /** 403/405(봇차단)일 때도 주석과 함께 등록할지 여부 */
  registerIfBotBlocked?: boolean;
  accessNote?: string;
}

/** HEAD → (403/405/네트워크 실패 시) GET 재시도. 최종 생존 여부/상태 반환. */
async function checkUrl(
  url: string,
): Promise<{ ok: boolean; status: number; method: string; reason: string }> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(25_000),
        redirect: 'follow',
      });
      if (res.ok) return { ok: true, status: res.status, method, reason: '' };
      // HEAD 차단(403/405)은 GET으로 재판정
      if (method === 'HEAD' && (res.status === 403 || res.status === 405)) {
        continue;
      }
      return {
        ok: false,
        status: res.status,
        method,
        reason: `HTTP ${res.status}`,
      };
    } catch (e: any) {
      if (method === 'HEAD') continue; // GET으로 재시도
      const reason =
        e?.name === 'TimeoutError'
          ? 'timeout'
          : e?.code || e?.message || 'error';
      return { ok: false, status: 0, method, reason };
    }
  }
  return { ok: false, status: -1, method: 'GET', reason: 'unreachable' };
}

const SCOPE_COUNTRY: Record<string, string> = {
  global: '국제',
  regional: '지역(EU 등)',
  korea: '대한민국',
};
const KIND_LABEL: Record<string, string> = {
  prevalence: '유병률·실태',
  policy: '정책',
  treatment: '치료',
  market: '시장·동향',
  enforcement: '단속·집행',
};

function buildSourceCandidates(sources: Source[]): Candidate[] {
  return sources.map((s) => {
    const kindKo = KIND_LABEL[s.kind] ?? s.kind;
    const humanNote = BOT_BLOCK_HUMAN_VERIFIED.get(s.id);
    return {
      key: { sourceId: s.id },
      url: s.url,
      label: `source:${s.id}`,
      registerIfBotBlocked: !!humanNote,
      accessNote: humanNote,
      payload: {
        title: s.titleKo,
        country: SCOPE_COUNTRY[s.scope] ?? s.scope,
        year: undefined,
        description: `${s.orgKo}(${s.org}) 발간 · ${kindKo} · 도메인 ${s.domain}. 데이터 관측소 소스 레지스트리 대표 산출물.`,
        summary: s.titleEn,
        sourceUrl: s.url,
        source: s.orgKo,
        sourceId: s.id,
        region: s.scope === 'korea' ? RegionCode.KR : RegionCode.OTHER,
      },
    };
  });
}

function buildLawCandidates(laws: LawRow[]): Candidate[] {
  return laws.map((l) => ({
    key: { title: l.title },
    url: l.sourceUrl,
    label: `law:${l.title}`,
    registerIfBotBlocked: !!l.humanVerified,
    accessNote: l.accessNote,
    payload: {
      title: l.title,
      country: l.country,
      year: l.year ?? undefined,
      description: l.description,
      summary: `소관 ${l.source} · ${l.domain}`,
      sourceUrl: l.sourceUrl,
      source: l.source,
      sourceId: null,
      region: RegionCode.KR,
    },
  }));
}

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const docRepo = ds.getRepository(Document);
  const sourceRepo = ds.getRepository(Source);

  const sources = await sourceRepo.find();
  const candidates: Candidate[] = [
    ...buildLawCandidates((lawsData as { laws: LawRow[] }).laws),
    ...buildSourceCandidates(sources),
  ];

  console.log(
    `[seed:documents] 후보 ${candidates.length}건 (법률 ${(lawsData as { laws: LawRow[] }).laws.length} + 소스 산출물 ${sources.length}) — URL 실검증 시작(브라우저 UA)`,
  );

  const before = await docRepo.count();
  let inserted = 0;
  let updated = 0;
  let botRescued = 0;
  const held: { label: string; url: string; reason: string }[] = [];

  for (const c of candidates) {
    const chk = await checkUrl(c.url);
    const botBlocked = !chk.ok && (chk.status === 403 || chk.status === 405);
    const rescue = botBlocked && !!c.registerIfBotBlocked;

    if (!chk.ok && !rescue) {
      held.push({ label: c.label, url: c.url, reason: chk.reason });
      console.log(`[url] HELD  ${c.label} (${chk.reason}) ${c.url}`);
      await sleep(600);
      continue;
    }

    // 등록 페이로드 구성. 봇차단 구제분은 접근 주석을 description에 덧붙인다.
    const payload: Partial<Document> = { ...c.payload };
    if (rescue && c.accessNote) {
      payload.description =
        `${payload.description ?? ''} [접근: ${c.accessNote}]`.trim();
      botRescued++;
      console.log(
        `[url] REG*  ${c.label} (봇차단 ${chk.status}·실브라우저 접근 → 등록)`,
      );
    } else {
      console.log(`[url] OK    ${c.label} (${chk.method} ${chk.status})`);
    }

    const where = c.key.sourceId
      ? { sourceId: c.key.sourceId }
      : { title: c.key.title! };
    const existing = await docRepo.findOne({ where });
    if (existing) {
      await docRepo.update(existing.id, payload);
      updated++;
    } else {
      await docRepo.save(docRepo.create(payload));
      inserted++;
    }
    await sleep(600);
  }

  const after = await docRepo.count();
  console.log(
    `\n[seed:documents] upsert 신규 ${inserted} / 갱신 ${updated} (봇차단 구제 ${botRescued}) · 보류 ${held.length}`,
  );
  console.log(`[seed:documents] documents 총량 ${before} → ${after}건`);
  if (held.length) {
    console.log('[seed:documents] 보류 목록(URL 미검증):');
    for (const h of held) console.log(`  - ${h.label}: ${h.reason} <${h.url}>`);
  }

  await ds.destroy();
}

run().catch((e) => {
  console.error('[seed:documents] 실패:', e);
  process.exit(1);
});
