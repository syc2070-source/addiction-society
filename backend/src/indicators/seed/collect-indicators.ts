/**
 * 지표 수집 — 청소년 도박문제(kcgp_youth) 첫 수집 (AS-M3-1, 멱등 upsert + revisions).
 *
 * 실행: npm run collect:indicators
 *
 * 소스 선택 근거: 공공데이터포털 kcgp_youth(15142248)는 '파일데이터'(결과보고서·원자료)라
 *  **무키 JSON API가 없다**(오픈API는 서비스키 필요). M3-0 실사로 확인. 따라서 실태조사가
 *  공표한 검증된 집계치를 정의(definition_ko)와 함께 등록한다(정의 없는 지표 금지·원칙4).
 *  값의 근거는 원자료 딥링크(source_url·원칙3). 서비스키 기반 오픈API 자동갱신은 후속(§보고).
 *
 * 멱등성:
 *  - indicators: code 기준 upsert(있으면 메타 갱신, 없으면 삽입). definition_ko 없으면 skip.
 *  - observations: (indicator_id, source_id, geo, period) 기준 upsert.
 *      값이 바뀌면 이전 값을 revisions(jsonb)에 push 후 갱신, 같으면 fetched_at만 갱신.
 *  재실행해도 중복 행이 생기지 않는다.
 */
import 'reflect-metadata';
import { AppDataSource } from '../../data-source';
import { Indicator } from '../entities/indicator.entity';
import {
  Observation,
  ObservationRevision,
} from '../entities/observation.entity';
import kcgp from './kcgp-youth.data.json';

interface ObsRow {
  geo: string;
  period: string;
  value: string;
  qualifier: string | null;
  valueLow?: string | null;
  valueHigh?: string | null;
  sourceUrl?: string;
}
interface IndicatorRow {
  code: string;
  domain: string;
  nameKo: string;
  nameEn: string | null;
  unit: string | null;
  definitionKo: string;
  methodNote: string | null;
  sourceId: string | null;
  observations: ObsRow[];
}
interface DataFile {
  sourceId: string;
  sourceUrl: string;
  indicators: IndicatorRow[];
}

async function run() {
  const ds = AppDataSource;
  await ds.initialize();
  const indRepo = ds.getRepository(Indicator);
  const obsRepo = ds.getRepository(Observation);

  const data = kcgp as unknown as DataFile;
  const now = new Date();

  let indInserted = 0;
  let indUpdated = 0;
  let indSkipped = 0;
  let obsInserted = 0;
  let obsUpdated = 0;
  let obsRevised = 0;

  for (const row of data.indicators) {
    // 원칙4: 정의 없는 지표 금지.
    if (!row.definitionKo?.trim()) {
      console.warn(`[collect:indicators] 정의 없음 → skip: ${row.code}`);
      indSkipped++;
      continue;
    }

    const meta = {
      code: row.code,
      domain: row.domain,
      nameKo: row.nameKo,
      nameEn: row.nameEn ?? undefined,
      unit: row.unit ?? undefined,
      definitionKo: row.definitionKo,
      methodNote: row.methodNote ?? undefined,
      sourceId: row.sourceId ?? data.sourceId ?? null,
    };

    let indicator = await indRepo.findOne({ where: { code: row.code } });
    if (indicator) {
      await indRepo.update(indicator.id, meta);
      indicator = await indRepo.findOne({ where: { code: row.code } });
      indUpdated++;
    } else {
      indicator = await indRepo.save(indRepo.create(meta));
      indInserted++;
    }
    if (!indicator) continue;

    for (const o of row.observations) {
      const sourceId = row.sourceId ?? data.sourceId ?? null;
      const sourceUrl = o.sourceUrl ?? data.sourceUrl;
      if (!sourceUrl) {
        // 원칙3: 원본 딥링크 없는 값은 등록하지 않는다.
        console.warn(
          `[collect:indicators] source_url 없음 → skip 관측치: ${row.code} ${o.geo} ${o.period}`,
        );
        continue;
      }
      // 전체값은 sentinel 'total'(NULL 금지 — 유니크 키 포함). 분해는 'group=…' 등.
      const qualifier = o.qualifier ?? 'total';
      const existing = await obsRepo.findOne({
        where: {
          indicatorId: indicator.id,
          sourceId: sourceId ?? undefined,
          geo: o.geo,
          period: o.period,
          qualifier,
        },
      });

      if (!existing) {
        await obsRepo.save(
          obsRepo.create({
            indicatorId: indicator.id,
            sourceId,
            geo: o.geo,
            period: o.period,
            value: o.value,
            valueLow: o.valueLow ?? null,
            valueHigh: o.valueHigh ?? null,
            qualifier,
            revisions: null,
            fetchedAt: now,
            sourceUrl,
            // 큐레이션 시드는 사람이 검증한 값 → approved(원칙8). PDF 크론 추출분만 pending.
            status: 'approved',
          }),
        );
        obsInserted++;
        continue;
      }

      // 값 변경 여부 판정(문자열 numeric 비교는 수치로).
      const changed =
        Number(existing.value) !== Number(o.value) ||
        (existing.valueLow ?? null) !== (o.valueLow ?? null) ||
        (existing.valueHigh ?? null) !== (o.valueHigh ?? null);

      if (changed) {
        const prior: ObservationRevision = {
          value: existing.value,
          valueLow: existing.valueLow,
          valueHigh: existing.valueHigh,
          qualifier: existing.qualifier,
          sourceUrl: existing.sourceUrl,
          fetchedAt: existing.fetchedAt.toISOString(),
        };
        const revisions = [...(existing.revisions ?? []), prior];
        await obsRepo.update(existing.id, {
          value: o.value,
          valueLow: o.valueLow ?? null,
          valueHigh: o.valueHigh ?? null,
          qualifier,
          revisions,
          fetchedAt: now,
          sourceUrl,
          status: 'approved',
        });
        obsRevised++;
      } else {
        // 값 동일 → 생존 확인만(fetched_at 갱신).
        await obsRepo.update(existing.id, { fetchedAt: now });
        obsUpdated++;
      }
    }
  }

  const indTotal = await indRepo.count();
  const obsTotal = await obsRepo.count();
  console.log(
    `[collect:indicators] indicators: 신규 ${indInserted} / 갱신 ${indUpdated} / skip ${indSkipped} (총 ${indTotal})`,
  );
  console.log(
    `[collect:indicators] observations: 신규 ${obsInserted} / 개정 ${obsRevised} / 확인 ${obsUpdated} (총 ${obsTotal})`,
  );

  await ds.destroy();
}

run().catch((e) => {
  console.error('[collect:indicators] 실패:', e);
  process.exit(1);
});
