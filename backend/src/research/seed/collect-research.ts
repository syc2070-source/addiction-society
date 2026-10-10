/**
 * 학술자료 수집 파이프 (AS-FILL-2) — OpenAlex API 직접 수집.
 *
 * 실행: npm run collect:research
 *
 * 설계 판단: 배치 대량 수집·인용순 정렬·DOI 필수 필터를 안정적으로 보장하려면
 * OpenAlex(무료·키 불필요·CC0)를 직접 호출하는 편이 재현성이 높다. 이 배치 스크립트는
 * OpenAlex를 1차 소스로 쓴다. (구 AUTO_COLLECT 자동수집 경로는 AS-M3-1에서 폐기됨.)
 *
 * 절차: 도메인(D0~D3)별 질의어(분야 설정 파일)로 인용수 상위 문헌을 수집 →
 *   DOI 있는 것만(없으면 제외) → research 테이블에 멱등 upsert.
 *   신규 행 status 는 관련성 관문(relevance.ts) 통과 시 'approved', 실패 시
 *   'pending'(SOC-0 — 인용수 상위 무관 문헌이 자동 게시되던 문제).
 *
 * 게시 정책(원칙 8): 서지 메타데이터(제목·저자·연도·저널·DOI)는 기계 검증(DOI 존재 +
 *   OpenAlex/Crossref 신뢰 소스 메타데이터)만으로 자동 게시(approved)한다.
 *   반면 AI가 생성하는 요약/평가(M3~)는 pending으로 저장해 사용자 승인 후 게시한다.
 *   → status 컬럼은 그대로 유지: M3 요약 파이프가 pending/approved 게이트로 재사용한다.
 *
 * DOI가 신뢰 근거인 이유: DOI는 Crossref/DataCite에 등록된 영구 식별자로, 해당 서지
 *   메타데이터가 출판사·색인기관에 의해 검증되었음을 뜻한다. 사람이 임의 생성할 수 없다.
 *
 * 멱등성: sourceUrl(doi.org 링크) 기준 findOne. 있으면 갱신, 없으면 삽입.
 * 스키마 변경 없음(status 컬럼은 마이그레이션 선행). synchronize 사용 안 함.
 * ⚠️ 조직 egress 정책이 api.openalex.org를 막는 샌드박스에서는 0건 수집된다.
 *    실제 수집은 인터넷이 열린 운영 환경(Render Shell)에서 수행한다.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Research } from '../entities/research.entity';
import { DomainCode, RegionCode } from '../../common/enums';
import { collectedStatus, relevanceColumns } from '../relevance';
import { loadFieldProfile } from '../../common/field-profile';

// 출처·검색어·한도는 분야 설정 파일(sources.academic, SOC-R1 ■5)에서 읽는다.
const ACADEMIC = loadFieldProfile().sources.academic.find(
  (s) => s.id === 'acad-openalex',
);
if (!ACADEMIC)
  throw new Error('분야 설정 파일에 sources.academic acad-openalex 없음');
const OPENALEX = ACADEMIC.url;
const UA = ACADEMIC.user_agent;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// polite pool 용 mailto(운영에서 OPENALEX_MAILTO로 오버라이드 가능)
const MAILTO = process.env.OPENALEX_MAILTO?.trim() || ACADEMIC.mailto;
const PER_QUERY = Number(
  process.env.COLLECT_RESEARCH_PER_QUERY || ACADEMIC.per_query,
);
const MAX_TOTAL = Number(
  process.env.COLLECT_RESEARCH_MAX || ACADEMIC.max_items,
);

interface DomainQueries {
  domain: DomainCode;
  queries: string[];
}

// 도메인별 질의어 — 설정 파일 sources.academic[].queries 그대로.
const QUERY_PLAN: DomainQueries[] = ACADEMIC.queries.map((q) => ({
  domain: q.domain as DomainCode,
  queries: q.terms,
}));

interface OAWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  cited_by_count?: number | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string } | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

/** OpenAlex abstract_inverted_index → 평문 초록 복원 */
function reconstructAbstract(
  idx?: Record<string, number[]> | null,
): string | undefined {
  if (!idx) return undefined;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const p of positions) slots[p] = word;
  }
  const text = slots
    .filter((w) => w != null)
    .join(' ')
    .trim();
  return text ? text.slice(0, 4000) : undefined;
}

