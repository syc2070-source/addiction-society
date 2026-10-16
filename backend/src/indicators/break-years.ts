/**
 * 조사 설계가 바뀐 해 (SOC-R6 ■2) — 지표 메타 indicators.break_years.
 *
 * 값(관측치)은 그대로 두고, 추세선이 그 해 앞에서 끊기고 「조사 설계 변경(연도)」 꼬리가
 * 붙게 하는 표시용 메타다. 근거는 각 지표 methodNote·관측치 note(원 보고서 문장):
 *  - kocca_game_usage_rate 2023: 표본 3,000→10,000 · 면접/온라인 연령 나눔 변경 ·
 *    만 10~64세 — 보고서가 같은 해 −11.5%p.
 *  - kcgp_youth_gambling_* 2020: 중1~고2 → 중1~고3(고3 첫 포함) · 온라인·우편(코로나19) ·
 *    2022: 초4~고3(4차 시범조사) — 모집단이 달라 직접 비교 불가.
 *
 * 데이터 파일(seed json)의 breakYears 와 같아야 한다(시험이 대조). 새 DB 는 seed 가,
 * 이미 있는 지표 행은 migration 이 채운다(seed 는 넣기만이라 기존 행을 쓰지 않음).
 */
export const INDICATOR_BREAK_YEARS: Record<string, number[]> = {
  kocca_game_usage_rate: [2023],
  kcgp_youth_gambling_problem_rate: [2020, 2022],
  kcgp_youth_gambling_atrisk_rate: [2020, 2022],
  kcgp_youth_gambling_problem_group_rate: [2020, 2022],
};
