/**
 * 한글 → 로마자 (국어의 로마자 표기법, 2000) · 회복 기관 이름·주소용 (SOC-R9 ■1).
 *
 * 회복 기관 73곳(recovery_resources)의 이름·주소는 한국어뿐이다. en 화면에서만 여기서
 * 옮겨 보인다(DB 값 변경 0 · 호출 0). 규칙:
 *  - 음절 사이 소리 바뀜은 주요한 것만: 연음 · 비음화(ㄱㄷㅂ+ㄴㅁ) · ㄹ 비음화 · 유음화(ㄴㄹ/ㄹㄴ → ll).
 *  - 행정 단위(시·군·구·읍·면·동·리·로·길 …) 앞은 붙임표, 붙임표 너머 소리 바뀜은 적지 않음(표기법 제2항).
 *  - 층·호·지하·빌딩 같은 흔한 낱말은 영어로.
 * 고유 이름의 공식 영문 표기와 다를 수 있다(예: 기관이 따로 쓰는 영문 이름) — 화면은 「Romanized」.
 *
 * 의존 없음(시험: node --test src/lib/enLabels.test.mts).
 */

const INITIAL = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's',
  'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];
const MEDIAL = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae',
  'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
];
/** 받침(끝소리 대표음) */
const FINAL = [
  '', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l',
  'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't',
];
/** 모음 앞(초성 ㅇ)으로 넘어갈 때의 받침 소리 */
const FINAL_LINK = [
  '', 'g', 'kk', 'gs', 'n', 'nj', 'n', 'd', 'r', 'lg', 'lm', 'lb', 'ls', 'lt',
  'lp', 'r', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', '',
];

const HANGUL_SYLLABLE = /[가-힣]/;
const I_SILENT = 11;
const I_N = 2;
const I_R = 5;
const I_M = 6;

interface Jamo {
  i: number;
  m: number;
  f: number;
}

function split(ch: string): Jamo {
  const c = ch.charCodeAt(0) - 0xac00;
  return { i: Math.floor(c / 588), m: Math.floor((c % 588) / 28), f: c % 28 };
}

/** 한 덩이(한글만) → 로마자. 음절 사이 소리 바뀜 반영. */
export function romanizeWord(word: string): string {
  const syl = [...word].map(split);
  let out = '';
  for (let k = 0; k < syl.length; k++) {
    const cur = syl[k];
    const next = syl[k + 1];
    let ini = INITIAL[cur.i];
    if (k > 0) {
      const prev = syl[k - 1];
      const pf = FINAL[prev.f];
      if (cur.i === I_SILENT && prev.f !== 0) ini = ''; // 연음은 앞 받침에서 처리
      else if (cur.i === I_R) ini = pf === 'l' || pf === 'n' ? 'l' : pf ? 'n' : 'r';
      else if (cur.i === I_N && pf === 'l') ini = 'l';
    }
    let fin = FINAL[cur.f];
    if (next && cur.f !== 0) {
      if (next.i === I_SILENT) fin = FINAL_LINK[cur.f];
      else if (next.i === I_N || next.i === I_M || next.i === I_R) {
        if (fin === 'k') fin = 'ng';
        else if (fin === 't') fin = 'n';
        else if (fin === 'p') fin = 'm';
        else if (fin === 'n' && next.i === I_R) fin = 'l';
      }
    }
    out += ini + MEDIAL[cur.m] + fin;
  }
  return out;
}

/** 행정·도로 단위 — 긴 것부터. 앞에 붙임표. */
const UNIT_SUFFIX: [string, string][] = [
  ['특별자치도', '-do'],
  ['특별자치시', '-si'],
  ['특별시', ''], // 서울특별시 → Seoul
  ['광역시', ''], // 부산광역시 → Busan
  ['대로', '-daero'],
  ['번안길', 'beonan-gil'],
  ['번길', 'beon-gil'],
  ['로', '-ro'],
  ['길', '-gil'],
  ['도', '-do'],
  ['시', '-si'],
  ['군', '-gun'],
  ['구', '-gu'],
  ['읍', '-eup'],
  ['면', '-myeon'],
  ['동', '-dong'],
  ['리', '-ri'],
  ['가', '-ga'],
];

