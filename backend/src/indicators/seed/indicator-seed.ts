import type { Repository } from 'typeorm';
import { SeedInsertOnly } from '../../common/seed-insert-only';
import { Indicator } from '../entities/indicator.entity';
import { Observation } from '../entities/observation.entity';

/**
 * 지표 데이터 파일 → indicators/observations 넣기만 (SOC-R2 ■3 · SOC-R3 ■3).
 *
 * 규칙:
 *  - 지표: code 기준. 없으면 넣고, 있으면 쓰지 않는다. 정의 없으면 넣지 않음(원칙4).
 *  - 관측치: (지표·소스·지역·기간·qualifier) 기준. 없으면 넣고, 있으면 쓰지 않는다 —
 *    값·status·fetched_at 그대로(예: 2022 행 변경 0). 값이 다르면 seed_diff 로그만.
 *  - 원본 URL 없는 관측치는 거절. 공식 도메인(정부·공공기관)이 아니어도 거절(원칙3).
 *  - 쪽 번호(page)가 있으면 PDF 주소에 #page=N 을 붙이고 note 에도 적는다.
 *  - 한 파일 안에서 같은 키가 두 번 나오면 두 번째는 거절(같은 값 중복 0).
 */
export interface ObsRow {
  geo: string;
  period: string;
  value: string;
  qualifier?: string | null;
  valueLow?: string | null;
  valueHigh?: string | null;
  sourceUrl?: string;
  /** PDF 쪽 번호(인쇄 쪽). 있으면 note·URL 에 남긴다. */
  page?: string | number;
  /** 표·그림 번호 */
  table?: string;
  /** 조사대상(모집단) 등 관측치 단서 */
  note?: string;
}

export interface IndicatorRow {
  code: string;
  domain: string;
  nameKo: string;
  nameEn: string | null;
  unit: string | null;
  definitionKo: string;
  methodNote: string | null;
  sourceId?: string | null;
  /** 조사 설계 변경 해(SOC-R6 ■2 · break-years.ts 와 같아야 함) */
  breakYears?: number[];
  /** 이 지표 관측치의 기본 원본 URL(관측치에 sourceUrl 이 없을 때) */
  sourceUrl?: string;
  /** 이 지표 관측치에 공통으로 붙는 단서 */
  observationNote?: string;
  observations: ObsRow[];
}

export interface IndicatorDataFile {
  sourceId: string;
  sourceUrl?: string;
  indicators: IndicatorRow[];
}

/**
 * 정부·공공기관 도메인만 원본으로 받는다.
 * SOC-R5 ■3: 국제기구 원 발행처(who.int · unodc.org · euda.europa.eu) 추가 ·
 * 공공기관 조사 수행처 nia.or.kr(스마트폰 과의존 실태조사) · kocca.kr(게임이용자 실태조사) 추가.
 */
const OFFICIAL_HOSTS = [
  'kcgp.or.kr',
  'nia.or.kr',
  'kocca.kr',
  'kosis.kr',
  'data.go.kr',
  'korea.kr',
  'who.int',
  'unodc.org',
  'euda.europa.eu',
];

export function isOfficialUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  const host = u.hostname.toLowerCase();
  return (
    host.endsWith('.go.kr') ||
    OFFICIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  );
}

export type ResolvedObs =
  | { ok: true; key: string; row: Partial<Observation> }
  | { ok: false; key: string; reason: string };

export function resolveObservation(
  file: IndicatorDataFile,
  ind: IndicatorRow,
  o: ObsRow,
): ResolvedObs {
  const qualifier = o.qualifier ?? 'total';
  const key = `${ind.code} ${o.geo} ${o.period} ${qualifier}`;
  const base = o.sourceUrl ?? ind.sourceUrl ?? file.sourceUrl;
  if (!base) return { ok: false, key, reason: '원본 URL 없음' };
  if (!isOfficialUrl(base)) {
    return { ok: false, key, reason: `공식 도메인 아님: ${base}` };
  }
  if (!/^-?\d+(\.\d+)?$/.test(String(o.value ?? '').trim())) {
    return { ok: false, key, reason: `값이 수가 아님: ${o.value}` };
  }
  const page = o.page != null && String(o.page).trim() ? String(o.page) : null;
  const sourceUrl =
    page && /\.pdf($|\?)/i.test(base) && !base.includes('#')
      ? `${base}#page=${page}`
      : base;
  const noteParts = [
    o.note ?? ind.observationNote ?? null,
    page ? `p.${page}` : null,
    o.table ?? null,
  ].filter((p): p is string => !!p);
  const note = noteParts.length ? noteParts.join(' · ').slice(0, 300) : null;
  return {
    ok: true,
    key,
    row: {
      sourceId: ind.sourceId ?? file.sourceId ?? null,
      geo: o.geo,
      period: o.period,
      value: String(o.value).trim(),
      valueLow: o.valueLow ?? null,
      valueHigh: o.valueHigh ?? null,
      qualifier,
      sourceUrl: sourceUrl.slice(0, 500),
      note,
    },
  };
}

export interface SeedReport {
  indicators: SeedInsertOnly;
  observations: SeedInsertOnly;
  rejected: { key: string; reason: string }[];
}

export async function seedIndicatorFile(
  file: IndicatorDataFile,
  repos: {
    indicators: Repository<Indicator>;
    observations: Repository<Observation>;
  },
  report: SeedReport,
  now: Date = new Date(),
): Promise<void> {
  const seen = new Set<string>();
  for (const row of file.indicators) {
    // 원칙4: 정의 없는 지표 금지.
    if (!row.definitionKo?.trim()) {
      report.rejected.push({ key: row.code, reason: '정의 없음' });
      continue;
    }
    const { entity: indicator } = await report.indicators.insertOnly(
      repos.indicators,
      { code: row.code },
      {
        code: row.code,
        domain: row.domain,
        nameKo: row.nameKo,
        nameEn: row.nameEn ?? undefined,
        unit: row.unit ?? undefined,
        definitionKo: row.definitionKo,
        methodNote: row.methodNote ?? undefined,
        sourceId: row.sourceId ?? file.sourceId ?? null,
        breakYears: row.breakYears ?? undefined,
      },
      row.code,
    );

    for (const o of row.observations) {
      const r = resolveObservation(file, row, o);
      if (!r.ok) {
        report.rejected.push({ key: r.key, reason: r.reason });
        continue;
      }
      if (seen.has(r.key)) {
        report.rejected.push({ key: r.key, reason: '파일 안 중복' });
        continue;
      }
      seen.add(r.key);
      const { row: obs } = r;
      // 비교는 seed 가 정하는 값만(status·fetched_at·revisions·note 는 DB 의 일).
      await report.observations.insertOnly(
        repos.observations,
        {
          indicatorId: indicator.id,
          sourceId: obs.sourceId ?? undefined,
          geo: obs.geo,
          period: obs.period,
          qualifier: obs.qualifier,
        },
        {
          ...obs,
          indicatorId: indicator.id,
          revisions: null,
          fetchedAt: now,
          // 공식 표·보고서에서 사람이 옮기고 대조한 값 → approved(원칙8). PDF 크론 추출분만 pending.
          status: 'approved',
        },
        r.key,
        ['revisions', 'fetchedAt', 'status', 'note'],
      );
    }
  }
}
