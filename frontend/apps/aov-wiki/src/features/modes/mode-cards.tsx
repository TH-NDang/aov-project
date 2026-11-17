import type { CSSProperties } from "react"
import { Link } from "react-router"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { ModeCard } from "./mode-api"
import { AvailabilityState, durationText, isClosed, ModeArt } from "./mode-ui"

/**
 * How many cards go in a row when a row holds at most `max`: rows as even as possible, so a group fills its rows
 * and, wherever the count allows it, no card is left alone on the last one. A short group keeps two thirds of `max`
 * as columns, so its cards never grow much wider than in a full row.
 */
function balancedColumns(count: number, max: number) {
  const min = Math.ceil((max * 2) / 3)
  if (count <= max) return Math.max(count, min)
  const even = Math.ceil(count / Math.ceil(count / max))
  const options = [even, even - 1, even + 1, even - 2].filter((columns) => columns >= min && columns <= max)
  return options.find((columns) => count % columns !== 1) ?? even
}

/** Column counts of a card grid: up to six cards in a row on the full page column, up to four on a narrower one. */
function gridColumns(count: number) {
  return {
    "--mode-columns": balancedColumns(count, 6),
    "--mode-columns-narrow": balancedColumns(count, 4),
  } as CSSProperties
}

/** The match length in `locale` and the team size, the two facts a reader compares modes by. */
export function modeMetaText(mode: Pick<ModeCard, "duration" | "playersLabel">, locale: string) {
  return [durationText(mode.duration, locale), mode.playersLabel].filter(Boolean).join(" · ")
}

function ModeTags({ mode }: { mode: ModeCard }) {
  const { locale } = useWikiContext()
  return (
    <>
      <AvailabilityState availability={mode.availability} quiet />
      {mode.hasGuide && <span className="wiki-mode-tag">{wikiText(locale, "Cẩm nang", "Guide")}</span>}
    </>
  )
}

function ModeTile({ mode, to }: { mode: ModeCard; to: string }) {
  const { locale } = useWikiContext()
  const meta = modeMetaText(mode, locale)
  return (
    <Link className="wiki-mode-card" to={to} data-closed={isClosed(mode.availability) || undefined}>
      <ModeArt className="wiki-mode-card-art" image={mode.art} name={mode.name} inCard>
        <span className="wiki-mode-badges">
          <ModeTags mode={mode} />
        </span>
      </ModeArt>
      <div className="wiki-mode-card-body">
        <h3>{mode.name}</h3>
        {meta && <p>{meta}</p>}
      </div>
    </Link>
  )
}

/** Phones scan a list faster than a grid of tall cards: a small picture, the name, the length and the status. */
function ModeRow({ mode, to }: { mode: ModeCard; to: string }) {
  const { locale } = useWikiContext()
  const meta = modeMetaText(mode, locale)
  return (
    <Link className="wiki-mode-row" to={to} data-closed={isClosed(mode.availability) || undefined}>
      <ModeArt className="wiki-mode-row-art" image={mode.art} name={mode.name} inCard />
      <div className="wiki-mode-row-body">
        <h3>{mode.name}</h3>
        {meta && <p>{meta}</p>}
        <p className="wiki-mode-row-tags">
          <ModeTags mode={mode} />
        </p>
      </div>
    </Link>
  )
}

/** Modes as cards whose rows fill on wide screens and as a list of rows on phones. */
export function ModeCards({ modes }: { modes: ModeCard[] }) {
  const { href } = useWikiContext()
  const layout = usePageLayout()
  const link = (mode: ModeCard) => href(`/modes/${encodeURIComponent(mode.code)}`)
  if (layout === "compact")
    return (
      <ul className="wiki-mode-list">
        {modes.map((mode) => (
          <li key={mode.code}>
            <ModeRow mode={mode} to={link(mode)} />
          </li>
        ))}
      </ul>
    )
  return (
    <ul className="wiki-mode-grid" style={gridColumns(modes.length)}>
      {modes.map((mode) => (
        <li key={mode.code}>
          <ModeTile mode={mode} to={link(mode)} />
        </li>
      ))}
    </ul>
  )
}

/** The loading state of a group of modes: blank cards in the grid, or blank rows in the list, the modes will fill. */
export function ModeCardsSkeleton({ count }: { count: number }) {
  const layout = usePageLayout()
  const items = Array.from({ length: count }, (_, at) => at)
  if (layout === "compact")
    return (
      <ul className="wiki-mode-list" aria-hidden="true">
        {items.map((at) => (
          <li key={at} className="wiki-mode-row" data-skeleton="true" />
        ))}
      </ul>
    )
  return (
    <ul className="wiki-mode-grid" style={gridColumns(count)} aria-hidden="true">
      {items.map((at) => (
        <li key={at} className="wiki-mode-card" data-skeleton="true">
          <span className="wiki-mode-art wiki-mode-card-art" />
          <span className="wiki-mode-card-body" />
        </li>
      ))}
    </ul>
  )
}
