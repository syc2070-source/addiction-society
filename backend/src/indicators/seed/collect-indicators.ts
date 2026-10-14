/**
 * 지표 수집 — 큐레이션 데이터 파일을 넣기만 (AS-M3-1 → SOC-R2 ■3 → SOC-R3 ■3).
 *
 * 실행: npm run collect:indicators  (매일 04:00 예약의 한 단계)
 *
 * 데이터 파일(공식 원본에서 사람이 옮기고 대조한 값 · 지어내기·추정 0):
 *  - kcgp-youth.data.json — 청소년 도박문제 실태조사(한국도박문제예방치유원).
 *    공공데이터포털 kcgp_youth(15142248)는 '파일데이터'(결과보고서·원자료)라 무키 JSON
 *    API 가 없다(M3-0 실사). 회차별 값은 공식 결과보고서의 쪽 번호와 함께 싣는다.
 *  - knhanes.data.json — 국민건강영양조사(질병관리청) 성인 고위험음주율·현재흡연율.
 *  - drug-offenders.data.json — 대검찰청 「마약류 범죄백서」 보도자료의 연도별 마약류 사범
 *    단속 인원 총계(SOC-R4 · 원본이 적은 총계만 · 더하기 0).
 *  - who-alcohol.data.json — WHO GHO 대한민국 1인당 알코올 소비량(SDG 3.5.2 · 값+링크만 · SOC-R5).
 *  - nia-smartphone.data.json — 스마트폰 과의존 위험군 비율 2016~2025(과기정통부·NIA · SOC-R5).
 *  - kocca-game.data.json — 게임 이용률 2016~2025(한국콘텐츠진흥원 · 10~64·65세 · SOC-R5).
 *  - unodc-wdr.data.json — 세계 약물 사용자 수 2017~2024(UNODC World Drug Report 각 판 머리값 · SOC-R5).
 *
 * 넣기만(SOC-R2 ■3): 지표는 code, 관측치는 (지표·소스·지역·기간·qualifier) 기준.
 * 있으면 쓰지 않는다 — 값·status·fetched_at 모두 그대로. 값이 다르면 seed_diff 로그만.
 * 원본 URL 없는·공식 도메인 아닌 관측치는 거절(indicator-seed.ts). 재실행해도 중복 0.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Indicator } from '../entities/indicator.entity';
import { Observation } from '../entities/observation.entity';
import kcgp from './kcgp-youth.data.json';
import knhanes from './knhanes.data.json';
import drugOffenders from './drug-offenders.data.json';
import whoAlcohol from './who-alcohol.data.json';
import niaSmartphone from './nia-smartphone.data.json';
import koccaGame from './kocca-game.data.json';
import unodcWdr from './unodc-wdr.data.json';
import { SeedInsertOnly } from '../../common/seed-insert-only';
import { printJobCounts } from '../../common/job-counts';
import {
  IndicatorDataFile,
  SeedReport,
  seedIndicatorFile,
} from './indicator-seed';

export const DATA_FILES = [
  kcgp,
  knhanes,
  drugOffenders,
  whoAlcohol,
  niaSmartphone,
  koccaGame,
  unodcWdr,
] as unknown as IndicatorDataFile[];

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const repos = {
    indicators: ds.getRepository(Indicator),
    observations: ds.getRepository(Observation),
  };

  const report: SeedReport = {
    indicators: new SeedInsertOnly('indicators'),
    observations: new SeedInsertOnly('observations'),
    rejected: [],
  };
  const now = new Date();
  for (const file of DATA_FILES) {
    await seedIndicatorFile(file, repos, report, now);
  }

  const { indicators: indSeed, observations: obsSeed, rejected } = report;
  const indTotal = await repos.indicators.count();
  const obsTotal = await repos.observations.count();
  console.log(
    `[collect:indicators] indicators: 신규 ${indSeed.inserted} / 기존 건너뜀 ${indSeed.skipped} (총 ${indTotal})`,
  );
  console.log(
    `[collect:indicators] observations: 신규 ${obsSeed.inserted} / 기존 건너뜀 ${obsSeed.skipped} / 거절 ${rejected.length} (총 ${obsTotal})`,
  );
  for (const r of rejected) {
    console.warn(`[collect:indicators] 거절 ${r.key}: ${r.reason}`);
  }
  indSeed.print();
  obsSeed.print();
  printJobCounts({
    inserted: indSeed.inserted + obsSeed.inserted,
    skipped: indSeed.skipped + obsSeed.skipped + rejected.length,
    diff: indSeed.diffs.length + obsSeed.diffs.length,
  });

  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:indicators] 실패:', e);
  process.exit(1);
});
