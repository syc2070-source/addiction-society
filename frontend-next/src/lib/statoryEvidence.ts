/**
 * Statory 서재 카드 묶음 읽기 — 계약 evidence_export_v1 (SOC-R20 ■5 · docs/governance/EVIDENCE_EXPORT_V1.md).
 *
 * 운반 = 파일. 받는 문(eco inbox)은 꺼진 채(이 판).
 *   실물  frontend-next/data/statory/evidence_export_v1.json        (R21 에 들어옴)
 *   견본  frontend-next/data/statory/evidence_export_v1.sample.json (합성 18장 · 실명·실제 제목 0)
 * 분기 하나: 실물이 있으면 실물만 읽는다(견본은 읽지 않음). 실물이 없을 때만, 부른 쪽이 허락하면(미리보기) 견본.
 * 둘 다 없거나 꼴이 틀리면 null → 부른 쪽은 섹션을 통째로 그리지 않는다(빈 칸 0).
 * 현 대문(/)과 공개 API 는 이 모듈을 부르지 않는다(시험이 지킨다).
 *
 * 문장은 카드에 있는 그대로만 — 요약·번역·추정 생성 0 · 모델 호출 0.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EXPORT_VERSION = 'evidence_export_v1';
export const REAL_FILE = 'evidence_export_v1.json';
export const SAMPLE_FILE = 'evidence_export_v1.sample.json';

/** 계약의 유형 글(한국어) → 경로 이름. 「기타」는 유형 타일에 들지 않는다. */
export const CARD_TYPES = {
  알코올: 'alcohol',
  도박: 'gambling',
  마약: 'drug',
  스마트폰: 'smartphone',
  게임: 'game',
  담배: 'tobacco',
  기타: 'other',
} as const;

export type CardTypeKo = keyof typeof CARD_TYPES;
export type CardTypeSlug = (typeof CARD_TYPES)[CardTypeKo];
export type TileType = Exclude<CardTypeSlug, 'other'>;
export const TILE_TYPES: readonly TileType[] = [
  'alcohol',
  'gambling',
  'drug',
  'smartphone',
  'game',
  'tobacco',
];

/** 면허 — quote_only 는 발췌 0(제목·출처만). */
export const LICENSES = [
  'cc_by',
  'cc_by_nc',
  'open_access',
  'quote_only',
  'other',
] as const;
export type License = (typeof LICENSES)[number];

/** 설계 — 화면 이름은 messages statory.design.<code> */
export const DESIGNS = [
  'cross_sectional',
  'cohort',
  'panel',
  'case_control',
  'rct',
  'qualitative',
  'systematic_review',
  'meta_analysis',
  'other',
] as const;
export type Design = (typeof DESIGNS)[number];

export interface EvidenceCard {
  card_id: string;
  type: CardTypeKo;
  title: string;
  authors_short: string;
  year: number;
  /** ISO 3166-1 alpha-2 (KR · US …) */
  country: string;
  sample_n: number | null;
  design: Design;
  instrument: string | null;
  findings_ko: string | null;
  findings_src: string | null;
  implications_ko: string | null;
  source_grade: string | null;
  license: License;
  doi: string | null;
  url: string | null;
  approved_at: string;
}

export interface EvidenceExport {
  version: typeof EXPORT_VERSION;
  exported_at: string;
  field: 'addiction';
  source: 'statory';
  cards: EvidenceCard[];
}

export interface LoadedExport {
  mode: 'real' | 'sample';
  data: EvidenceExport;
  /** 꼴이 틀려 뺀 카드 수(보고용 · 화면에는 쓰지 않음) */
  dropped: number;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

function toCard(v: unknown): EvidenceCard | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const id = str(o.card_id);
  const type = str(o.type);
  const title = str(o.title);
  const approved = str(o.approved_at);
  const year = typeof o.year === 'number' && Number.isInteger(o.year) ? o.year : null;
  if (!id || !type || !(type in CARD_TYPES) || !title || !approved || year === null) {
    return null;
  }
  const license = str(o.license);
  const design = str(o.design);
  return {
    card_id: id,
    type: type as CardTypeKo,
    title,
    authors_short: str(o.authors_short) ?? '',
    year,
    country: (str(o.country) ?? '').toUpperCase(),
    sample_n:
      typeof o.sample_n === 'number' && Number.isFinite(o.sample_n) ? o.sample_n : null,
    design: (DESIGNS as readonly string[]).includes(design ?? '')
      ? (design as Design)
      : 'other',
    instrument: str(o.instrument),
    findings_ko: str(o.findings_ko),
    findings_src: str(o.findings_src),
    implications_ko: str(o.implications_ko),
    source_grade: str(o.source_grade),
    // 모르는 면허는 가장 좁게(인용만) 읽는다
    license: (LICENSES as readonly string[]).includes(license ?? '')
      ? (license as License)
      : 'quote_only',
    doi: str(o.doi),
    url: str(o.url),
    approved_at: approved,
  };
}

