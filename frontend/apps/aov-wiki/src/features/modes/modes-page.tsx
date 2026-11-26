import { useEffect, useMemo, useRef } from "react"
import { MODE_PARAMS, readParam, writeParam } from "../../lib/search-params"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { modeCardsQuery, type ModeCard } from "./mode-api"
import { ModeCards, ModeCardsSkeleton, modeMetaText } from "./mode-cards"
import { AvailabilityState, GROUP_NAMES, hasSchedule, isOpen, ModeArt, ModeHeading } from "./mode-ui"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { modesLead, scheduleNote } from "./mode-lead"
import "./modes.css"
import "./mode-pages.css"
import { PageSearch } from "../../components/page-search"

type Filter = "all" | "PVP" | "ENTERTAINMENT" | "open" | "guide"

const FILTERS: { key: Filter; label: string; english: string }[] = [
  { key: "all", label: "Tất cả", english: "All" },
  { key: "open", label: "Đang mở", english: "Open" },
  { key: "PVP", label: "PVP", english: "PVP" },
  { key: "ENTERTAINMENT", label: "Giải trí", english: "Casual" },
  { key: "guide", label: "Có cẩm nang", english: "Has a guide" },
]

const GROUPS = ["PVP", "ENTERTAINMENT"] as const
/** The modes until they load; one array, so the filtered list is not worked out again on every render. */
const NO_MODES: ModeCard[] = []

