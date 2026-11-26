import type { CSSProperties, ReactNode } from "react"
import { CatalogShowcase } from "../../components/catalog-showcase"
import { useWikiText } from "../../context/wiki-context"
import type { ModeCard } from "./mode-api"
import { isClosed, isOpen } from "./mode-ui"
import "./modes-showcase.css"

/** How many panels stand in the lobby on each layout. */
const PANELS = { wide: 6, compact: 4 } as const

/**
 * The head of the game modes: the title and the count over the game's mode lobby, a row of tall slanted panels each
 * showing one mode's art, the guide first, then the open modes. Closed modes never stand in it. While the list loads,
 * or when no mode has art, the head has its text only.
 */
export function ModesShowcase({ modes, wide, note }: { modes: readonly ModeCard[]; wide: boolean; note?: ReactNode }) {
  const text = useWikiText()
  const open = modes.filter((mode) => isOpen(mode.availability)).length
  const shown = [...modes]
    .filter((mode) => mode.art && !isClosed(mode.availability))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, wide ? PANELS.wide : PANELS.compact)
  const count = modes.length
  return (
    <CatalogShowcase
      title={text("Chế độ chơi", "Game modes")}
      count={count ? text(`${count} chế độ`, count === 1 ? "1 mode" : `${count} modes`) : undefined}
      corner={open > 0 && <span className="wiki-modes-open-count">{text(`${open} đang mở`, `${open} open`)}</span>}
      wide={wide}
      note={note}
      scene={
        shown.length > 0 && (
          <div className="wiki-modes-lobby">
            {shown.map((mode, index) => (
              <span key={mode.code} className="wiki-modes-lobby-panel" style={{ "--panel-at": index } as CSSProperties}>
                <img
                  src={mode.art!.url}
                  alt=""
                  loading="eager"
                  decoding="async"
                  style={
                    mode.art!.focalPoint
                      ? {
                          objectPosition: `${mode.art!.focalPoint.x * 100}% ${mode.art!.focalPoint.y * 100}%`,
                        }
                      : undefined
                  }
                />
              </span>
            ))}
          </div>
        )
      }
    />
  )
}

/** The guide leads the lobby, then whatever can be played now; the rest keep the game's order. */
function rank(mode: ModeCard) {
  if (mode.hasGuide) return 0
  return isOpen(mode.availability) ? 1 : 2
}
