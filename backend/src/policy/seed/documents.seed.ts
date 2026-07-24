/**
 * 정책문서 시드 스크립트 (AS-FILL-2, 멱등 + URL 실검증).
 *
 * 실행: npm run seed:documents
 *
 * 후보 두 갈래:
 *  (a) 현행 법률 6종 — documents.data.json (law.go.kr 현행 링크)
 *  (b) sources 레지스트리의 소스별 대표 산출물 1건 — 런타임에 sources 테이블에서 생성.
 *      title=titleKo, sourceUrl=url 재활용, source_id로 소스와 연계.
 *
 * URL 실검증(핵심 요구사항 — 추측 URL 금지):
 *  각 후보 URL에 HEAD 요청 → 실패면 GET 재시도(403/405 HEAD 차단 오탐 대응).
 *  통과분만 upsert하고, 실패분은 '보류(held)' 목록으로 로그에 남긴다.
 *  ⚠️ 조직 egress 정책이 외부 도메인을 막는 샌드박스에서는 전부 held가 될 수 있다.
 *     이 검증은 인터넷이 열린 운영 환경(Render Shell)에서 실제 통과분을 결정한다.
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

const UA = 'AddictionSociety-Observatory/1.0 (+https://addictionsociety.net)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface LawRow {
  title: string;
  country: string;
  source: string;
  year: number | null;
  domain: string;
  description: string;
  sourceUrl: string;
}

interface Candidate {
  key: { title?: string; sourceId?: string };
  payload: Partial<Document>;
  url: string;
  label: string;
}

/** HEAD → (403/405/네트워크 실패 시) GET 재시도. 최종 생존 여부 반환. */
async function checkUrl(
  url: string,
): Promise<{ ok: boolean; status: number; method: string; reason: string }> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': UA },
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
    return {
      key: { sourceId: s.id },
      url: s.url,
      label: `source:${s.id}`,
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
    `[seed:documents] 후보 ${candidates.length}건 (법률 ${(lawsData as { laws: LawRow[] }).laws.length} + 소스 산출물 ${sources.length}) — URL 실검증 시작`,
  );

  const before = await docRepo.count();
  let inserted = 0;
  let updated = 0;
  const held: { label: string; url: string; reason: string }[] = [];

  for (const c of candidates) {
    const chk = await checkUrl(c.url);
    if (!chk.ok) {
      held.push({ label: c.label, url: c.url, reason: chk.reason });
      console.log(`[url] HELD  ${c.label} (${chk.reason}) ${c.url}`);
      await sleep(800);
      continue;
    }
    console.log(`[url] OK    ${c.label} (${chk.method} ${chk.status})`);

    const where = c.key.sourceId
      ? { sourceId: c.key.sourceId }
      : { title: c.key.title! };
    const existing = await docRepo.findOne({ where });
    if (existing) {
      await docRepo.update(existing.id, c.payload);
      updated++;
    } else {
      await docRepo.save(docRepo.create(c.payload));
      inserted++;
    }
    await sleep(800);
  }

  const after = await docRepo.count();
  console.log(
    `\n[seed:documents] 통과 upsert: 신규 ${inserted} / 갱신 ${updated} · 보류 ${held.length}`,
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
