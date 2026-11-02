import { Link } from '@/i18n/navigation';
import { periodYear, seriesBreakYears, splitAtBreaks } from '@/lib/seriesBreaks';
import { indexSeries, type Point } from '@/lib/homeV2';
import { typeColorVar, type AddictionType } from '@/lib/addictionTypes';
import styles from './v2.module.css';

/**
 * 「한국 중독 10년」 한 그림 (SOC-R19 ■1) — 인라인 SVG · 서버에서 그린다 · 새 패키지 0.
 *
 * 단위가 다른 여섯 선(% · 명)을 한 축에 겹치지 않는다(이중 축 금지 · 여섯 색 모든 쌍 검사 FAIL).
 * → 2×3 작은 그림(원 값 · 그림마다 제 눈금)을 기본으로, 「지수(첫 해 = 100)」 토글은 같은 2×3 을
 *   여섯이 같은 눈금으로 다시 그린 것. 토글은 CSS(라디오 :checked)만 — 자바스크립트 0.
 * 조사 설계 변경 해 = 선을 끊고 점선으로 잇는다(기존 규칙 seriesBreaks).
 * 점마다 <title>(마우스를 올리면 해 · 값) · 표로 보기(details) = 색만으로 읽지 않게.
 */

export interface Panel {
  type: AddictionType;
  typeLabel: string;
  code: string;
  name: string;
  unit: string;
  series: Point[];
  breakYears: number[] | null;
  href: string;
}

const W = 360;
const H = 168;
const PAD = { l: 44, r: 40, t: 12, b: 24 };

function fmtValue(v: number, digits: number) {
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const digitsOf = (series: Point[]) =>
  Math.max(0, ...series.map((p) => (/\.(\d+)$/.exec(p.value)?.[1].length ?? 0)));

function PanelSvg({
  panel,
  values,
  yDomain,
  xDomain,
  digits,
  unitText,
  reference,
  label,
}: {
  panel: Panel;
  values: number[];
  yDomain: [number, number];
  xDomain: [number, number];
  digits: number;
  unitText: string;
  reference: number | null;
  label: string;
}) {
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const xs = (year: number) =>
    PAD.l + ((year - x0) / Math.max(1, x1 - x0)) * (W - PAD.l - PAD.r);
  const ys = (v: number) =>
    H - PAD.b - ((v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
  const periods = panel.series.map((p) => p.period);
  const segs = splitAtBreaks(periods, panel.breakYears);
  const px = (i: number) => xs(periodYear(periods[i]));
  const py = (i: number) => ys(values[i]);
  const pt = (i: number) => `${px(i).toFixed(1)},${py(i).toFixed(1)}`;
  const color = typeColorVar(panel.type);
  const last = values.length - 1;
  const ticks = [y0, y1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.panelSvg}
      role="img"
      aria-label={label}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={ys(v)}
            y2={ys(v)}
            className={styles.grid}
          />
          <text x={PAD.l - 6} y={ys(v) + 4} className={styles.axisText} textAnchor="end">
            {fmtValue(v, digits)}
          </text>
        </g>
      ))}
      {reference !== null && reference > y0 && reference < y1 && (
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={ys(reference)}
          y2={ys(reference)}
          className={styles.reference}
        />
      )}
      {[x0, x1].map((year) => (
        <text
          key={year}
          x={xs(year)}
          y={H - 6}
          className={styles.axisText}
          textAnchor={year === x0 ? 'start' : 'end'}
        >
          {year}
        </text>
      ))}
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
            strokeWidth={2}
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
            r={i === last ? 4 : 2.5}
            fill={color}
            stroke="var(--card-bg)"
            strokeWidth={i === last ? 2 : 1}
          />
          <circle cx={px(i)} cy={py(i)} r={10} fill="transparent">
            <title>{`${periods[i]} · ${fmtValue(v, digits)}${unitText}`}</title>
          </circle>
        </g>
      ))}
      <text
        x={px(last) + 6}
        y={py(last) + 4}
        className={styles.endLabel}
      >
        {fmtValue(values[last], digits)}
      </text>
    </svg>
  );
}