/** 주소·이름에 흔한 낱말 → 영어(덩이 끝에 붙어 있어도 떼어 옮김) — 긴 것부터 */
const WORD_EN: [string, string][] = [
  ['한국지능정보사회진흥원', 'National Information Society Agency'],
  ['건강생활지원센터', 'Health Support Center'],
  ['여성비전센터', 'Women Vision Center'],
  ['일자리재단', 'Job Foundation'],
  ['광역시청', 'Metropolitan City Hall'],
  ['보건복지센터', 'Health and Welfare Center'],
  ['사회복지센터', 'Social Welfare Center'],
  ['건강문화센터', 'Health Culture Center'],
  ['대학교병원', 'University Hospital'],
  ['수도사업소', 'Waterworks Office'],
  ['보건지소', 'Public Health Branch'],
  ['보건소', 'Public Health Center'],
  ['소방서', 'Fire Station'],
  ['시청', 'City Hall'],
  ['의회청사', 'Council Building'],
  ['도청사', 'Provincial Government Building'],
  ['청사관리동', 'Facilities Building'],
  ['청사', 'Government Building'],
  ['연구동', 'Research Building'],
  ['빌딩', 'Building'],
  ['타운', 'Town'],
  ['센터', 'Center'],
  ['재단', 'Foundation'],
  ['별관', 'Annex'],
  ['병원', 'Hospital'],
];

/** 「구」 가 붙는 옛 이름(구중부소방서 = 옛 중부소방서)은 낱말 사전으로 */
function englishWord(stem: string): string | null {
  for (const [ko, en] of WORD_EN) {
    if (stem === ko) return en;
    if (stem.endsWith(ko) && stem.length > ko.length) {
      const head = stem.slice(0, -ko.length);
      return `${headWord(head)} ${en}`;
    }
  }
  return null;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function headWord(head: string): string {
  return hangulRun(head);
}

/** 숫자 뒤에 오는 단위 */
function afterNumber(unit: string): string | null {
  if (unit === '층') return 'F';
  if (unit === '호') return '';
  if (unit === '번길') return 'beon-gil';
  if (unit === '번안길') return 'beonan-gil';
  if (unit === '길') return '-gil';
  if (unit === '가') return '-ga';
  if (unit === '동') return '-dong';
  return null;
}

/** 한글 덩이 하나(숫자 없음) → 영어/로마자 */
function hangulRun(run: string): string {
  if (run === '지하') return 'B';
  if (run === '내') return '(inside)';
  // 「제주대학교병원내」·「월성문화관내」 — 끝 「내」 = 안
  if (run.length > 2 && run.endsWith('내')) {
    return `${hangulRun(run.slice(0, -1))} (inside)`;
  }
  const en = englishWord(run);
  if (en) return en;
  if (run.length >= 2) {
    for (const [ko, ro] of UNIT_SUFFIX) {
      if (run.endsWith(ko) && run.length > ko.length) {
        return cap(romanizeWord(run.slice(0, -ko.length))) + ro;
      }
    }
  }
  return cap(romanizeWord(run));
}

/** 주소·이름 한 줄 → 로마자(한글 0) */
export function romanizeAddress(text: string): string {
  // 덩이: 한글 연속 / 숫자(-숫자) 연속 / 그 밖
  const parts = text.match(/[가-힣]+|\d+(?:-\d+)*|[^가-힣\d]+/g) ?? [];
  let out = '';
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (/^\d/.test(p)) {
      if (/[A-Za-z]$/.test(out)) out += ' '; // 「중리서로42」 → Jungniseo-ro 42
      const next = parts[k + 1];
      if (next && HANGUL_SYLLABLE.test(next[0])) {
        // 「4층」·「401호」·「19길」·「308번길」·「1가」·「102동」 — 숫자 뒤 단위
        const unitMatch = UNIT_AFTER_NUMBER.find((u) => next.startsWith(u));
        if (unitMatch) {
          const label = afterNumber(unitMatch)!;
          out += unitMatch === '호' ? `#${p}` : p + label;
          const rest = next.slice(unitMatch.length);
          if (rest) out += ' ' + hangulRun(rest);
          k++;
          continue;
        }
      }
      out += p;
      continue;
    }
    if (HANGUL_SYLLABLE.test(p[0])) {
      const prev = parts[k - 1];
      // 「지하1층」 → B1F
      if (p === '지하' && parts[k + 1] && /^\d/.test(parts[k + 1])) {
        out += 'B';
        continue;
      }
      out += (prev && /[\dA-Za-z]$/.test(prev) ? ' ' : '') + hangulRun(p);
      continue;
    }
    out += p;
  }
  return out
    .replace(/\bB (\d+F)/g, 'B$1') // 지하1층 → B1F
    .replace(/([A-Za-z0-9])\(/g, '$1 (')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

const UNIT_AFTER_NUMBER = ['번안길', '번길', '층', '호', '길', '가', '동'];
