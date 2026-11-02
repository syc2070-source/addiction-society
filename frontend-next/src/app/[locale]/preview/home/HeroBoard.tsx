import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { periodYear, splitAtBreaks } from '@/lib/seriesBreaks';
import { indexSeries, type Point } from '@/lib/homeV2';
import { maxIndex } from '@/lib/homeV3';
import { typeColorVarDark, type AddictionType } from '@/lib/addictionTypes';
import styles from './v3.module.css';

/**
 * 견본 A 첫 화면 (SOC-R20 ■2 · ■3 · ■4) — 주인공 그래프 하나(8/12) + 오늘의 큰 수 셋(4/12) + 나머지 다섯 띠.
 * 인라인 SVG · 서버에서 그린다 · 새 패키지 0 · 자바스크립트 0.
 * 「원 값 / 지수(첫 해 = 100)」 토글 = 라디오 :checked(CSS) — 주인공과 띠 다섯에 같이 걸린다.
 * 라디오는 .board(position: relative) 안에 숨겨 두어 키보드 초점이 쪽 맨 위로 튀지 않는다(R19 A1 고침 유지).
 * 수는 저장된 값 그대로 — 지수는 화면용(lib/homeV2.indexSeries).
 */

export interface SeriesPanel {
  type: AddictionType;
  typeLabel: string;
  code: string;
  name: string;
  /** 화면 단위 꼬리(ko '명' · '%' / en ' persons' · '%') */
  unit: string;
  series: Point[];
  breakYears: number[] | null;
  href: string;
}

const fmtNum = (v: number, digits: number) =>
  v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const digitsOf = (series: Point[]) =>
  Math.max(0, ...series.map((p) => /\.(\d+)$/.exec(p.value)?.[1].length ?? 0));

/** 0 부터 올라가는 눈금 끝(면 채움은 0 기준선이어야 정직하다) */
function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(v));
  return (Math.ceil((v / step) * 2) / 2) * step;
}

/* ── 주인공 ── */

const HW = 740;
const HH = 320;
const HP = { l: 64, r: 72, t: 36, b: 40 };

