import { useEffect, useRef, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, Navigate, useParams } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { modeMeta, notFoundMeta } from "../../lib/seo/page-meta"
import { usePageHead } from "../../lib/seo/use-page-head"
import { AutoChessGuide, GUIDE_TABS, type GuideTab } from "./auto-chess-guide"
import type { ModeImage } from "./auto-chess-model"
import { AutoChessOverview } from "./auto-chess-overview"
import { guideQuery, modeCardsQuery, modeQuery, ModeRequestError, type ModeContent } from "./mode-api"
import { ModeCards } from "./mode-cards"
import {
  AvailabilityState,
  durationText,
  GROUP_LABEL,
  hasSchedule,
  isOpen,
  ModeArt,
  ModeHeading,
  RuleList,
} from "./mode-ui"
import "./modes.css"
import "./mode-pages.css"

/**
 * One mode: its name, then the art beside what is recorded about it, then its rules. A mode with a published guide
 * keeps the guide's tabs right under the name, so they stay in one place on every tab.
 */
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

  const listHref = href("/modes")
  if (mode.isPending) return <ModeDetailSkeleton />
  if (mode.isError) {
    const missing = mode.error instanceof ModeRequestError && mode.error.status === 404
    return (
      <div className="mode-page mode-detail">
        <div className="mode-notice wiki-mascot-state" role={missing ? "status" : "alert"}>
          <h1>{missing ? "Chế độ này chưa có trên Wiki" : "Chưa tải được chế độ"}</h1>
          {!missing && (
            <button type="button" className="mode-chip" onClick={() => mode.refetch()}>
              Thử lại
            </button>
          )}
          <Link to={listHref}>Xem tất cả chế độ</Link>
        </div>
      </div>
    )
  }

  const { content, images } = mode.data
  const known = GUIDE_TABS.some((item) => item.key === tab)
  if (tab && (!hasGuide || !known)) return <Navigate to={href(`/modes/${encodeURIComponent(code)}`)} replace />
  const activeTab = (tab ?? "tong-quan") as GuideTab
  const art = content.artAssetId ? images[content.artAssetId] : null
  // A guide's rules repeat and extend the mode's, so the page shows one list: the longer one.
  const guideRules = guide.data?.content.rules ?? []
  const rules = guideRules.length > content.rules.length ? guideRules : content.rules

  return (
    <div className="mode-page mode-detail">
      <CatalogHeading title={content.name} back={{ to: listHref, label: "Chế độ chơi" }} />
      {/* The compact header names the section only, so the page carries the way back and the mode's name itself. */}
      {layout === "compact" && (
        <header className="mode-compact-head">
          <Link className="mode-back" to={listHref}>
            <WikiIcon name="chevronLeft" size={16} />
            Tất cả chế độ
          </Link>
          <h1>{content.name}</h1>
        </header>
      )}
      {hasGuide && <GuideTabs code={code} active={activeTab} />}

      {activeTab === "tong-quan" ? (
        <div className="mode-overview">
          <section className="mode-intro" data-art={art ? "" : undefined} aria-label="Thông tin chế độ">
            {art && <ModeArt className="mode-intro-art" image={art} name={content.name} eager />}
            <div className="mode-intro-body">
              {content.summary && <p className="mode-intro-lead">{content.summary}</p>}
              <ModeFacts content={content} edition={guide.data?.content.edition} />
              <MissingNote content={content} art={art} hasGuide={hasGuide} />
              {layout === "wide" && <Sources content={content} />}
            </div>
          </section>

          {guide.data && <AutoChessOverview guide={guide.data} code={code} />}
          {guide.isError && (
            <div className="mode-notice" role="alert">
              <p>Chưa tải được cẩm nang.</p>
              <button type="button" className="mode-chip" onClick={() => guide.refetch()}>
                Thử lại
              </button>
            </div>
          )}

          {rules.length > 0 &&
            (hasGuide ? (
              <details className="mode-fold">
                <summary>
                  Luật chơi đầy đủ
                  <WikiIcon name="chevron" size={20} />
                </summary>
                <RuleList rules={rules} collapsible={layout === "compact"} />
              </details>
            ) : (
              <section className="mode-section" aria-labelledby="mode-rules">
                <ModeHeading id="mode-rules" title="Luật chơi" />
                <RuleList rules={rules} collapsible={layout === "compact"} />
              </section>
            ))}

          {content.heroes.length > 0 && (
            <section className="mode-section" aria-labelledby="mode-heroes">
              <ModeHeading id="mode-heroes" title="Tướng của chế độ" count={content.heroes.length} />
              <ul className="mode-hero-list">
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
            <section className="mode-section" aria-labelledby="mode-items">
              <ModeHeading id="mode-items" title="Vật phẩm riêng" count={content.specialItems.length} />
              <ul className="mode-item-list">
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
        <div className="mode-notice" role="alert">
          <p>Chưa tải được cẩm nang.</p>
          <button type="button" className="mode-chip" onClick={() => guide.refetch()}>
            Thử lại
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
  const { href } = useWikiContext()
  const row = useRef<HTMLElement>(null)
  // On a narrow row the open tab may sit past the edge: bring it into view without moving the page.
  useEffect(() => {
    const current = row.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row.current || !current) return
    row.current.scrollLeft = current.offsetLeft - (row.current.clientWidth - current.offsetWidth) / 2
  }, [active])
  return (
    <nav ref={row} className="guide-tabs" aria-label="Mục cẩm nang">
      {GUIDE_TABS.map((item) => (
        <Link
          key={item.key}
          className="guide-tab"
          aria-current={active === item.key ? "page" : undefined}
          to={href(`/modes/${encodeURIComponent(code)}${item.key === "tong-quan" ? "" : `/${item.key}`}`)}
          preventScrollReset
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * What is recorded about the mode. A fact that is not recorded has no row: the note under the facts names it once.
 * The short facts pair up where they are shown as cells; the long ones, added last, take a whole row there.
 */
function ModeFacts({ content, edition }: { content: ModeContent; edition?: string | null }) {
  const { locale } = useWikiContext()
  const duration = durationText(content.duration)
  const availability = content.availability
  // The schedule's days are calendar dates: they read as written, in the date format the reader chose.
  const day = (value: string) => <LocalTime value={value} locale={locale} />
  const short: [string, ReactNode][] = [["Nhóm", GROUP_LABEL[content.group]]]
  if (duration) short.push(["Thời lượng", `${duration} / trận`])
  if (content.playersLabel) short.push(["Số người", content.playersLabel])
  if (hasSchedule(availability)) short.push(["Tình trạng", <AvailabilityState availability={availability} />])
  if (availability?.observedOn) short.push(["Ghi nhận", day(availability.observedOn)])
  const long: [string, ReactNode][] = []
  const { startsOn, endsOn } = availability ?? {}
  if (startsOn && endsOn)
    long.push([
      "Thời gian mở",
      <>
        {day(startsOn)} – {day(endsOn)}
      </>,
    ])
  else if (startsOn) long.push(["Thời gian mở", <>Từ {day(startsOn)}</>])
  else if (endsOn) long.push(["Thời gian mở", <>Đến {day(endsOn)}</>])
  if (edition) long.push(["Cẩm nang", edition])
  if (availability?.note) long.push(["Ghi chú", availability.note])
  return (
    <dl className="mode-facts">
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
  const parts = [
    !durationText(content.duration) && "thời lượng trận",
    !content.playersLabel && "số người chơi",
    !hasSchedule(content.availability) && "lịch mở",
    !art && "hình ảnh",
    !content.summary && "phần giới thiệu",
    !content.rules.length && !hasGuide && "luật chơi",
  ].filter((part): part is string => !!part)
  if (!parts.length) return null
  const last = parts.pop()
  return (
    <p className="mode-intro-note">
      Wiki chưa ghi nhận {parts.length ? `${parts.join(", ")} và ${last}` : last} của chế độ này.
    </p>
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

/** A mode with little recorded still leads somewhere: four more modes of its group, the open ones first. */
function OtherModes({ code, group }: { code: string; group: ModeContent["group"] }) {
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
    <section className="mode-section" aria-labelledby="mode-others">
      <ModeHeading id="mode-others" title={group === "PVP" ? "Chế độ PVP khác" : "Chế độ giải trí khác"} />
      <ModeCards modes={others} />
    </section>
  )
}

/** A guide tab while the guide loads: a heading, the row of controls and a grid of entries, as most tabs are drawn. */
function GuideTabSkeleton() {
  return (
    <div className="guide-skeleton" role="status" aria-label="Đang tải cẩm nang">
      <div className="mode-heading" data-skeleton="" />
      <span className="guide-skeleton-bar" />
      <div className="guide-skeleton-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  )
}

/** The loading state keeps the page's shape: the name, then the art beside the facts. */
function ModeDetailSkeleton() {
  return (
    <div className="mode-page mode-detail" role="status" aria-label="Đang tải chế độ">
      <div className="mode-skeleton-title" />
      <div className="mode-intro" data-art="" data-skeleton="true">
        <span className="mode-art mode-intro-art" />
        <div className="mode-intro-body">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
