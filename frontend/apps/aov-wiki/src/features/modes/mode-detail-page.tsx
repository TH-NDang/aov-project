import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext } from "../../context/wiki-context"
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
  GROUP_LABEL,
  ModeArt,
  RuleList,
} from "./mode-ui"
import "./modes.css"

/** One mode: art, length, availability and rules; a mode with a published guide shows it in tabs below. */
export function ModeDetailPage() {
  const { code = "", tab } = useParams()
  const { href, locale } = useWikiContext()
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

  if (mode.isPending) return <p className="mode-empty">Đang tải chế độ…</p>
  if (mode.isError) {
    const missing = mode.error instanceof ModeRequestError && mode.error.status === 404
    return (
      <div className="mode-page">
        <p className="mode-empty">{missing ? "Chế độ này chưa có trên Wiki." : "Chưa tải được chế độ."}</p>
        <Link to={href("/modes")}>← Tất cả chế độ</Link>
      </div>
    )
  }

  const { content, images } = mode.data
  const known = GUIDE_TABS.some((item) => item.key === tab)
  if (tab && (!hasGuide || !known)) return <Navigate to={href(`/modes/${encodeURIComponent(code)}`)} replace />
  const activeTab = (tab ?? "tong-quan") as GuideTab
  const duration = durationText(content.duration)
  const art = content.artAssetId ? images[content.artAssetId] : null
  // A guide's rules repeat and extend the mode's, so the page shows one list: the longer one.
  const guideRules = guide.data?.content.rules ?? []
  const rules = guideRules.length > content.rules.length ? guideRules : content.rules

  return (
    <div className="mode-page">
      <CatalogHeading title={content.name} section="Chế độ chơi" />
      <ModeArt
        className={activeTab === "tong-quan" ? "mode-banner" : "mode-banner mode-banner-compact"}
        image={art}
        name={content.name}
        eager
      >
        <div className="mode-banner-copy">
          <p className="mode-meta">
            <span>{GROUP_LABEL[content.group]}</span>
            {duration && <span>{duration} / trận</span>}
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
        <nav className="guide-tabs" aria-label="Mục cẩm nang">
          {GUIDE_TABS.map((item) => (
            <Link
              key={item.key}
              className="guide-tab"
              aria-current={activeTab === item.key ? "page" : undefined}
              to={href(`/modes/${encodeURIComponent(code)}${item.key === "tong-quan" ? "" : `/${item.key}`}`)}
              preventScrollReset
            >
              {item.label}
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
                <h2>Giới thiệu</h2>
                <p className="mode-prose">{content.summary}</p>
              </section>
            )}
            {guide.data && <AutoChessOverview guide={guide.data} code={code} />}
            {rules.length > 0 &&
              (guide.data ? (
                <details className="mode-panel ov-rules">
                  <summary>Luật chơi đầy đủ</summary>
                  <RuleList rules={rules} collapsible={layout === "compact"} />
                </details>
              ) : (
                <section className="mode-panel">
                  <h2>Luật chơi</h2>
                  <RuleList rules={rules} collapsible={layout === "compact"} />
                </section>
              ))}
            {content.heroes.length > 0 && (
              <section className="mode-panel">
                <h2>Tướng của chế độ</h2>
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
                <h2>Vật phẩm riêng</h2>
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
              <p className="mode-empty">Chế độ này mới có thông tin cơ bản. Luật chơi và hình ảnh sẽ được bổ sung.</p>
            )}
            {layout === "compact" && (
              <>
                <Sources content={content} />
                <Link to={href("/modes")}>← Tất cả chế độ</Link>
              </>
            )}
          </div>
          {layout === "wide" && (
            <aside className="mode-panel mode-aside" aria-label="Thông tin nhanh">
              <h2>Thông tin nhanh</h2>
              <QuickFacts content={content} edition={guide.data?.content.edition} />
              <Sources content={content} />
              <Link to={href("/modes")}>← Tất cả chế độ</Link>
            </aside>
          )}
        </div>
      ) : guide.isPending ? (
        <p className="mode-empty">Đang tải cẩm nang…</p>
      ) : guide.isError ? (
        <p className="mode-empty">Chưa tải được cẩm nang.</p>
      ) : (
        <AutoChessGuide code={code} tab={activeTab} guide={guide.data} />
      )}
    </div>
  )
}

/** On a phone the facts sit right under the art as one compact block instead of a column at the end. */
function QuickFacts({ content, edition, inline }: { content: ModeContent; edition?: string | null; inline?: boolean }) {
  const duration = durationText(content.duration)
  const availability = content.availability
  const facts: [string, string][] = [
    ["Nhóm", GROUP_LABEL[content.group]],
    ...(duration ? ([["Thời lượng", duration]] as [string, string][]) : []),
    ...(content.playersLabel ? ([["Số người", content.playersLabel]] as [string, string][]) : []),
    ["Tình trạng", availabilityLabel(availability) ?? "Chưa rõ"],
    ...(availability?.startsOn || availability?.endsOn
      ? ([
          ["Thời gian mở", `${formatDay(availability.startsOn) ?? "?"} – ${formatDay(availability.endsOn) ?? "?"}`],
        ] as [string, string][])
      : []),
    ...(availability?.observedOn ? ([["Ghi nhận", formatDay(availability.observedOn)!]] as [string, string][]) : []),
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
          <dt>Cẩm nang</dt>
          <dd>{edition}</dd>
        </div>
      )}
      {availability?.note && (
        <div data-wide="true">
          <dt>Ghi chú</dt>
          <dd>{availability.note}</dd>
        </div>
      )}
    </dl>
  )
}

function Sources({ content }: { content: ModeContent }) {
  if (!content.sources.length) return null
  return (
    <p className="mode-sources">
      Nguồn: {content.sources.map((source) => source.label).join("; ")}. Hình ảnh: Garena / Liên Quân Mobile.
    </p>
  )
}
