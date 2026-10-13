import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  fetchCalendar,
  fetchMissedReleases,
  fetchSources,
  type Source,
} from "@/lib/api";

/**
 * 발표 캘린더 (/calendar) — 기존 SourceCalendar.tsx 이식.
 * 월별 그룹 + 미정 그룹 + ★ 기사화 우선(한국·1차 소스).
 * SOC-R3: 「지난 예정 · 미확인」 — 예정 월이 끝났는데 발표를 확인하지 못한 것
 * (GET /api/sources/calendar/missed). 월별 그룹은 이번 달 이후만 보인다.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "calendarPage" });
  return { title: t("title") };
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** ★ 기사화 우선순위: 1차 소스 AND 한국 */
const isStar = (s: Source) => s.reliability === 1 && s.scope === "korea";

export default async function CalendarPage({
  params,
}: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = locale as AppLocale;

  const t = await getTranslations("calendarPage");
  const ts = await getTranslations("sources");
  const tc = await getTranslations("common");

  // 예정(임박순) + 미정 그룹 도출용 전체 목록
  const [scheduled, all, missed] = await Promise.all([
    fetchCalendar(),
    fetchSources({}),
    fetchMissedReleases(),
  ]);
  const undated = (all?.data ?? []).filter((s) => !s.nextExpectedAt);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    const mi = parseInt(m, 10);
    return l === "en"
      ? t("month", { year: y, month: EN_MONTHS[mi - 1] })
      : t("month", { year: y, month: mi });
  };

  const title = (s: Source) =>
    l === "en" && s.titleEn ? s.titleEn : s.titleKo;

  const groups: Record<string, Source[]> = {};
  (scheduled ?? []).forEach((s) => {
    const key = String(s.nextExpectedAt || "").slice(0, 7);
    (groups[key] ??= []).push(s);
  });
  const monthKeys = Object.keys(groups).sort();

  const failed = scheduled === null && all === null;

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t("kicker")}</div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-desc">{t("desc")}</p>
      </div>

      {failed ? (
        <p className="status-note">{tc("unavailable")}</p>
      ) : monthKeys.length === 0 && undated.length === 0 ? (
        <p className="status-note">{tc("collecting")}</p>
      ) : (
        <>
          {monthKeys.map((mk) => (
            <div key={mk} style={{ marginBottom: "var(--space-3)" }}>
              <h2 className="group-heading">{monthLabel(mk)}</h2>
              <div className="list-grid">
                {groups[mk].map((s) => (
                  <div key={s.id} className="list-item">
                    <div className="list-item-meta">
                      <span className="tag tag-org">
                        {l === "en" ? s.org : s.orgKo || s.org}
                      </span>
                      <span className="tag">{ts(`scope.${s.scope}`)}</span>
                      {isStar(s) && (
                        <span className="tag tag-warn">{t("star")}</span>
                      )}
                    </div>
                    <h3 className="list-item-title">
                      {isStar(s) ? "★ " : ""}
                      {title(s)}
                    </h3>
                    <p className="list-item-desc" style={{ margin: 0 }}>
                      {t("scheduledFor", {
                        ym: String(s.nextExpectedAt).slice(0, 7),
                      })}
                      {l === "ko" && s.titleEn ? ` · ${s.titleEn}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 지난 예정 · 미확인 (SOC-R3) — 없으면 줄을 숨긴다 */}
          {missed && missed.length > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <h2 className="group-heading">{t("missedGroup")}</h2>
              <p className="page-desc">{t("missedDesc")}</p>
              <div className="list-grid">
                {missed.map((m) => (
                  <div
                    key={`${m.sourceId}-${m.expected}`}
                    className="list-item"
                  >
                    <div className="list-item-meta">
                      <span className="tag tag-org">
                        {l === "en" ? m.org : m.orgKo || m.org}
                      </span>
                      {/* SOC-R4: 「읽지 못함」(감시 실패)과 「발표 없음」(읽었는데 없음)을 가른다 */}
                      {m.monitor ? (
                        <span
                          className={
                            m.monitor === "unreadable" ? "tag tag-warn" : "tag"
                          }
                        >
                          {t(`missedMonitor.${m.monitor}`)}
                        </span>
                      ) : (
                        <span className="tag tag-warn">{t("missedGroup")}</span>
                      )}
                    </div>
                    <h3 className="list-item-title">
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        {l === "en" && m.titleEn ? m.titleEn : m.titleKo}
                      </a>
                    </h3>
                    <p className="list-item-desc" style={{ margin: 0 }}>
                      {m.next
                        ? t("missedRolled", {
                            expected: m.expected,
                            next: m.next,
                          })
                        : t("missedCheck", { expected: m.expected })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 미정 그룹 (next_expected_at null — irregular 및 발표시점 미상) */}
          {undated.length > 0 && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <h2 className="group-heading">{t("undatedGroup")}</h2>
              <div className="list-grid">
                {undated.map((s) => (
                  <div key={s.id} className="list-item">
                    <div className="list-item-meta">
                      <span className="tag tag-org">
                        {l === "en" ? s.org : s.orgKo || s.org}
                      </span>
                      <span className="tag">{ts(`scope.${s.scope}`)}</span>
                      <span className="tag">
                        {s.cadence === "irregular"
                          ? ts("cadence.irregular")
                          : tc("collecting")}
                      </span>
                      {isStar(s) && <span className="tag tag-warn">★</span>}
                    </div>
                    <h3 className="list-item-title">
                      {isStar(s) ? "★ " : ""}
                      {title(s)}
                    </h3>
                    <p className="list-item-desc" style={{ margin: 0 }}>
                      {t("undated")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
