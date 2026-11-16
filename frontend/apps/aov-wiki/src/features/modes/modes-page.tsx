import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { foldText } from "./auto-chess-model"
import { modeCardsQuery, type ModeCard } from "./mode-api"
import { ModeCards, ModeCardsSkeleton, modeMetaText } from "./mode-cards"
import { AvailabilityState, GROUP_LABEL, hasSchedule, isOpen, ModeArt, ModeHeading } from "./mode-ui"
import "./modes.css"
import "./mode-pages.css"

type Filter = "all" | "PVP" | "ENTERTAINMENT" | "open" | "guide"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Đang mở" },
  { key: "PVP", label: "PVP" },
  { key: "ENTERTAINMENT", label: "Giải trí" },
  { key: "guide", label: "Có cẩm nang" },
]

const GROUPS = ["PVP", "ENTERTAINMENT"] as const

/** The schedule is what the game's lobby showed when it was recorded, so the page says so once. */
const SCHEDULE_NOTE = "Lịch mở ghi theo sảnh chọn chế độ, có thể đã đổi."

/** Every published game mode: a guide first, then the game's groups, as a grid on wide screens and a list on phones. */
export function ModesPage() {
  const layout = usePageLayout()
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.find((item) => item.key === params.get("loc"))?.key ?? "all") as Filter
  const search = params.get("q") ?? ""
  const modes = useQuery(modeCardsQuery())
  const all = modes.data?.items ?? []

  const visible = useMemo(() => {
    const needle = foldText(search.trim())
    return all.filter((mode) => {
      if (needle && !foldText(`${mode.name} ${mode.summary ?? ""}`).includes(needle)) return false
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
  const counts = [
    `${all.length} chế độ`,
    `${openCount} đang mở`,
    ...(unknownCount ? [`${unknownCount} chưa rõ lịch mở`] : []),
  ].join(", ")

  function update(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }

  return (
    <div className="mode-page mode-index">
      <div className="mode-index-head">
        <CatalogHeading title="Chế độ chơi" lead={all.length ? `${counts}. ${SCHEDULE_NOTE}` : SCHEDULE_NOTE} />
        <div className="mode-filter-bar" role="group" aria-label="Lọc chế độ">
          <div className="mode-find">
            <label>
              <WikiIcon name="search" size={18} />
              <input
                type="search"
                value={search}
                placeholder="Tìm chế độ…"
                aria-label="Tìm chế độ"
                onChange={(event) => update({ q: event.target.value || null })}
              />
            </label>
            {search && (
              <button type="button" aria-label="Xóa từ khóa" onClick={() => update({ q: null })}>
                <WikiIcon name="close" size={16} />
              </button>
            )}
          </div>
          <div ref={chips} className="mode-chip-row">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                className="mode-chip"
                aria-pressed={filter === item.key}
                onClick={() => update({ loc: item.key === "all" ? null : item.key })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {modes.isPending ? (
        <div className="mode-index-loading" role="status" aria-label="Đang tải danh sách chế độ">
          <div className="mode-feature" data-skeleton="true" />
          {[6, 10].map((count) => (
            <div key={count} className="mode-group">
              <div className="mode-heading" data-skeleton="true" />
              <ModeCardsSkeleton count={count} />
            </div>
          ))}
        </div>
      ) : modes.isError ? (
        <div className="mode-notice wiki-mascot-state" role="alert">
          <h2>Chưa tải được danh sách chế độ</h2>
          <button type="button" className="mode-chip" onClick={() => modes.refetch()}>
            Thử lại
          </button>
        </div>
      ) : all.length === 0 ? (
        <p className="mode-notice wiki-mascot-state" role="status">
          Chưa có chế độ nào được công bố.
        </p>
      ) : visible.length === 0 ? (
        <div className="mode-notice wiki-mascot-state" role="status">
          <h2>Không có chế độ nào khớp</h2>
          <p>Thử từ khóa khác hoặc bỏ bộ lọc đang chọn.</p>
          <button type="button" className="mode-chip" onClick={() => update({ q: null, loc: null })}>
            Xóa bộ lọc
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
              <section key={group} className="mode-group" aria-labelledby={`mode-group-${group}`}>
                <ModeHeading id={`mode-group-${group}`} title={GROUP_LABEL[group]} count={entries.length} />
                <ModeCards modes={entries} />
              </section>
            )
          })}
          {/* Wide screens read this under the page title; phones have no title block, so it closes the list. */}
          {layout === "compact" && (
            <p className="mode-footnote">
              {unknownShown > 0 && `${unknownShown} chế độ chưa rõ lịch mở. `}
              {SCHEDULE_NOTE}
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
  const { href } = useWikiContext()
  const base = `/modes/${encodeURIComponent(mode.code)}`
  const meta = modeMetaText(mode)
  return (
    <article className="mode-feature">
      <ModeArt className="mode-feature-art" image={mode.art} name={mode.name} inCard eager />
      <div className="mode-feature-body">
        <p className="mode-feature-kicker">Cẩm nang</p>
        <h2>{mode.name}</h2>
        <p className="mode-feature-meta">
          {meta && <span>{meta}</span>}
          <AvailabilityState availability={mode.availability} quiet />
        </p>
        {mode.summary && <p className="mode-prose mode-clamp">{mode.summary}</p>}
        <nav className="mode-chip-row" aria-label={`Cẩm nang ${mode.name}`}>
          <Link className="mode-cta" to={href(base)}>
            Mở cẩm nang
            <WikiIcon name="arrow" size={16} />
          </Link>
          {mode.guideKind === "AUTO_CHESS" && (
            <>
              <Link className="mode-chip" to={href(`${base}/quan-co`)}>
                Quân cờ
              </Link>
              <Link className="mode-chip" to={href(`${base}/phe-nghe`)}>
                Phe & Nghề
              </Link>
              <Link className="mode-chip" to={href(`${base}/doi-hinh`)}>
                Đội hình
              </Link>
              <Link className="mode-chip" to={href(`${base}/xep-doi-hinh`)}>
                Xếp đội hình
              </Link>
            </>
          )}
        </nav>
      </div>
    </article>
  )
}
