import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { useWikiContext } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { foldText } from "./auto-chess-model"
import { modeCardsQuery, type ModeCard } from "./mode-api"
import { AvailabilityBadge, durationText, GROUP_LABEL, ModeArt } from "./mode-ui"
import "./modes.css"

type Filter = "all" | "PVP" | "ENTERTAINMENT" | "open" | "guide"

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "PVP", label: "PVP" },
  { key: "ENTERTAINMENT", label: "Giải trí" },
  { key: "open", label: "Đang mở" },
  { key: "guide", label: "Có cẩm nang" },
]

const OPEN = new Set(["ALWAYS_OPEN", "LIMITED", "SPECIAL"])

/** Every published game mode, grouped like the game's menu but searchable and filterable. */
export function ModesPage() {
  const { href } = useWikiContext()
  const [params, setParams] = useSearchParams()
  const filter = (FILTERS.find((item) => item.key === params.get("loc"))?.key ?? "all") as Filter
  const search = params.get("q") ?? ""
  const modes = useQuery(modeCardsQuery())

  const visible = useMemo(() => {
    const needle = foldText(search.trim())
    return (modes.data?.items ?? []).filter((mode) => {
      if (needle && !foldText(`${mode.name} ${mode.summary ?? ""}`).includes(needle)) return false
      if (filter === "PVP" || filter === "ENTERTAINMENT") return mode.group === filter
      if (filter === "open") return OPEN.has(mode.availability?.status ?? "")
      if (filter === "guide") return mode.hasGuide
      return true
    })
  }, [modes.data, filter, search])

  function update(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div className="mode-page">
      <CatalogHeading title="Chế độ chơi" section="Chế độ chơi" />
      <p className="mode-lead">
        Các chế độ trong Liên Quân Mobile: thời lượng một trận, tình trạng mở theo ảnh trong game, luật chơi và cẩm nang
        chi tiết. Tình trạng mở là dữ liệu quan sát, có thể đã thay đổi trong game.
      </p>
      <div className="mode-toolbar" role="group" aria-label="Lọc chế độ">
        <input
          className="mode-search"
          type="search"
          value={search}
          placeholder="Tìm chế độ…"
          aria-label="Tìm chế độ"
          onChange={(event) => update("q", event.target.value || null)}
        />
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="mode-chip"
            aria-pressed={filter === item.key}
            onClick={() => update("loc", item.key === "all" ? null : item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {modes.isPending ? (
        <p className="mode-empty">Đang tải danh sách chế độ…</p>
      ) : modes.isError ? (
        <p className="mode-empty">
          Chưa tải được danh sách chế độ.{" "}
          <button type="button" className="mode-chip" onClick={() => modes.refetch()}>
            Thử lại
          </button>
        </p>
      ) : visible.length === 0 ? (
        <p className="mode-empty">Không có chế độ nào khớp bộ lọc.</p>
      ) : (
        (["PVP", "ENTERTAINMENT"] as const).map((group) => {
          const entries = visible.filter((mode) => mode.group === group)
          if (!entries.length) return null
          return (
            <section key={group} className="mode-page" aria-labelledby={`mode-group-${group}`}>
              <h2 id={`mode-group-${group}`} className="mode-section-title">
                {GROUP_LABEL[group]} <small>{entries.length} chế độ</small>
              </h2>
              <div className="mode-grid">
                {entries.map((mode) => (
                  <ModeCardLink key={mode.code} mode={mode} to={href(`/modes/${encodeURIComponent(mode.code)}`)} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}

function ModeCardLink({ mode, to }: { mode: ModeCard; to: string }) {
  const duration = durationText(mode.duration)
  return (
    <Link className="mode-card" to={to}>
      <ModeArt className="mode-card-art" image={mode.art} name={mode.name} showCredit={false}>
        <span className="mode-badges">
          <AvailabilityBadge availability={mode.availability} />
          {mode.hasGuide && (
            <span className="mode-badge" data-tone="guide">
              Cẩm nang
            </span>
          )}
        </span>
      </ModeArt>
      <div className="mode-card-body">
        <h3>{mode.name}</h3>
        <p className="mode-meta">
          {duration && <span>{duration}</span>}
          {mode.playersLabel && <span>{mode.playersLabel}</span>}
        </p>
        {mode.summary && <p className="mode-meta">{mode.summary}</p>}
      </div>
    </Link>
  )
}