interface Collected {
  doiUrl: string;
  payload: Partial<Research>;
}

async function fetchQuery(
  domain: DomainCode,
  query: string,
): Promise<Collected[]> {
  const url =
    `${OPENALEX}?search=${encodeURIComponent(query)}` +
    `&filter=has_doi:true` +
    `&sort=cited_by_count:desc` +
    `&per-page=${PER_QUERY}` +
    `&mailto=${encodeURIComponent(MAILTO)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { results?: OAWork[] };
  const works = Array.isArray(json.results) ? json.results : [];
  const out: Collected[] = [];
  for (const w of works) {
    const doi = w.doi?.trim();
    if (!doi) continue; // DOI 없으면 제외
    const doiUrl = doi.startsWith('http')
      ? doi
      : `https://doi.org/${doi.replace(/^doi:/i, '')}`;
    const title = (w.title || w.display_name || '').trim();
    if (!title) continue;
    const authors = (w.authorships ?? [])
      .map((a) => a.author?.display_name?.trim())
      .filter((n): n is string => !!n)
      .slice(0, 12);
    const journal = w.primary_location?.source?.display_name?.trim();
    const abstract = reconstructAbstract(w.abstract_inverted_index);
    out.push({
      doiUrl,
      payload: {
        title: title.slice(0, 500),
        authors: authors.length ? authors : undefined,
        year: w.publication_year ?? undefined,
        abstract,
        keywords: [query],
        domains: [domain],
        sourceUrl: doiUrl.slice(0, 500),
        source: (journal || 'OpenAlex').slice(0, 200),
        region: RegionCode.OTHER,
        // DOI 기계 검증 + 관련성 관문 통과분만 자동 게시. 실패분은 pending(검토 대기).
        status: collectedStatus({ title, abstract, keywords: [query] }),
      },
    });
  }
  return out;
}

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const repo = ds.getRepository(Research);

  const before = await repo.count();
  const seen = new Set<string>(); // 실행 내 DOI 중복 제거
  const collected: Collected[] = [];

  for (const { domain, queries } of QUERY_PLAN) {
    for (const q of queries) {
      if (collected.length >= MAX_TOTAL) break;
      try {
        const rows = await fetchQuery(domain, q);
        let added = 0;
        for (const r of rows) {
          if (collected.length >= MAX_TOTAL) break;
          if (seen.has(r.doiUrl)) continue;
          seen.add(r.doiUrl);
          collected.push(r);
          added++;
        }
        console.log(
          `[collect] ${domain} "${q}" → ${rows.length}건 수신 / 신규 ${added}`,
        );
      } catch (e: any) {
        console.warn(`[collect] ${domain} "${q}" 실패: ${e?.message || e}`);
      }
      await sleep(1200); // OpenAlex 예의상 간격
    }
  }

  let inserted = 0;
  let updated = 0;
  for (const c of collected) {
    const existing = await repo.findOne({ where: { sourceUrl: c.doiUrl } });
    if (existing) {
      // 기존 항목의 status는 건드리지 않는다(사람이 내린 검수 결정 보존).
      const rest = { ...c.payload };
      delete rest.status;
      await repo.update(existing.id, rest);
      updated++;
    } else {
      // 신규분만 관문 판정 기록을 남긴다(SOC-R1). 기존 행은 backfill:relevance 가 한 번 채운다.
      await repo.save(
        repo.create({ ...c.payload, ...relevanceColumns(c.payload) }),
      );
      inserted++;
    }
  }

  const after = await repo.count();
  console.log(
    `\n[collect] 수집 ${collected.length}건(DOI 보유) · upsert 신규 ${inserted} / 갱신 ${updated}`,
  );
  console.log(
    `[collect] research 총량 ${before} → ${after}건 (신규분: 관문 통과=approved · 실패=pending)`,
  );
  console.log(
    '[collect] pending = 관련성 관문 실패분. 일괄 승인 금지 — 건별 검토 후 승인한다(SOC-0).',
  );

  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect] 실패:', e);
  process.exit(1);
});
