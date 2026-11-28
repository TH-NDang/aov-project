import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { ModeCard } from "./mode-api"
import { modeMetaText } from "./mode-cards"
import { AvailabilityState, isClosed, ModeArt } from "./mode-ui"
import "./modes-wall.css"

/**
 * A group of modes as a wall of tiles of two sizes: a mode with art that is not closed takes a wide tile with its art,
 * a closed or locked mode, or one without art, takes a small square with a mark, so the wall reads at a glance which
 * modes are there to play. The grid fills its gaps, so small tiles slot in beside wide ones.
 */
export function ModesWall({ modes }: { modes: ModeCard[] }) {
  return (
    <ul className="wiki-modes-wall">
      {modes.map((mode) => (
        <li key={mode.code} data-size={mode.art && !isClosed(mode.availability) ? "wide" : "small"}>
          <WallTile mode={mode} />
        </li>
      ))}
    </ul>
  )
}

function WallTile({ mode }: { mode: ModeCard }) {
  const { href, locale } = useWikiContext()
  const closed = isClosed(mode.availability)
  const wide = !!mode.art && !closed
  const meta = modeMetaText(mode, locale)
  return (
    <Link
      className="wiki-modes-tile"
      data-size={wide ? "wide" : "small"}
      data-closed={closed || undefined}
      to={href(`/modes/${encodeURIComponent(mode.code)}`)}
    >
      {mode.art && <ModeArt className="wiki-modes-tile-art" image={mode.art} name={mode.name} inCard />}
      {!wide && (
        <span className="wiki-modes-tile-mark" aria-hidden="true">
          {mode.availability?.status === "LOCKED" ? <LockMark /> : <WikiIcon name="mode" size={26} />}
        </span>
      )}
      <span className="wiki-modes-tile-text">
        <strong>{mode.name}</strong>
        {wide && meta && <small>{meta}</small>}
        <span className="wiki-modes-tile-tags">
          <AvailabilityState availability={mode.availability} quiet />
          {mode.hasGuide && <span className="wiki-mode-tag">{wikiText(locale, "Cẩm nang", "Guide")}</span>}
        </span>
      </span>
    </Link>
  )
}

/** A padlock, for a mode the game has not unlocked. */
function LockMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2" strokeLinecap="round" />
    </svg>
  )
}
