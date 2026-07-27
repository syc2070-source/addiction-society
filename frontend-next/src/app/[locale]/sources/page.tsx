import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { fetchSources, type Source } from "@/lib/api";

/**
 * 소스 지도 (/sources) — 기존 SourceList.tsx 기능 동등 이식.
 * 서버 컴포넌트 + URL searchParams 필터(GET 폼) — SEO 친화.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sources" });
  return { title: t("title") };
}

const DOMAINS = ["alcohol", "drug", "gambling", "digital", "policy", "multi"];
const SCOPES = ["intl", "korea"];
const CADENCES = [
  "monthly",
  "quarterly",
  "annual",
  "biennial",
  "quinquennial",
  "irregular",
];

/** 신뢰도 뱃지: 1=1차(그린) 2=기관2차(블루) 3=언론(회색) */
function reliabilityBadge(
  r: number | null,
): { key: string; color: string } | null {
  // 밝은 배경 AA 대비 토큰 사용(초록 액센트 폐지 → 1차 소스는 앰버로 강조)
  if (r === 1) return { key: "reliability1", color: "var(--accent-text)" };
  if (r === 2) return { key: "reliability2", color: "var(--link)" };
  if (r === 3) return { key: "reliability3", color: "var(--text-muted)" };
  return null;
}

export default async function SourcesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/sources">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const l = locale as AppLocale;

  const filters = {
    search: typeof sp.search === "string" ? sp.search : undefined,
    domain: typeof sp.domain === "string" ? sp.domain : undefined,
    scope: typeof sp.scope === "string" ? sp.scope : undefined,
    cadence: typeof sp.cadence === "string" ? sp.cadence : undefined,
  };

  const t = await getTranslations("sources");
  const tc = await getTranslations("common");
  const result = await fetchSources(filters);

  const title = (s: Source) =>
    l === "en" && s.titleEn ? s.titleEn : s.titleKo;
  const subtitle = (s: Source) => (l === "en" ? s.titleKo : s.titleEn);

  return (
    <main className="page-container">
      <div className="page-header">
        <div className="page-kicker">{t("kicker")}</div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-desc">{t("desc", { total: result?.total ?? 0 })}</p>
      </div>

      {/* GET 폼 → 같은 경로 searchParams. JS 없이 동작 */}
      <form method="get" className="search-form">
        <input
          type="text"
          name="search"
          className="search-input"
          defaultValue={filters.search}
          placeholder={t("searchPlaceholder")}
        />
        <select
          name="domain"
          className="filter-select"
          defaultValue={filters.domain ?? ""}
        >
          <option value="">{t("domainAll")}</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {t(`domain.${d}`)}
            </option>
          ))}
        </select>
        <select
          name="scope"
          className="filter-select"
          defaultValue={filters.scope ?? ""}
        >
          <option value="">{t("scopeAll")}</option>
          {SCOPES.map((s) => (
            <option key={s} value={s}>
              {t(`scope.${s}`)}
            </option>
          ))}
        </select>
        <select
          name="cadence"
          className="filter-select"
          defaultValue={filters.cadence ?? ""}
        >
          <option value="">{t("cadenceAll")}</option>
          {CADENCES.map((c) => (
            <option key={c} value={c}>
              {t(`cadence.${c}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-submit">
          {tc("searchButton")}
        </button>
      </form>

      {!result ? (
        <p className="status-note">{tc("unavailable")}</p>
      ) : result.data.length === 0 ? (
        <p className="status-note">{tc("empty")}</p>
      ) : (
        <div className="list-grid">
          {result.data.map((s) => {
            const stale = s.status === "stale";
            const rb = reliabilityBadge(s.reliability);
            return (
              <div
                key={s.id}
                className="list-item"
              >
                <div className="list-item-meta">
                  <span className="tag tag-org">
                    {l === "en" ? s.org : s.orgKo || s.org}
                  </span>
                  {s.domain && (
                    <span className="tag">{t(`domain.${s.domain}`)}</span>
                  )}
                  {s.scope && (
                    <span className="tag">{t(`scope.${s.scope}`)}</span>
                  )}
                  {s.cadence && (
                    <span className="tag">{t(`cadence.${s.cadence}`)}</span>
                  )}
                  {rb && (
                    <span
                      className="tag"
                      style={{ color: rb.color, borderColor: rb.color }}
                    >
                      {t(rb.key)}
                    </span>
                  )}
                  {stale && <span className="tag tag-warn">{t("stale")}</span>}
                </div>

                <h3 className="list-item-title">{title(s)}</h3>
                {subtitle(s) && (
                  <p
                    className="list-item-desc"
                    style={{ marginTop: 0 }}
                  >
                    {subtitle(s)}
                  </p>
                )}

                <div className="meta-row">
                  <span>
                    {t("lastPublished")}:{" "}
                    <strong>
                      {s.lastPublishedAt || tc("collecting")}
                    </strong>
                  </span>
                  <span>
                    {t("nextExpected")}:{" "}
                    <strong>
                      {s.nextExpectedAt || "—"}
                    </strong>
                  </span>
                </div>

                {s.license && (
                  <p className="meta-note">
                    {t("license")}: {s.license}
                  </p>
                )}

                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link"
                >
                  {tc("viewOriginal")}
                </a>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