export default function TenYearChart({
  panels,
  labels,
  breakNote,
  unitText,
}: {
  panels: Panel[];
  labels: {
    scaleRaw: string;
    scaleIndex: string;
    scaleIndexNote: string;
    tableView: string;
    colType: string;
    colIndicator: string;
    colValues: string;
    points: (p: Panel) => string;
  };
  breakNote: (years: number[]) => string;
  unitText: (unit: string) => string;
}) {
  const all = panels.flatMap((p) => p.series.map((s) => periodYear(s.period)));
  if (panels.length === 0 || all.length === 0) return null;
  const xDomain: [number, number] = [Math.min(...all), Math.max(...all)];

  const indexed = panels.map((p) => indexSeries(p.series));
  const idxVals = indexed.flat().filter((v): v is number => v !== null);
  const idxDomain: [number, number] = [
    Math.floor(Math.min(100, ...idxVals) / 10) * 10,
    Math.ceil(Math.max(100, ...idxVals) / 10) * 10,
  ];

  return (
    <div className={styles.chart}>
      <input
        type="radio"
        name="v2-scale"
        id="v2-scale-raw"
        className={`${styles.scaleInput} ${styles.scaleRawInput}`}
        defaultChecked
      />
      <input
        type="radio"
        name="v2-scale"
        id="v2-scale-index"
        className={`${styles.scaleInput} ${styles.scaleIndexInput}`}
      />
      <div className={styles.scaleToggle} role="group">
        <label htmlFor="v2-scale-raw" className={styles.scaleRawLabel}>
          {labels.scaleRaw}
        </label>
        <label htmlFor="v2-scale-index" className={styles.scaleIndexLabel}>
          {labels.scaleIndex}
        </label>
      </div>
      <p className={styles.indexNote}>{labels.scaleIndexNote}</p>

      <div className={styles.chartGrid}>
        {panels.map((p, k) => {
          const vals = p.series.map((s) => Number(s.value));
          const lo = Math.min(...vals);
          const hi = Math.max(...vals);
          const digits = digitsOf(p.series);
          const breaks = seriesBreakYears(
            p.series.map((s) => s.period),
            p.breakYears,
          );
          const unit = unitText(p.unit);
          const aria = `${p.typeLabel} · ${p.name} · ${p.series
            .map((s) => `${s.period} ${s.value}`)
            .join(', ')}`;
          return (
            <figure key={p.code} className={styles.panel}>
              <figcaption className={styles.panelHead}>
                <span
                  className={styles.typeDot}
                  style={{ background: typeColorVar(p.type) }}
                  aria-hidden
                />
                <span className={styles.panelType}>{p.typeLabel}</span>
                <Link href={p.href} className={styles.panelName}>
                  {p.name}
                  {unit ? ` (${unit.trim()})` : ''}
                </Link>
              </figcaption>
              <div className={styles.rawView}>
                <PanelSvg
                  panel={p}
                  values={vals}
                  yDomain={[lo, hi === lo ? lo + 1 : hi]}
                  xDomain={xDomain}
                  digits={digits}
                  unitText={unit}
                  reference={null}
                  label={aria}
                />
              </div>
              <div className={styles.indexView}>
                {indexed[k] ? (
                  <PanelSvg
                    panel={p}
                    values={indexed[k]}
                    yDomain={idxDomain}
                    xDomain={xDomain}
                    digits={0}
                    unitText=""
                    reference={100}
                    label={aria}
                  />
                ) : null}
              </div>
              <p className={styles.panelNote}>
                {labels.points(p)}
                {breaks.length > 0 ? ` · ${breakNote(breaks)}` : ''}
              </p>
            </figure>
          );
        })}
      </div>

      <details className={styles.tableView}>
        <summary>{labels.tableView}</summary>
        <div className={styles.tableScroll}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{labels.colType}</th>
                <th>{labels.colIndicator}</th>
                <th>{labels.colValues}</th>
              </tr>
            </thead>
            <tbody>
              {panels.map((p) => (
                <tr key={p.code}>
                  <td>{p.typeLabel}</td>
                  <td>{p.name}</td>
                  <td className={styles.valuesCell}>
                    {p.series.map((s) => `${s.period}: ${s.value}`).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
