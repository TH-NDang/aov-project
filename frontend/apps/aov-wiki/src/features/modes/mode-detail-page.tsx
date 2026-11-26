import { useEffect, useRef, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useLocation, useParams } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText, useWikiText } from "../../context/wiki-context"
import { WikiBreadcrumb } from "../../components/wiki-breadcrumb"
import { modeMeta, notFoundMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { AutoChessGuide } from "./auto-chess-guide"
import { GUIDE_TABS, readGuideTab, type GuideTab } from "./auto-chess-model"
import type { ModeImage } from "./auto-chess-model"
import { AutoChessOverview } from "./auto-chess-overview"
import { ModeBanner, ModeBannerSkeleton } from "./mode-banner"
import { WikiApiError } from "../../lib/wiki-api"
import { guideQuery, modeCardsQuery, modeQuery, type ModeContent } from "./mode-api"
import { ModeCards } from "./mode-cards"
import { durationText, hasSchedule, isOpen, ModeHeading, RuleList } from "./mode-ui"
import "./modes.css"
import "./mode-pages.css"

/**
 * One mode: the banner with its art and name, then what is recorded about it beside a framed panel of facts, then its
 * rules. A mode with a published guide keeps the guide's tabs right under the banner, so they stay in one place on
 * every tab.
 */
export function ModeDetailPage() {
  const { code = "", tab } = useParams()
  const location = useLocation()
  const { href, locale } = useWikiContext()
  const text = useWikiText()
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
      : mode.error instanceof WikiApiError && mode.error.status === 404
        ? notFoundMeta(locale, `/modes/${encodeURIComponent(code)}`, "modes")
        : null,
  )

  const listHref = href("/modes")
  if (mode.isPending) return <ModeDetailSkeleton wide={layout === "wide"} />
  if (mode.isError) {
    const missing = mode.error instanceof WikiApiError && mode.error.status === 404
    return (
      <div className="wiki-mode-page wiki-mode-detail">
        <div className="wiki-mode-notice wiki-mascot-state" role={missing ? "status" : "alert"}>
          <h1>
            {missing
              ? text("Chế độ này chưa có trên Wiki", "This mode is not on the Wiki yet")
              : text("Chưa tải được chế độ", "The mode could not be loaded")}
          </h1>
          {!missing && (
            <button type="button" className="wiki-mode-chip" onClick={() => mode.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          )}
          <Link to={listHref}>{text("Xem tất cả chế độ", "See all modes")}</Link>
        </div>
      </div>
    )
  }

  const { content, images } = mode.data
  const named = tab ? readGuideTab(tab) : null
  if (tab && (!hasGuide || !named)) return <Navigate to={href(`/modes/${encodeURIComponent(code)}`)} replace />
  if (named?.moved)
    return (
      <Navigate to={{ pathname: `/modes/${encodeURIComponent(code)}/${named.tab}`, search: location.search }} replace />
    )
  const activeTab: GuideTab = named?.tab ?? "overview"
  const art = content.artAssetId ? images[content.artAssetId] : null
  // A guide's rules repeat and extend the mode's, so the page shows one list: the longer one.
  const guideRules = guide.data?.content.rules ?? []
  const rules = guideRules.length > content.rules.length ? guideRules : content.rules

  return (
    <div className="wiki-mode-page wiki-mode-detail">
      {/* The compact header names the section and leads back to it, so only wide screens show the trail. */}
      {layout === "wide" && (
        <WikiBreadcrumb
          className="wiki-mode-breadcrumb"
          steps={[
            { label: text("Trang chủ", "Home"), to: href("/") },
            { label: text("Chế độ chơi", "Game modes"), to: listHref },
            { label: content.name },
          ]}
        />
      )}
      <ModeBanner content={content} art={art} wide={layout === "wide"} short={activeTab !== "overview"} />
      {hasGuide && <GuideTabs code={code} active={activeTab} />}

      {activeTab === "overview" ? (
        <div className="wiki-mode-overview">
          <section className="wiki-mode-intro" aria-label={text("Thông tin chế độ", "About this mode")}>
            <div className="wiki-mode-intro-body">
              {content.summary && <p className="wiki-mode-intro-lead">{content.summary}</p>}
              <MissingNote content={content} art={art} hasGuide={hasGuide} />
              {layout === "wide" && <Sources content={content} />}
            </div>
            <ModeFacts content={content} edition={guide.data?.content.edition} />
          </section>

          {guide.data && <AutoChessOverview guide={guide.data} code={code} />}
          {guide.isError && (
            <div className="wiki-mode-notice" role="alert">
              <p>{text("Chưa tải được cẩm nang.", "The guide could not be loaded.")}</p>
              <button type="button" className="wiki-mode-chip" onClick={() => guide.refetch()}>
                {text("Thử lại", "Retry")}
              </button>
            </div>
          )}

          {rules.length > 0 &&
            (hasGuide ? (
              <details className="wiki-mode-fold">
                <summary>
                  {text("Luật chơi đầy đủ", "Full rules")}
                  <WikiIcon name="chevron" size={20} />
                </summary>
                <RuleList rules={rules} collapsible={layout === "compact"} />
              </details>
            ) : (
              <section className="wiki-mode-section" aria-labelledby="wiki-mode-rules">
                <ModeHeading id="wiki-mode-rules" title={text("Luật chơi", "Rules")} />
                <RuleList rules={rules} collapsible={layout === "compact"} />
              </section>
            ))}

          {content.heroes.length > 0 && (
            <section className="wiki-mode-section" aria-labelledby="mode-heroes">
              <ModeHeading
                id="mode-heroes"
                title={text("Tướng của chế độ", "Heroes of this mode")}
                count={content.heroes.length}
              />
              <ul className="wiki-mode-hero-list">
                {content.heroes.map((hero) => (
                  <li key={hero.name}>
                    {hero.heroCode ? (
                      <Link to={href(`/hero/${hero.heroCode}`)}>{hero.name}</Link>
                    ) : (
                      <span>{hero.name}</span>
                    )}
                    {hero.note && <small>{hero.note}</small>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {content.specialItems.length > 0 && (
            <section className="wiki-mode-section" aria-labelledby="mode-items">
              <ModeHeading
                id="mode-items"
                title={text("Vật phẩm riêng", "Special items")}
                count={content.specialItems.length}
              />
              <ul className="wiki-mode-item-list">
                {content.specialItems.map((item) => {
                  const icon = item.iconAssetId ? images[item.iconAssetId] : null
                  return (
                    <li key={item.name}>
                      {icon ? <img src={icon.url} alt="" loading="lazy" /> : <span aria-hidden="true" />}
                      <div>
                        <h3>{item.name}</h3>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {layout === "compact" && <Sources content={content} />}
          {!hasGuide && <OtherModes code={code} group={content.group} />}
        </div>
      ) : guide.isPending ? (
        <GuideTabSkeleton />
      ) : guide.isError ? (
        <div className="wiki-mode-notice" role="alert">
          <p>{text("Chưa tải được cẩm nang.", "The guide could not be loaded.")}</p>
          <button type="button" className="wiki-mode-chip" onClick={() => guide.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : (
        <AutoChessGuide code={code} tab={activeTab} guide={guide.data} />
      )}
    </div>
  )
}

/** The guide's parts as one row of tabs under the mode's name; a narrow row scrolls sideways and never wraps. */
function GuideTabs({ code, active }: { code: string; active: GuideTab }) {
  const { href, locale } = useWikiContext()
  const row = useRef<HTMLElement>(null)
  // On a narrow row the open tab may sit past the edge: bring it into view without moving the page.
  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row.current || !current) return
    row.current.scrollLeft = current.offsetLeft - (row.current.clientWidth - current.offsetWidth) / 2
  }, [active])
  return (
    <nav ref={row} className="wiki-guide-tabs" aria-label={wikiText(locale, "Mục cẩm nang", "Guide sections")}>
      {GUIDE_TABS.map((item) => (
        <Link
          key={item.key}
          className="wiki-guide-tab"
          aria-current={active === item.key ? "page" : undefined}
          to={href(`/modes/${encodeURIComponent(code)}${item.key === "overview" ? "" : `/${item.key}`}`)}
          preventScrollReset
        >
          {wikiText(locale, item.label, item.english)}
        </Link>
      ))}
    </nav>
  )
}

/**
 * What else is recorded about the mode, on a quiet panel: when it was seen, when it is open, the guide's
 * edition and a note. The banner already shows the group, the length, the players and whether it is open. A fact that
 * is not recorded has no row: the note beside the panel names it once. Short facts pair up where they are cells; long
 * ones take a whole row there.
 */
function ModeFacts({ content, edition }: { content: ModeContent; edition?: string | null }) {
  const { locale } = useWikiContext()
  const text = useWikiText()
  const availability = content.availability
  // The schedule's days are calendar dates: they read as written, in the date format the reader chose.
  const day = (value: string) => <LocalTime value={value} locale={locale} />
  const short: [string, ReactNode][] = []
  if (availability?.observedOn) short.push([text("Ghi nhận", "Recorded"), day(availability.observedOn)])
  const long: [string, ReactNode][] = []
  const { startsOn, endsOn } = availability ?? {}
  if (startsOn && endsOn)
    long.push([
      text("Thời gian mở", "Open period"),
      <>
        {day(startsOn)} – {day(endsOn)}
      </>,
    ])
  else if (startsOn)
    long.push([
      text("Thời gian mở", "Open period"),
      <>
        {text("Từ", "From")} {day(startsOn)}
      </>,
    ])
  else if (endsOn)
    long.push([
      text("Thời gian mở", "Open period"),
      <>
        {text("Đến", "Until")} {day(endsOn)}
      </>,
    ])
  if (edition) long.push([text("Cẩm nang", "Guide"), edition])
  if (availability?.note) long.push([text("Ghi chú", "Note"), availability.note])
  if (!short.length && !long.length) return null
  return (
    <dl className="wiki-mode-facts">
      {[...short, ...long].map(([term, value], at) => (
        <div key={term} data-wide={at >= short.length || undefined}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One plain sentence naming everything the Wiki has not recorded for the mode yet. */
function MissingNote({ content, art, hasGuide }: { content: ModeContent; art?: ModeImage | null; hasGuide: boolean }) {
  const text = useWikiText()
  const parts = [
    !durationText(content.duration) && text("thời lượng trận", "match length"),
    !content.playersLabel && text("số người chơi", "player count"),
    !hasSchedule(content.availability) && text("lịch mở", "schedule"),
    !art && text("hình ảnh", "image"),
    !content.summary && text("phần giới thiệu", "introduction"),
    !content.rules.length && !hasGuide && text("luật chơi", "rules"),
  ].filter((part): part is string => !!part)
  if (!parts.length) return null
  const last = parts.pop()
  const list = (and: string) => (parts.length ? `${parts.join(", ")} ${and} ${last}` : last)
  return (
    <p className="wiki-mode-intro-note">
      {text(
        `Wiki chưa ghi nhận ${list("và")} của chế độ này.`,
        `The Wiki has not recorded this mode's ${list("or")} yet.`,
      )}
    </p>
  )
}

function Sources({ content }: { content: ModeContent }) {
  const { locale } = useWikiContext()
  if (!content.sources.length) return null
  return (
    <p className="wiki-mode-sources">
      {wikiText(locale, "Nguồn", "Sources")}: {content.sources.map((source) => source.label).join("; ")}.{" "}
      {wikiText(locale, "Hình ảnh: Garena / Liên Quân Mobile.", "Images: Garena / Arena of Valor.")}
    </p>
  )
}

/** A mode with little recorded still leads somewhere: four more modes of its group, the open ones first. */
function OtherModes({ code, group }: { code: string; group: ModeContent["group"] }) {
  const text = useWikiText()
  const modes = useQuery(modeCardsQuery())
  const peers = (modes.data?.items ?? []).filter((mode) => mode.group === group)
  const at = peers.findIndex((mode) => mode.code === code)
  // Starting after this mode and wrapping around gives every page different neighbours.
  const following = [...peers.slice(at + 1), ...peers.slice(0, Math.max(at, 0))]
  const others = [
    ...following.filter((mode) => isOpen(mode.availability)),
    ...following.filter((mode) => !isOpen(mode.availability)),
  ].slice(0, 4)
  if (!others.length) return null
  return (
    <section className="wiki-mode-section" aria-labelledby="mode-others">
      <ModeHeading
        id="mode-others"
        title={
          group === "PVP"
            ? text("Chế độ PVP khác", "Other PVP modes")
            : text("Chế độ giải trí khác", "Other casual modes")
        }
      />
      <ModeCards modes={others} />
    </section>
  )
}

/** A guide tab while the guide loads: a heading, the row of controls and a grid of entries, as most tabs are drawn. */
function GuideTabSkeleton() {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-guide-skeleton"
      role="status"
      aria-label={wikiText(locale, "Đang tải cẩm nang", "Loading the guide")}
    >
      <div className="wiki-mode-heading" data-skeleton="" />
      <span className="wiki-guide-skeleton-bar" />
      <div className="wiki-guide-skeleton-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  )
}

/** The loading state keeps the page's shape: the banner, then the lines of the introduction. */
function ModeDetailSkeleton({ wide }: { wide: boolean }) {
  const { locale } = useWikiContext()
  return (
    <div
      className="wiki-mode-page wiki-mode-detail"
      role="status"
      aria-label={wikiText(locale, "Đang tải chế độ", "Loading the mode")}
    >
      {wide && <div className="wiki-mode-skeleton-trail" />}
      <ModeBannerSkeleton wide={wide} />
      <div className="wiki-mode-intro" data-skeleton="true">
        <div className="wiki-mode-intro-body">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