/** 묶음 꼴 검사 — 틀리면 null(섹션 0). 카드 하나가 틀리면 그 카드만 뺀다. */
export function parseExport(body: unknown): { data: EvidenceExport; dropped: number } | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if (o.version !== EXPORT_VERSION || !Array.isArray(o.cards)) return null;
  const exportedAt = str(o.exported_at);
  if (!exportedAt) return null;
  const cards = o.cards.map(toCard);
  const ok = cards.filter((c): c is EvidenceCard => c !== null);
  return {
    data: {
      version: EXPORT_VERSION,
      exported_at: exportedAt,
      field: 'addiction',
      source: 'statory',
      cards: ok,
    },
    dropped: cards.length - ok.length,
  };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** 기본 자리 = <프런트 뿌리>/data/statory */
export function statoryDir(): string {
  return join(process.cwd(), 'data', 'statory');
}

/**
 * 실물 → (없을 때만 · allowSample 이면) 견본 → null.
 * 실물 파일이 있는데 꼴이 틀리면 견본으로 넘어가지 않고 null(실물이 들어온 뒤 견본이 섞이지 않게).
 */
export function loadStatoryExport(opts: {
  allowSample: boolean;
  dir?: string;
}): LoadedExport | null {
  const dir = opts.dir ?? statoryDir();
  const real = join(dir, REAL_FILE);
  if (existsSync(real)) {
    const p = parseExport(readJson(real));
    return p ? { mode: 'real', ...p } : null;
  }
  if (!opts.allowSample) return null;
  const sample = join(dir, SAMPLE_FILE);
  if (!existsSync(sample)) return null;
  const p = parseExport(readJson(sample));
  return p ? { mode: 'sample', ...p } : null;
}

export const slugOf = (c: EvidenceCard): CardTypeSlug => CARD_TYPES[c.type];
export const isKorea = (c: EvidenceCard) => c.country === 'KR';
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
export const hasHangul = (s: string | null | undefined) => !!s && HANGUL.test(s);

/** 발췌 허락 여부 — 인용만 허용이면 제목·출처만 */
export const excerptAllowed = (c: EvidenceCard) => c.license !== 'quote_only';

export type Excerpt =
  | { kind: 'text'; text: string; tag: 'source' | null }
  | { kind: 'korean' }
  | { kind: 'none' };

/**
 * 화면에 실을 결과 문장(있는 그대로).
 *  ko: findings_ko → 없으면 findings_src + 「(원문)」 꼬리표.
 *  en: findings_src 가 영어면 그대로 · 한글이면 글 없이 「(Korean)」 꼬리표만(en 화면 한글 0 관문).
 *  quote_only: 발췌 0.
 */
export function excerptOf(c: EvidenceCard, locale: string): Excerpt {
  if (!excerptAllowed(c)) return { kind: 'none' };
  if (locale === 'ko') {
    if (c.findings_ko) return { kind: 'text', text: c.findings_ko, tag: null };
    if (c.findings_src) return { kind: 'text', text: c.findings_src, tag: 'source' };
    return { kind: 'none' };
  }
  if (c.findings_src && !hasHangul(c.findings_src)) {
    return { kind: 'text', text: c.findings_src, tag: null };
  }
  if (c.findings_src || c.findings_ko) return { kind: 'korean' };
  return { kind: 'none' };
}

/** en 화면에 실을 수 있는 글(한글이 있으면 null → 부른 쪽이 「(Korean)」 꼬리표) */
export const enSafe = (s: string | null | undefined): string | null =>
  s && !hasHangul(s) ? s : null;

export interface TypeTile {
  type: TileType;
  n: number;
  korea: number;
  yearFrom: number;
  yearTo: number;
  /** 대표 카드 — 규칙: findings_ko 있음 · 발췌 허락 → 한국 우선 → approved_at 최신 → card_id */
  lead: EvidenceCard | null;
}

const byLead = (a: EvidenceCard, b: EvidenceCard) =>
  Number(isKorea(b)) - Number(isKorea(a)) ||
  b.approved_at.localeCompare(a.approved_at) ||
  a.card_id.localeCompare(b.card_id);

export function leadCard(cards: EvidenceCard[]): EvidenceCard | null {
  const pool = cards.filter((c) => c.findings_ko && excerptAllowed(c));
  return pool.length ? [...pool].sort(byLead)[0] : null;
}

/** 유형 타일(카드가 한 장 이상인 유형만 · TILE_TYPES 순서) */
export function typeTiles(data: EvidenceExport): TypeTile[] {
  const out: TypeTile[] = [];
  for (const type of TILE_TYPES) {
    const cards = data.cards.filter((c) => slugOf(c) === type);
    if (cards.length === 0) continue;
    const years = cards.map((c) => c.year);
    out.push({
      type,
      n: cards.length,
      korea: cards.filter(isKorea).length,
      yearFrom: Math.min(...years),
      yearTo: Math.max(...years),
      lead: leadCard(cards),
    });
  }
  return out;
}

/** 유형 쪽 카드 목록 — 연도 내림 → approved_at 내림 → card_id */
export function cardsOfType(data: EvidenceExport, type: TileType): EvidenceCard[] {
  return data.cards
    .filter((c) => slugOf(c) === type)
    .sort(
      (a, b) =>
        b.year - a.year ||
        b.approved_at.localeCompare(a.approved_at) ||
        a.card_id.localeCompare(b.card_id),
    );
}

export const doiHref = (doi: string) =>
  /^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi.replace(/^doi:\s*/i, '')}`;
