/**
 * 근거 지도 (SOC-R2 ■2) — Statory 서재가 만든 묶음 JSON 을 그대로 읽는다.
 *
 * 파일: public/data/evidence_map/<topic>.json (+ index.json 의 topics 목록).
 * 묶음은 빌드에 함께 들어간다(서버 함수가 public/ 를 런타임에 읽지 않게 import).
 * 화면은 묶음의 수를 그대로 보인다 — 추정·보간·나누기 0. 비율도 「있음/전체」 두 수로.
 *
 * 묶음 꼴은 report_bundle.v0(values.studies · by_year · journal_countries_top …).
 * 지시서가 적은 이름(total · counts_by_year · countries · instruments · oa_ratio · gaps)
 * 으로 와도 같은 칸에 담는다.
 */
import index from '../../public/data/evidence_map/index.json';

export type Pair = [string, number];

export interface EvidencePaper {
  title: string;
  doi: string | null;
  year: number | null;
  journal: string | null;
  cited: number | null;
  kind?: string | null;
}

export interface EvidenceLevels {
  fulltext: number;
  abstract: number;
  indirect: number;
  bib_only: number;
}

export interface EvidenceMap {
  topic: string;
  title: string;
  titleEn: string | null;
  generatedAt: string | null;
  source: string | null;
  studies: number;
  byYear: Array<{ year: string; count: number }>;
  trend: {
    lastFive: number;
    fiveBefore: number;
    latestYear: number | null;
  } | null;
  countries: Pair[];
  designs: Pair[];
  instruments: Pair[];
  corePapers: EvidencePaper[];
  coreBasis: string | null;
  reviews: EvidencePaper[];
  levels: EvidenceLevels | null;
  openAccess: number | null;
  fullTextHeld: number | null;
  gaps: string[];
  honesty: string[];
}

const TOPIC_RE = /^[a-z0-9-]+$/;

/** index.json 의 주제 목록(이름 검사 통과분만). */
export function evidenceTopics(): string[] {
  const topics = (index as { topics?: unknown }).topics;
  if (!Array.isArray(topics)) return [];
  return topics.filter(
    (t): t is string => typeof t === 'string' && TOPIC_RE.test(t),
  );
}

type Raw = Record<string, unknown>;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function pairs(v: unknown): Pair[] {
  if (Array.isArray(v)) {
    return v
      .filter(
        (p): p is [string, number] =>
          Array.isArray(p) && typeof p[0] === 'string' && num(p[1]) !== null,
      )
      .map(([k, n]) => [k, n]);
  }
  if (v && typeof v === 'object') {
    // { 이름: 수 } 꼴은 수 내림차순(묶음 순서 그대로가 아니면 이것이 유일한 정렬).
    return Object.entries(v as Raw)
      .filter(([, n]) => num(n) !== null)
      .map(([k, n]) => [k, n as number] as Pair)
      .sort((a, b) => b[1] - a[1]);
  }
  return [];
}

function papers(v: unknown): EvidencePaper[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Raw => !!p && typeof p === 'object')
    .filter((p) => typeof p.title === 'string' && p.title.trim() !== '')
    .map((p) => ({
      title: String(p.title),
      doi: typeof p.doi === 'string' && p.doi ? p.doi : null,
      year: num(p.year),
      journal: typeof p.journal === 'string' ? p.journal : null,
      cited: num(p.cited),
      kind: typeof p.kind === 'string' ? p.kind : null,
    }));
}

/** 묶음 JSON → 화면 칸. 없는 값은 비운다(지어내지 않는다). */
export function normalizeEvidenceMap(raw: Raw, topic: string): EvidenceMap {
  const v = (raw.values && typeof raw.values === 'object'
    ? raw.values
    : raw) as Raw;
  const yearsRaw = (v.by_year ?? v.counts_by_year ?? {}) as Raw;
  const byYear = Object.entries(yearsRaw)
    .filter(([y, n]) => /^\d{4}$/.test(y) && num(n) !== null)
    .map(([year, n]) => ({ year, count: n as number }))
    .sort((a, b) => a.year.localeCompare(b.year));
  const tr = v.trend as Raw | undefined;
  const lastFive = num(tr?.last_five_years);
  const fiveBefore = num(tr?.five_years_before);
  const lv = v.evidence_levels as Raw | undefined;
  const levels =
    lv && typeof lv === 'object'
      ? {
          fulltext: num(lv.fulltext) ?? 0,
          abstract: num(lv.abstract) ?? 0,
          indirect: num(lv.indirect) ?? 0,
          bib_only: num(lv.bib_only) ?? 0,
        }
      : null;
  const gapsRaw = v.gaps ?? raw.gaps;
  return {
    topic: typeof raw.topic === 'string' ? raw.topic : topic,
    title: typeof raw.title === 'string' ? raw.title : topic,
    titleEn: typeof raw.title_en === 'string' ? raw.title_en : null,
    generatedAt: typeof raw.generated_at === 'string' ? raw.generated_at : null,
    source: typeof raw.source === 'string' ? raw.source : null,
    studies: num(v.studies) ?? num(v.total) ?? 0,
    byYear,
    trend:
      lastFive !== null && fiveBefore !== null
        ? { lastFive, fiveBefore, latestYear: num(tr?.latest_year) }
        : null,
    countries: pairs(v.journal_countries_top ?? v.countries),
    designs: pairs(v.designs),
    instruments: pairs(v.instruments_top ?? v.instruments),
    corePapers: papers(v.core_papers),
    coreBasis: typeof v.core_basis === 'string' ? v.core_basis : null,
    reviews: papers(v.reviews),
    levels,
    openAccess: num(v.open_access),
    fullTextHeld: num(v.full_text_held),
    gaps: Array.isArray(gapsRaw)
      ? gapsRaw.filter((g): g is string => typeof g === 'string')
      : [],
    honesty: Array.isArray(raw.honesty)
      ? raw.honesty.filter((h): h is string => typeof h === 'string')
      : [],
  };
}

/** 주제 하나. 목록에 없거나 파일이 없으면 null(화면은 「준비 중」). */
export async function loadEvidenceMap(
  topic: string,
): Promise<EvidenceMap | null> {
  if (!evidenceTopics().includes(topic)) return null;
  try {
    const mod = (await import(
      `../../public/data/evidence_map/${topic}.json`
    )) as { default: Raw };
    return normalizeEvidenceMap(mod.default, topic);
  } catch {
    return null;
  }
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}

/** 표시 제목(en 이면 title_en 우선). */
export function evidenceTitle(m: EvidenceMap, locale: string): string {
  return locale === 'en' && m.titleEn ? m.titleEn : m.title;
}
