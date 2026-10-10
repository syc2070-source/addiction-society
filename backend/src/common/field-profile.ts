import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * 분야 설정 파일 읽기 (SOC-R1 ■5).
 *
 * backend/data/field_profiles/<FIELD_PROFILE>.json (기본 addiction). 중독뉴스와 같은
 * 열쇠 이름을 쓰고, 이 사이트가 쓰는 항목만 채운다. 관련성 관문과 수집 검색어는
 * 이 파일만 읽는다 — 코드에 분야 글자를 두지 않는다.
 */
export interface AcademicQueryGroup {
  domain: string;
  terms: string[];
}

export interface AcademicSource {
  id: string;
  grade: string;
  source_name: string;
  url: string;
  user_agent: string;
  mailto: string;
  per_query: number;
  max_items: number;
  queries: AcademicQueryGroup[];
}

export interface FieldProfile {
  field: string;
  site_name: string;
  keywords: {
    strong: {
      ko: string[];
      en_patterns: string[];
      en_patterns_case_sensitive?: string[];
    };
  };
  gate: {
    research: {
      title_min: number;
      keywords_min: number;
      abstract_min: number;
      exclude_collector_keywords: boolean;
    };
  };
  sources: { academic: AcademicSource[] };
}

const NAME_RE = /^[a-z0-9_-]+$/i;

/** 빌드 산출물(dist)·ts-node(src)·작업 디렉터리 어디서 돌아도 같은 파일을 찾는다. */
function candidateDirs(): string[] {
  const dirs = [
    process.env.FIELD_PROFILE_DIR?.trim(),
    join(process.cwd(), 'data', 'field_profiles'),
    resolve(__dirname, '..', '..', 'data', 'field_profiles'),
    resolve(__dirname, '..', '..', '..', 'data', 'field_profiles'),
  ];
  return dirs.filter((d): d is string => !!d);
}

const cache = new Map<string, FieldProfile>();

export function fieldProfileName(): string {
  return process.env.FIELD_PROFILE?.trim() || 'addiction';
}

export function loadFieldProfile(name = fieldProfileName()): FieldProfile {
  const hit = cache.get(name);
  if (hit) return hit;
  if (!NAME_RE.test(name)) {
    throw new Error(`FIELD_PROFILE 이름이 올바르지 않음: ${name}`);
  }
  const file = candidateDirs()
    .map((d) => join(d, `${name}.json`))
    .find((f) => existsSync(f));
  if (!file) {
    throw new Error(
      `분야 설정 파일 없음: ${name}.json (찾은 곳: ${candidateDirs().join(', ')})`,
    );
  }
  const profile = JSON.parse(readFileSync(file, 'utf8')) as FieldProfile;
  const strong = profile.keywords?.strong;
  const gate = profile.gate?.research;
  if (!strong?.ko || !strong?.en_patterns || !gate) {
    throw new Error(`분야 설정 파일 열쇠 부족: ${file}`);
  }
  cache.set(name, profile);
  return profile;
}

/** 수집기가 keywords 에 넣는 자기 검색어 전부(키워드 판정 제외용). */
export function academicQueryTerms(profile: FieldProfile): string[] {
  return (profile.sources?.academic ?? []).flatMap((s) =>
    (s.queries ?? []).flatMap((q) => q.terms),
  );
}