/** Every published game mode: a guide first, then the game's groups, as a grid on wide screens and a list on phones. */
export function ModesPage() {
  const text = useWikiText()
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.find((item) => item.key === readParam(params, MODE_PARAMS.filter))?.key ?? "all") as Filter
  const search = readParam(params, MODE_PARAMS.search) ?? ""
  const modes = useQuery(modeCardsQuery())
  const all = modes.data?.items ?? NO_MODES

  const visible = useMemo(() => {
    const needle = foldSearchText(search.trim())
    return all.filter((mode) => {
      if (needle && !foldSearchText(`${mode.name} ${mode.summary ?? ""}`).includes(needle)) return false
      if (filter === "PVP" || filter === "ENTERTAINMENT") return mode.group === filter
      if (filter === "open") return isOpen(mode.availability)
      if (filter === "guide") return mode.hasGuide
      return true
    })
  }, [all, filter, search])
  // A guide takes the wide place at the top of the whole list, and is the whole answer when guides are asked for.
  const features = filter === "guide" ? visible : filter === "all" && !search ? all.filter((mode) => mode.hasGuide) : []
  const listed = filter === "guide" ? [] : visible
  // A mode without a recorded schedule shows no status on its card, so the page counts those once, in words.
  const openCount = all.filter((mode) => isOpen(mode.availability)).length
  const unknownCount = all.filter((mode) => !hasSchedule(mode.availability)).length
  // The phone's note closes the list, so it counts the modes the list shows.
  const unknownShown = visible.filter((mode) => !hasSchedule(mode.availability)).length
  const chips = useRef<HTMLDivElement>(null)
  // On a narrow row the chosen chip may sit past the edge: bring it into view without moving the page.
  useEffect(() => {
    const row = chips.current
    const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chosen) return
    const box = row.getBoundingClientRect()
    const chip = chosen.getBoundingClientRect()
    row.scrollLeft += chip.left - box.left - (box.width - chip.width) / 2
  }, [filter])
  const counts = !all.length
    ? ""
    : [
        text(`${all.length} chế độ`, `${all.length} ${all.length === 1 ? "mode" : "modes"}`),
        text(`${openCount} đang mở`, `${openCount} open`),
        ...(unknownCount ? [text(`${unknownCount} chưa rõ lịch mở`, `${unknownCount} with schedule unknown`)] : []),
      ].join(", ")

  function update(changes: Partial<Record<"search" | "filter", string | null>>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes))
          writeParam(next, MODE_PARAMS[key as "search" | "filter"], value)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  return (
    <div className="wiki-mode-page wiki-mode-index">
      <div className="wiki-mode-index-head">
        <CatalogHeading title={text("Chế độ chơi", "Game modes")} lead={modesLead(text, counts)} />
        <div className="wiki-mode-filter-bar" role="group" aria-label={text("Lọc chế độ", "Filter modes")}>
          <PageSearch
            value={search}
            onChange={(value) => update({ search: value || null })}
            className="wiki-mode-find"
            label={text("Tìm chế độ", "Search modes")}
            placeholder={text("Tìm chế độ…", "Search modes…")}
          />
          <div ref={chips} className="wiki-mode-chip-row">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="wiki-mode-chip"
                aria-pressed={filter === item.key}
                onClick={() => update({ filter: item.key === "all" ? null : item.key })}
              >
                {text(item.label, item.english)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modes.isPending ? (
        <div
          className="wiki-mode-index-loading"
          role="status"
          aria-label={text("Đang tải danh sách chế độ", "Loading the list of modes")}
        >
          <div className="wiki-mode-feature" data-skeleton="true" />
          {[6, 10].map((count) => (
            <div key={count} className="wiki-mode-group">
              <div className="wiki-mode-heading" data-skeleton="true" />
              <ModeCardsSkeleton count={count} />
            </div>
          ))}
        </div>
      ) : modes.isError ? (
        <div className="wiki-mode-notice wiki-mascot-state" role="alert">
          <h2>{text("Chưa tải được danh sách chế độ", "The list of modes could not be loaded")}</h2>
          <button type="button" className="wiki-mode-chip" onClick={() => modes.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : all.length === 0 ? (
        <p className="wiki-mode-notice wiki-mascot-state" role="status">
          {text("Chưa có chế độ nào.", "No modes yet.")}
        </p>
      ) : visible.length === 0 ? (
        <div className="wiki-mode-notice wiki-mascot-state" role="status">
          <h2>{text("Không có chế độ nào khớp", "No mode matches")}</h2>
          <p>{text("Thử từ khóa khác hoặc bỏ bộ lọc đang chọn.", "Try other words or clear the filters.")}</p>
          <button type="button" className="wiki-mode-chip" onClick={() => update({ search: null, filter: null })}>
            {text("Xóa bộ lọc", "Clear filters")}
          </button>
        </div>
      ) : (
        <>
          {features.map((mode) => (
            <GuideFeature key={mode.code} mode={mode} />
          ))}
          {GROUPS.map((group) => {
            const entries = listed.filter((mode) => mode.group === group)
            if (!entries.length) return null
            return (
              <section key={group} className="wiki-mode-group" aria-labelledby={`mode-group-${group}`}>
                <ModeHeading
                  id={`mode-group-${group}`}
                  title={text(GROUP_NAMES[group][0], GROUP_NAMES[group][1])}
                  count={entries.length}
                />
                <ModeCards modes={entries} />
              </section>
            )
          })}
          {/* Wide screens read this under the page title; phones have no title block, so it closes the list. */}
          {layout === "compact" && (
            <p className="wiki-mode-footnote">
              {unknownShown > 0 &&
                text(`${unknownShown} chế độ chưa rõ lịch mở. `, `${unknownShown} modes have no known schedule. `)}
              {scheduleNote(text)}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * A mode with a guide gets the first, widest place: it is where most of the reading happens. The whole surface opens
 * the guide; the chips lead straight to its most used parts.
 */
function GuideFeature({ mode }: { mode: ModeCard }) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const base = `/modes/${encodeURIComponent(mode.code)}`
  const meta = modeMetaText(mode, locale)
  return (
    <article className="wiki-mode-feature">
      <ModeArt className="wiki-mode-feature-art" image={mode.art} name={mode.name} inCard eager />
      <div className="wiki-mode-feature-body">
        <p className="wiki-mode-feature-kicker">{text("Cẩm nang", "Guide")}</p>
        <h2>{mode.name}</h2>
        <p className="wiki-mode-feature-meta">
          {meta && <span>{meta}</span>}
          <AvailabilityState availability={mode.availability} quiet />
        </p>
        {mode.summary && <p className="wiki-mode-prose wiki-mode-clamp">{mode.summary}</p>}
        <nav className="wiki-mode-chip-row" aria-label={text(`Cẩm nang ${mode.name}`, `${mode.name} guide`)}>
          <Link className="wiki-mode-cta" to={href(base)}>
            {text("Mở cẩm nang", "Open the guide")}
            <WikiIcon name="arrow" size={16} />
          </Link>
          {mode.guideKind === "AUTO_CHESS" && (
            <>
              <Link className="wiki-mode-chip" to={href(`${base}/units`)}>
                {text("Quân cờ", "Units")}
              </Link>
              <Link className="wiki-mode-chip" to={href(`${base}/traits`)}>
                {text("Phe & Nghề", "Factions & Classes")}
              </Link>
              <Link className="wiki-mode-chip" to={href(`${base}/lineups`)}>
                {text("Đội hình", "Lineups")}
              </Link>
              <Link className="wiki-mode-chip" to={href(`${base}/builder`)}>
                {text("Xếp đội hình", "Lineup builder")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </article>
  )
}