function HeroSvg({
  panel,
  values,
  y1,
  digits,
  unit,
  maxLabel,
  aria,
}: {
  panel: SeriesPanel;
  values: number[];
  y1: number;
  digits: number;
  unit: string;
  maxLabel: (period: string, value: string) => string;
  aria: string;
}) {
  const periods = panel.series.map((p) => p.period);
  const years = periods.map(periodYear);
  const x0 = Math.min(...years);
  const x1 = Math.max(...years);
  const xs = (y: number) => HP.l + ((y - x0) / Math.max(1, x1 - x0)) * (HW - HP.l - HP.r);
  const ys = (v: number) => HH - HP.b - (v / (y1 || 1)) * (HH - HP.t - HP.b);
  const px = (i: number) => xs(years[i]);
  const py = (i: number) => ys(values[i]);
  const pt = (i: number) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`;
  const segs = splitAtBreaks(periods, panel.breakYears);
  const color = typeColorVarDark(panel.type);
  const last = values.length - 1;
  const top = maxIndex(values);
  const base = ys(0);
  const fmt = (v: number) => fmtNum(v, digits);
  return (
    <svg viewBox={`0 0 ${HW} ${HH}`} className={styles.heroSvg} role="img" aria-label={aria}>
      {[0, y1 / 2, y1].map((v) => (
        <g key={v}>
          <line x1={HP.l} x2={HW - HP.r} y1={ys(v)} y2={ys(v)} className={styles.grid} />
          <text x={HP.l - 8} y={ys(v) + 4} textAnchor="end" className={styles.axisText}>
            {fmtNum(v, v % 1 === 0 ? 0 : 1)}
          </text>
        </g>
      ))}
      {segs.map((seg) =>
        seg.length > 1 ? (
          <polygon
            key={`a${seg[0]}`}
            points={`${px(seg[0]).toFixed(1)},${base} ${seg.map(pt).join(' ')} ${px(seg[seg.length - 1]).toFixed(1)},${base}`}
            fill={color}
            fillOpacity={0.14}
          />
        ) : null,
      )}
      {segs.slice(1).map((seg, k) => (
        <polyline
          key={`b${seg[0]}`}
          className={styles.breakLine}
          points={`${pt(segs[k][segs[k].length - 1])} ${pt(seg[0])}`}
        />
      ))}
      {segs.map((seg) =>
        seg.length > 1 ? (
          <polyline
            key={`s${seg[0]}`}
            points={seg.map(pt).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null,
      )}
      {values.map((v, i) => (
        <g key={periods[i]}>
          <circle
            cx={px(i)}
            cy={py(i)}
            r={i === last ? 8 : 3.5}
            fill={color}
            stroke="var(--dark-bg)"
            strokeWidth={i === last ? 3 : 1.5}
          />
          <circle cx={px(i)} cy={py(i)} r={14} fill="transparent">
            <title>{`${periods[i]} · ${fmt(v)}${unit}`}</title>
          </circle>
        </g>
      ))}
      {/* 최대 점 라벨 */}
      {top >= 0 && top !== last && (
        <text x={px(top)} y={py(top) - 14} textAnchor="middle" className={styles.maxLabel}>
          {maxLabel(periods[top], fmt(values[top]))}
        </text>
      )}
      {/* 첫 점 값 · 끝 점 값 */}
      <text x={px(0)} y={py(0) - 12} textAnchor="start" className={styles.pointLabel}>
        {fmt(values[0])}
      </text>
      {/* 끝 값은 점 아래 · 오른쪽 맞춤(좁은 화면에서 판 밖으로 잘리지 않게) */}
      <text x={px(last)} y={py(last) + 36} textAnchor="end" className={styles.endLabel}>
        {fmt(values[last])}
      </text>
      {top === last && (
        <text x={px(last)} y={py(last) - 16} textAnchor="end" className={styles.maxLabel}>
          {maxLabel(periods[last], fmt(values[last]))}
        </text>
      )}
      {/* x 축: 첫 해 · 마지막 해 */}
      <text x={px(0)} y={HH - 12} textAnchor="start" className={styles.axisYear}>
        {periods[0]}
      </text>
      <text x={px(last)} y={HH - 12} textAnchor="end" className={styles.axisYear}>
        {periods[last]}
      </text>
    </svg>
  );
}

/* ── 띠(240×80) ── */

const SW = 240;
const SH = 80;
const SP = { l: 6, r: 10, t: 10, b: 10 };

function StripSvg({
  panel,
  values,
  yDomain,
  aria,
}: {
  panel: SeriesPanel;
  values: number[];
  yDomain: [number, number];
  aria: string;
}) {
  const periods = panel.series.map((p) => p.period);
  const years = periods.map(periodYear);
  const x0 = Math.min(...years);
  const x1 = Math.max(...years);
  const [y0, y1] = yDomain;
  const xs = (y: number) => SP.l + ((y - x0) / Math.max(1, x1 - x0)) * (SW - SP.l - SP.r);
  const ys = (v: number) => SH - SP.b - ((v - y0) / (y1 - y0 || 1)) * (SH - SP.t - SP.b);
  const pt = (i: number) => `${xs(years[i]).toFixed(1)},${ys(values[i]).toFixed(1)}`;
  const segs = splitAtBreaks(periods, panel.breakYears);
  const color = typeColorVarDark(panel.type);
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className={styles.stripSvg} role="img" aria-label={aria}>
      {segs.slice(1).map((seg, k) => (
        <polyline
          key={`b${seg[0]}`}
          className={styles.breakLine}
          points={`${pt(segs[k][segs[k].length - 1])} ${pt(seg[0])}`}
        />
      ))}
      {segs.map((seg) =>
        seg.length > 1 ? (
          <polyline
            key={`s${seg[0]}`}
            points={seg.map(pt).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <circle
            key={`p${seg[0]}`}
            cx={xs(years[seg[0]])}
            cy={ys(values[seg[0]])}
            r={3}
            fill={color}
          />
        ),
      )}
      <circle
        cx={xs(years[last])}
        cy={ys(values[last])}
        r={5}
        fill={color}
        stroke="var(--dark-card)"
        strokeWidth={2}
      />
      {values.map((v, i) => (
        <circle key={periods[i]} cx={xs(years[i])} cy={ys(values[i])} r={9} fill="transparent">
          <title>{`${periods[i]} · ${panel.series[i].value}${panel.unit}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function HeroBoard({
  hero,
  heroHead,
  heroMaxLabel,
  heroIndexMaxLabel,
  strips,
  stripNote,
  tiles,
  labels,
}: {
  hero: SeriesPanel;
  /** 그래프 위 머리(유형 · 지표 · 기관 · 점 수 · 기간 · 큰 수 · n배) — 페이지가 짠다 */
  heroHead: ReactNode;
  heroMaxLabel: (period: string, value: string) => string;
  heroIndexMaxLabel: (period: string, value: string) => string;
  strips: SeriesPanel[];
  stripNote: (p: SeriesPanel) => string;
  tiles: ReactNode;
  labels: {
    scaleRaw: string;
    scaleIndex: string;
    scaleIndexNote: string;
    tilesLabel: string;
    stripsLabel: string;
  };
}) {
  const heroVals = hero.series.map((p) => Number(p.value));
  const heroDigits = digitsOf(hero.series);
  const all = [hero, ...strips];
  const indexed = all.map((p) => indexSeries(p.series));
  const idxVals = indexed.flat().filter((v): v is number => v !== null);
  // 지수 눈금 = 일곱 계열이 함께 쓰는 하나(0 ~ 50 단위 올림 · 100 포함)
  const idxTop = Math.ceil(Math.max(100, ...idxVals) / 50) * 50;
  const aria = (p: SeriesPanel) =>
    `${p.typeLabel} · ${p.name} · ${p.series.map((s) => `${s.period} ${s.value}`).join(', ')}`;

  return (
    <div className={styles.board}>
      <input
        type="radio"
        name="v3-scale"
        id="v3-scale-raw"
        className={`${styles.scaleInput} ${styles.scaleRawInput}`}
        defaultChecked
      />
      <input
        type="radio"
        name="v3-scale"
        id="v3-scale-index"
        className={`${styles.scaleInput} ${styles.scaleIndexInput}`}
      />
      <div className={styles.scaleToggle} role="group">
        <label htmlFor="v3-scale-raw" className={styles.scaleRawLabel}>
          {labels.scaleRaw}
        </label>
        <label htmlFor="v3-scale-index" className={styles.scaleIndexLabel}>
          {labels.scaleIndex}
        </label>
      </div>
      <p className={styles.indexNote}>{labels.scaleIndexNote}</p>

      <div className={styles.boardGrid}>
        <figure className={styles.hero}>
          <figcaption>{heroHead}</figcaption>
          <div className={styles.rawView}>
            <HeroSvg
              panel={hero}
              values={heroVals}
              y1={niceCeil(Math.max(...heroVals))}
              digits={heroDigits}
              unit={hero.unit}
              maxLabel={heroMaxLabel}
              aria={aria(hero)}
            />
          </div>
          <div className={styles.indexView}>
            {indexed[0] ? (
              <HeroSvg
                panel={hero}
                values={indexed[0]}
                y1={idxTop}
                digits={0}
                unit=""
                maxLabel={heroIndexMaxLabel}
                aria={aria(hero)}
              />
            ) : null}
          </div>
        </figure>

        <div className={styles.tiles} role="group" aria-label={labels.tilesLabel}>
          {tiles}
        </div>
      </div>

      {strips.length > 0 && (
        <div className={styles.strips} role="group" aria-label={labels.stripsLabel}>
          {strips.map((p, k) => {
            const vals = p.series.map((s) => Number(s.value));
            const lo = Math.min(...vals);
            const hi = Math.max(...vals);
            const idx = indexed[k + 1];
            const lastPoint = p.series[p.series.length - 1];
            return (
              <figure key={p.code} className={styles.strip}>
                <figcaption className={styles.stripHead}>
                  <span
                    className={styles.typeDot}
                    style={{ background: typeColorVarDark(p.type) }}
                    aria-hidden
                  />
                  <span className={styles.stripType}>{p.typeLabel}</span>
                  <span className={styles.stripValue}>
                    {lastPoint.value.includes('.') || Number(lastPoint.value) < 1000
                      ? lastPoint.value
                      : fmtNum(Number(lastPoint.value), 0)}
                    {p.unit}
                  </span>
                </figcaption>
                <div className={styles.rawView}>
                  <StripSvg
                    panel={p}
                    values={vals}
                    yDomain={[lo, hi === lo ? lo + 1 : hi]}
                    aria={aria(p)}
                  />
                </div>
                <div className={styles.indexView}>
                  {idx ? (
                    <StripSvg panel={p} values={idx} yDomain={[0, idxTop]} aria={aria(p)} />
                  ) : null}
                </div>
                <p className={styles.stripName}>
                  <Link href={p.href} className={styles.darkLink}>
                    {p.name}
                  </Link>
                </p>
                <p className={styles.stripNote}>{stripNote(p)}</p>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
