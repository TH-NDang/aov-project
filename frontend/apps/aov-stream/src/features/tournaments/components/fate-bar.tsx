import type { CSSProperties } from "react"
import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import type { Counted } from "../../../lib/game-feed"
import type { Fate } from "../../../lib/hero-model"
import "./fate-bar.css"

/**
 * The parts of the bar, in their order: `open` are games whose result is not recorded, `unknown` those that do not show
 * their bans.
 */
export type FatePart = "won" | "lost" | "open" | "banned" | "left" | "unknown"

/** Parts drawn as a line have no room for their number. */
const LINES: FatePart[] = ["left", "unknown"]

/** Where a part leads, and what it counts in words. */
export type FateLink = { to: string; label: string }

/**
 * What became of a hero as one bar as long as all games counted, so the bars of a list compare: solid where it won,
 * paler where it lost, palest where nobody wrote down who won, hollow where it was banned, a thin line where nobody took
 * it, and a dotted one where nobody wrote down who was banned. `numbers` writes the counts into the parts that have
 * room, and `links` make parts of it lead to their games.
 */
export function FateBar({
  fate,
  numbers = false,
  links,
}: {
  fate: Fate
  numbers?: boolean
  links?: Partial<Record<FatePart, FateLink>>
}) {
  const { languageTag } = useStreamLocale()
  const { games, picks, wins, losses, bans, unknown } = fate
  const counts: [FatePart, number][] = [
    ["won", wins],
    ["lost", losses],
    ["open", picks - wins - losses],
    ["banned", bans],
    ["left", games - picks - bans - unknown],
    ["unknown", unknown],
  ]
  return (
    <span className="tn-fate" data-numbers={numbers || undefined} aria-hidden={links ? undefined : true}>
      {counts
        .filter(([, count]) => count > 0)
        .map(([part, count]) => {
          const link = links?.[part]
          const drawn = {
            "data-part": part,
            style: { "--part": count } as CSSProperties,
            children: numbers && !LINES.includes(part) && (
              <span>
                <b>{count.toLocaleString(languageTag)}</b>
              </span>
            ),
          }
          return link ? (
            <Link key={part} to={link.to} aria-label={link.label} {...drawn} />
          ) : (
            <i key={part} aria-hidden={links ? true : undefined} {...drawn} />
          )
        })}
    </span>
  )
}

/** The words for the parts the bars of some games have, once a screen. */
export function FateLegend({ counted: { games, shown } }: { counted: Counted }) {
  const { text } = useStreamLocale()
  return (
    <ul className="tn-fate-legend">
      <li data-part="won">{text("thắng", "won")}</li>
      <li data-part="lost">{text("thua", "lost")}</li>
      {shown > 0 && (
        <>
          <li data-part="banned">{text("bị cấm", "banned")}</li>
          <li data-part="left">{text("không ai chọn", "nobody took it")}</li>
        </>
      )}
      {shown < games && <li data-part="unknown">{text("chưa ghi lượt cấm", "bans not recorded")}</li>}
    </ul>
  )
}
