import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useSearchParams } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { CatalogHeading } from "../../layout/catalog-heading"
import { foldText } from "./auto-chess-model"
import { modeCardsQuery, type ModeCard } from "./mode-api"
import { AvailabilityBadge, durationText, GROUP_NAMES, isOpen, ModeArt } from "./mode-ui"
import "./modes.css"

type Filter = "all" | "PVP" | "ENTERTAINMENT" | "open" | "guide"

const FILTERS: { key: Filter; label: string; english: string }[] = [
  { key: "all", label: "Tất cả", english: "All" },
  { key: "open", label: "Đang mở", english: "Open" },
  { key: "PVP", label: "PVP", english: "PVP" },
  { key: "ENTERTAINMENT", label: "Giải trí", english: "Casual" },
  { key: "guide", label: "Có cẩm nang", english: "Has a guide" },
]

/** Every published game mode: a guide first, then the game's groups, as a grid on wide screens and a list on phones. */
export function ModesPage() {
  const { href, locale, t } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
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
  const guides = filter === "all" && !search ? all.filter((mode) => mode.hasGuide) : []
  const openCount = all.filter((mode) => isOpen(mode.availability)).length

  function update(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  }
  const link = (mode: ModeCard) => href(`/modes/${encodeURIComponent(mode.code)}`)

  return (
    <div className="mode-page">
      <CatalogHeading title={t("modes")} section={t("modes")} />
      {layout === "wide" && (
        <p className="mode-lead">
          {all.length
            ? text(
                `${all.length} chế độ, ${openCount} đang mở. `,
                `${all.length} ${all.length === 1 ? "mode" : "modes"}, ${openCount} open. `,
              )
            : ""}
          {text(
            "Thời lượng một trận, lịch mở, luật chơi và cẩm nang chi tiết. Lịch mở là dữ liệu ghi nhận trong game nên có thể đã thay đổi.",
            "Match length, opening schedule, rules and detailed guides. The opening schedule is data recorded in the game, so it may have changed.",
          )}
        </p>
      )}
      <div className="mode-filter-bar" role="group" aria-label={text("Lọc chế độ", "Filter modes")}>
        <input
          className="mode-search"
          type="search"
          value={search}
          placeholder={text("Tìm chế độ…", "Search modes…")}
          aria-label={text("Tìm chế độ", "Search modes")}
          onChange={(event) => update("q", event.target.value || null)}
        />
        <div className="mode-chip-row">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="mode-chip"
              aria-pressed={filter === item.key}
              onClick={() => update("loc", item.key === "all" ? null : item.key)}
            >
              {text(item.label, item.english)}
            </button>
          ))}
        </div>
      </div>

      {modes.isPending ? (
        <p className="mode-empty">{text("Đang tải danh sách chế độ…", "Loading the list of modes…")}</p>
      ) : modes.isError ? (
        <p className="mode-empty">
          {text("Chưa tải được danh sách chế độ.", "The list of modes could not be loaded.")}{" "}
          <button type="button" className="mode-chip" onClick={() => modes.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </p>
      ) : visible.length === 0 ? (
        <p className="mode-empty">{text("Không có chế độ nào khớp bộ lọc.", "No modes match the filters.")}</p>
      ) : (
        <>
          {guides.map((mode) => (
            <GuideSpotlight key={mode.code} mode={mode} to={link(mode)} />
          ))}
          {(["PVP", "ENTERTAINMENT"] as const).map((group) => {
            const entries = visible.filter((mode) => mode.group === group)
            if (!entries.length) return null
            return (
              <section key={group} className="mode-group" aria-labelledby={`mode-group-${group}`}>
                <h2 id={`mode-group-${group}`} className="mode-section-title">
                  {text(GROUP_NAMES[group][0], GROUP_NAMES[group][1])}{" "}
                  <small>
                    {entries.length} {text("chế độ", entries.length === 1 ? "mode" : "modes")}
                  </small>
                </h2>
                {layout === "compact" ? (
                  <ul className="mode-list">
                    {entries.map((mode) => (
                      <li key={mode.code}>
                        <ModeRow mode={mode} to={link(mode)} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mode-grid">
                    {entries.map((mode) => (
                      <ModeTile key={mode.code} mode={mode} to={link(mode)} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function ModeMeta({ mode }: { mode: ModeCard }) {
  const { locale } = useWikiContext()
  const duration = durationText(mode.duration, locale)
  if (!duration && !mode.playersLabel) return null
  return (
    <p className="mode-meta">
      {duration && <span>{duration}</span>}
      {mode.playersLabel && <span>{mode.playersLabel}</span>}
    </p>
  )
}

/** A mode with a guide gets the first, widest place: it is where most of the reading happens. */
function GuideSpotlight({ mode, to }: { mode: ModeCard; to: string }) {
  const { href, locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const tab = (key: string) => href(`/modes/${encodeURIComponent(mode.code)}/${key}`)
  return (
    <article className="mode-spotlight">
      <ModeArt className="mode-spotlight-art" image={mode.art} name={mode.name} showCredit={false} eager />
      <div className="mode-spotlight-body">
        <span className="mode-eyebrow">{text("Cẩm nang", "Guide")}</span>
        <h2>
          <Link to={to}>{mode.name}</Link>
        </h2>
        <ModeMeta mode={mode} />
        {mode.summary && <p className="mode-prose mode-clamp">{mode.summary}</p>}
        {mode.guideKind === "AUTO_CHESS" && (
          <nav
            className="mode-chip-row"
            aria-label={text(`Mục trong cẩm nang ${mode.name}`, `Sections of the ${mode.name} guide`)}
          >
            <Link className="mode-chip" data-tone="accent" to={to}>
              {text("Mở cẩm nang", "Open the guide")}
            </Link>
            <Link className="mode-chip" to={tab("quan-co")}>
              {text("Quân cờ", "Units")}
            </Link>
            <Link className="mode-chip" to={tab("phe-nghe")}>
              {text("Phe & Nghề", "Factions & Classes")}
            </Link>
            <Link className="mode-chip" to={tab("xep-doi-hinh")}>
              {text("Xếp đội hình", "Lineup builder")}
            </Link>
          </nav>
        )}
      </div>
    </article>
  )
}

function ModeTile({ mode, to }: { mode: ModeCard; to: string }) {
  const { locale } = useWikiContext()
  return (
    <Link className="mode-card" to={to} data-closed={!isOpen(mode.availability) || undefined}>
      <ModeArt className="mode-card-art" image={mode.art} name={mode.name} showCredit={false}>
        <span className="mode-badges">
          <AvailabilityBadge availability={mode.availability} quiet />
          {mode.hasGuide && (
            <span className="mode-badge" data-tone="guide">
              {wikiText(locale, "Cẩm nang", "Guide")}
            </span>
          )}
        </span>
      </ModeArt>
      <div className="mode-card-body">
        <h3>{mode.name}</h3>
        <ModeMeta mode={mode} />
        {mode.summary && <p className="mode-meta mode-clamp">{mode.summary}</p>}
      </div>
    </Link>
  )
}

/** Phones scan a list faster than a grid of tall cards: a small picture, the name, the length and the status. */
function ModeRow({ mode, to }: { mode: ModeCard; to: string }) {
  const { locale } = useWikiContext()
  return (
    <Link className="mode-row" to={to} data-closed={!isOpen(mode.availability) || undefined}>
      <ModeArt className="mode-row-art" image={mode.art} name={mode.name} showCredit={false} />
      <span className="mode-row-body">
        <strong>{mode.name}</strong>
        <ModeMeta mode={mode} />
        <span className="mode-badges">
          <AvailabilityBadge availability={mode.availability} quiet />
          {mode.hasGuide && (
            <span className="mode-badge" data-tone="guide">
              {wikiText(locale, "Cẩm nang", "Guide")}
            </span>
          )}
        </span>
      </span>
      <span className="mode-row-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  )
}
