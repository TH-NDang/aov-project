import { useEffect, useMemo, useRef } from "react"
import { MODE_PARAMS, readParam, writeParam } from "../../lib/search-params"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiText } from "../../context/wiki-context"
import { modeCardsQuery, type ModeCard } from "./mode-api"
import { GROUP_NAMES, hasSchedule, isOpen, ModeHeading } from "./mode-ui"
import { foldSearchText } from "@aov/ui/lib/search-text"
import { scheduleNote } from "./mode-lead"
import { ModesStage, ModesStageSkeleton } from "./modes-stage"
import { ModesRail } from "./modes-rail"
import { ModesWall } from "./modes-wall"
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

/** The mode on the stage: the first one with a guide, else the first open one with art, else the first with art. */
function stageMode(modes: ModeCard[]) {
  return (
    modes.find((mode) => mode.hasGuide) ??
    modes.find((mode) => mode.art && isOpen(mode.availability)) ??
    modes.find((mode) => mode.art) ??
    modes[0]
  )
}

/**
 * Every published game mode: one mode on a stage, a row of the modes open now, then every mode on a wall of tiles by
 * the game's groups, which the search and the chips narrow. Phones get the same order in their own shapes: the stage
 * under the clear header, a row to swipe, and a wall two tiles wide.
 */
export function ModesPage() {
  const text = useWikiText()
  const wide = usePageLayout() === "wide"
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
  const staged = stageMode(all)
  // The row of open modes is a way in, not a result: it stands only while nothing narrows the list.
  const openNow =
    filter === "all" && !search ? all.filter((mode) => isOpen(mode.availability) && mode !== staged) : NO_MODES
  // A mode without a recorded schedule shows no status, so the page counts those once, in words.
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

  const filters = (
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
  )

  if (modes.isPending)
    return (
      <div
        className="wiki-mode-page wiki-mode-index"
        role="status"
        aria-label={text("Đang tải danh sách chế độ", "Loading the list of modes")}
      >
        <ModesStageSkeleton wide={wide} />
      </div>
    )

  return (
    <div className="wiki-mode-page wiki-mode-index">
      {staged && <ModesStage mode={staged} count={all.length} wide={wide} />}
      {openNow.length > 0 && <ModesRail modes={openNow} wide={wide} />}

      <section className="wiki-mode-group" aria-labelledby="modes-all-title">
        <ModeHeading id="modes-all-title" title={text("Tất cả chế độ", "Every mode")} count={visible.length} />
        {filters}
        {modes.isError ? (
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
          GROUPS.map((group) => {
            const entries = visible.filter((mode) => mode.group === group)
            if (!entries.length) return null
            return (
              <div key={group} className="wiki-modes-wall-group">
                <h3>
                  {text(GROUP_NAMES[group][0], GROUP_NAMES[group][1])}
                  <small>{entries.length}</small>
                </h3>
                <ModesWall modes={entries} />
              </div>
            )
          })
        )}
      </section>

      {visible.length > 0 && (
        <p className="wiki-mode-footnote">
          {unknownShown > 0 &&
            text(
              `${unknownShown} chế độ chưa rõ lịch mở. `,
              `${unknownShown} ${unknownShown === 1 ? "mode has" : "modes have"} no known schedule. `,
            )}
          {scheduleNote(text)}
        </p>
      )}
    </div>
  )
}
