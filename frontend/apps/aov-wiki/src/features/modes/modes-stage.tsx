import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../context/wiki-context"
import type { ModeCard } from "./mode-api"
import { modeMetaText } from "./mode-cards"
import { AvailabilityState, GROUP_NAMES } from "./mode-ui"
import "./modes-stage.css"

/** The parts of an auto-chess guide a reader opens most, as quick links on the stage. */
const GUIDE_LINKS = [
  { key: "units", label: "Quân cờ", english: "Units" },
  { key: "traits", label: "Phe & Nghề", english: "Factions & Classes" },
  { key: "lineups", label: "Đội hình", english: "Lineups" },
  { key: "builder", label: "Xếp đội hình", english: "Lineup builder" },
] as const

/**
 * The head of the game modes: one mode on a stage, its art across the whole width and, over the art's dark side, the
 * page's title, the mode's group, name, length, status and a gold button into it. A mode with a guide also offers its
 * most used parts. Phones run the stage edge to edge under the clear header, which already names the page.
 */
export function ModesStage({ mode, count, wide }: { mode: ModeCard; count: number; wide: boolean }) {
  const { href, locale } = useWikiContext()
  const text = useWikiText()
  const base = `/modes/${encodeURIComponent(mode.code)}`
  const meta = modeMetaText(mode, locale)
  return (
    <section className="wiki-modes-stage" data-layout={wide ? "wide" : "compact"} aria-labelledby="modes-stage-name">
      <div className="wiki-modes-stage-art" aria-hidden="true">
        {mode.art ? (
          <img
            src={mode.art.url}
            alt=""
            width={mode.art.width}
            height={mode.art.height}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={
              mode.art.focalPoint
                ? { objectPosition: `${mode.art.focalPoint.x * 100}% ${mode.art.focalPoint.y * 100}%` }
                : undefined
            }
          />
        ) : (
          <WikiIcon name="mode" size={120} />
        )}
      </div>
      <div className="wiki-modes-stage-body">
        {wide && (
          <h1 className="wiki-modes-stage-title">
            {text("Chế độ chơi", "Game modes")}
            <small>{text(`${count} chế độ`, count === 1 ? "1 mode" : `${count} modes`)}</small>
          </h1>
        )}
        <p className="wiki-modes-stage-kicker">
          {mode.hasGuide
            ? text("Có cẩm nang", "With a guide")
            : text(GROUP_NAMES[mode.group][0], GROUP_NAMES[mode.group][1])}
        </p>
        <h2 id="modes-stage-name">{mode.name}</h2>
        <p className="wiki-modes-stage-meta">
          {meta && <span>{meta}</span>}
          <AvailabilityState availability={mode.availability} quiet />
        </p>
        {wide && mode.summary && <p className="wiki-modes-stage-summary">{mode.summary}</p>}
        <div className="wiki-modes-stage-actions">
          <Link className="wiki-modes-stage-go" to={href(base)}>
            {mode.hasGuide ? text("Mở cẩm nang", "Open the guide") : text("Xem chế độ", "See the mode")}
            <WikiIcon name="arrow" size={18} />
          </Link>
          {mode.guideKind === "AUTO_CHESS" && (
            <nav className="wiki-modes-stage-links" aria-label={text(`Cẩm nang ${mode.name}`, `${mode.name} guide`)}>
              {GUIDE_LINKS.map((item) => (
                <Link key={item.key} to={href(`${base}/${item.key}`)}>
                  {text(item.label, item.english)}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}

/** The stage while the modes load: the same height, a bar where the name will stand. */
export function ModesStageSkeleton({ wide }: { wide: boolean }) {
  return (
    <div className="wiki-modes-stage" data-layout={wide ? "wide" : "compact"} data-skeleton="">
      <div className="wiki-modes-stage-body">
        <span className="wiki-modes-stage-bar" />
      </div>
    </div>
  )
}
