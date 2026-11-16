import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { modeMeta, notFoundMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { AutoChessGuide, GUIDE_TABS, type GuideTab } from "./auto-chess-guide"
import { AutoChessOverview } from "./auto-chess-overview"
import { guideQuery, modeQuery, ModeRequestError, type ModeContent } from "./mode-api"
import {
  AvailabilityBadge,
  availabilityLabel,
  durationText,
  formatDay,
  GROUP_NAMES,
  ModeArt,
  RuleList,
} from "./mode-ui"
import "./modes.css"

/** One mode: art, length, availability and rules; a mode with a published guide shows it in tabs below. */
export function ModeDetailPage() {
  const { code = "", tab } = useParams()
  const { href, locale, t } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const layout = usePageLayout()
  const mode = useQuery(modeQuery(code))
  const hasGuide = !!mode.data?.hasGuide
  const guide = useQuery({ ...guideQuery(code), enabled: hasGuide })
  // Every tab shares the mode's address as canonical: only the mode page itself is prerendered.
  const headArt = mode.data?.content.artAssetId ? mode.data.images[mode.data.content.artAssetId] : null
  usePageHead(
    mode.data
      ? modeMeta(
          {
            code: mode.data.code,
            name: mode.data.content.name,
            summary: mode.data.content.summary,
            hasGuide,
            art: headArt,
          },
          locale,
        )
      : mode.error instanceof ModeRequestError && mode.error.status === 404
        ? notFoundMeta(locale, `/modes/${encodeURIComponent(code)}`, "modes")
        : null,
  )

  if (mode.isPending) return <p className="mode-empty">{text("Đang tải chế độ…", "Loading the mode…")}</p>
  if (mode.isError) {
    const missing = mode.error instanceof ModeRequestError && mode.error.status === 404
    return (
      <div className="mode-page">
        <p className="mode-empty">
          {missing
            ? text("Chế độ này chưa có trên Wiki.", "This mode is not on the Wiki yet.")
            : text("Chưa tải được chế độ.", "The mode could not be loaded.")}
        </p>
        <Link to={href("/modes")}>{text("← Tất cả chế độ", "← All modes")}</Link>
      </div>
    )
  }

  const { content, images } = mode.data
  const known = GUIDE_TABS.some((item) => item.key === tab)
  if (tab && (!hasGuide || !known)) return <Navigate to={href(`/modes/${encodeURIComponent(code)}`)} replace />
  const activeTab = (tab ?? "tong-quan") as GuideTab
  const duration = durationText(content.duration, locale)
  const art = content.artAssetId ? images[content.artAssetId] : null
  // A guide's rules repeat and extend the mode's, so the page shows one list: the longer one.
  const guideRules = guide.data?.content.rules ?? []
  const rules = guideRules.length > content.rules.length ? guideRules : content.rules

  return (
    <div className="mode-page">
      <CatalogHeading title={content.name} section={t("modes")} />
      <ModeArt
        className={activeTab === "tong-quan" ? "mode-banner" : "mode-banner mode-banner-compact"}
        image={art}
        name={content.name}
        eager
      >
        <div className="mode-banner-copy">
          <p className="mode-meta">
            <span>{text(GROUP_NAMES[content.group][0], GROUP_NAMES[content.group][1])}</span>
            {duration && <span>{text(`${duration} / trận`, `${duration} / match`)}</span>}
            {content.playersLabel && <span>{content.playersLabel}</span>}
          </p>
          <span className="mode-badges">
            <AvailabilityBadge availability={content.availability} />
          </span>
        </div>
      </ModeArt>
      {/* The cover carries no name; on phones, where there is no page heading, the name follows the cover. */}
      {layout === "compact" && <h1 className="mode-compact-title">{content.name}</h1>}

      {hasGuide && (
        <nav className="guide-tabs" aria-label={text("Mục cẩm nang", "Guide sections")}>
          {GUIDE_TABS.map((item) => (
            <Link
              key={item.key}
              className="guide-tab"
              aria-current={activeTab === item.key ? "page" : undefined}
              to={href(`/modes/${encodeURIComponent(code)}${item.key === "tong-quan" ? "" : `/${item.key}`}`)}
              preventScrollReset
            >
              {text(item.label, item.english)}
            </Link>
          ))}
        </nav>
      )}

      {activeTab === "tong-quan" ? (
        <div className="mode-columns">
          <div className="mode-stack">
            {layout === "compact" && <QuickFacts content={content} edition={guide.data?.content.edition} inline />}
            {content.summary && (
              <section className="mode-panel">
                <h2>{text("Giới thiệu", "Introduction")}</h2>
                <p className="mode-prose">{content.summary}</p>
              </section>
            )}
            {guide.data && <AutoChessOverview guide={guide.data} code={code} />}
            {rules.length > 0 &&
              (guide.data ? (
                <details className="mode-panel ov-rules">
                  <summary>{text("Luật chơi đầy đủ", "Full rules")}</summary>
                  <RuleList rules={rules} collapsible={layout === "compact"} />
                </details>
              ) : (
                <section className="mode-panel">
                  <h2>{text("Luật chơi", "Rules")}</h2>
                  <RuleList rules={rules} collapsible={layout === "compact"} />
                </section>
              ))}
            {content.heroes.length > 0 && (
              <section className="mode-panel">
                <h2>{text("Tướng của chế độ", "Heroes of this mode")}</h2>
                <ul className="mode-hero-list">
                  {content.heroes.map((hero) => (
                    <li key={hero.name}>
                      {hero.heroCode ? <Link to={href(`/hero/${hero.heroCode}`)}>{hero.name}</Link> : hero.name}
                      {hero.note && <span className="mode-meta"> — {hero.note}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {content.specialItems.length > 0 && (
              <section className="mode-panel">
                <h2>{text("Vật phẩm riêng", "Special items")}</h2>
                <div className="guide-card-list">
                  {content.specialItems.map((item) => (
                    <article key={item.name} className="guide-card">
                      {item.iconAssetId && images[item.iconAssetId] ? (
                        <img className="guide-icon" src={images[item.iconAssetId]!.url} alt="" />
                      ) : (
                        <span />
                      )}
                      <div>
                        <h3>{item.name}</h3>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {!content.summary && !rules.length && !hasGuide && (
              <p className="mode-empty">
                {text(
                  "Chế độ này mới có thông tin cơ bản. Luật chơi và hình ảnh sẽ được bổ sung.",
                  "This mode only has basic information so far. Rules and images will be added.",
                )}
              </p>
            )}
            {layout === "compact" && (
              <>
                <Sources content={content} />
                <Link to={href("/modes")}>{text("← Tất cả chế độ", "← All modes")}</Link>
              </>
            )}
          </div>
          {layout === "wide" && (
            <aside className="mode-panel mode-aside" aria-label={text("Thông tin nhanh", "Quick facts")}>
              <h2>{text("Thông tin nhanh", "Quick facts")}</h2>
              <QuickFacts content={content} edition={guide.data?.content.edition} />
              <Sources content={content} />
              <Link to={href("/modes")}>{text("← Tất cả chế độ", "← All modes")}</Link>
            </aside>
          )}
        </div>
      ) : guide.isPending ? (
        <p className="mode-empty">{text("Đang tải cẩm nang…", "Loading the guide…")}</p>
      ) : guide.isError ? (
        <p className="mode-empty">{text("Chưa tải được cẩm nang.", "The guide could not be loaded.")}</p>
      ) : (
        <AutoChessGuide code={code} tab={activeTab} guide={guide.data} />
      )}
    </div>
  )
}

/** On a phone the facts sit right under the art as one compact block instead of a column at the end. */
function QuickFacts({ content, edition, inline }: { content: ModeContent; edition?: string | null; inline?: boolean }) {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const duration = durationText(content.duration, locale)
  const availability = content.availability
  const facts: [string, string][] = [
    [text("Nhóm", "Group"), text(GROUP_NAMES[content.group][0], GROUP_NAMES[content.group][1])],
    ...(duration ? ([[text("Thời lượng", "Duration"), duration]] as [string, string][]) : []),
    ...(content.playersLabel ? ([[text("Số người", "Players"), content.playersLabel]] as [string, string][]) : []),
    [text("Tình trạng", "Availability"), availabilityLabel(availability, locale) ?? text("Chưa rõ", "Unknown")],
    ...(availability?.startsOn || availability?.endsOn
      ? ([
          [
            text("Thời gian mở", "Open period"),
            `${formatDay(availability.startsOn, locale) ?? "?"} – ${formatDay(availability.endsOn, locale) ?? "?"}`,
          ],
        ] as [string, string][])
      : []),
    ...(availability?.observedOn
      ? ([[text("Ghi nhận", "Recorded"), formatDay(availability.observedOn, locale)!]] as [string, string][])
      : []),
  ]
  return (
    <dl className="mode-facts" data-inline={inline || undefined}>
      {facts.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {edition && (
        <div data-wide="true">
          <dt>{text("Cẩm nang", "Guide")}</dt>
          <dd>{edition}</dd>
        </div>
      )}
      {availability?.note && (
        <div data-wide="true">
          <dt>{text("Ghi chú", "Note")}</dt>
          <dd>{availability.note}</dd>
        </div>
      )}
    </dl>
  )
}

function Sources({ content }: { content: ModeContent }) {
  const { locale } = useWikiContext()
  if (!content.sources.length) return null
  return (
    <p className="mode-sources">
      {wikiText(locale, "Nguồn", "Sources")}: {content.sources.map((source) => source.label).join("; ")}.{" "}
      {wikiText(locale, "Hình ảnh", "Images")}: Garena / Liên Quân Mobile.
    </p>
  )
}
