import type { CSSProperties } from "react"
import type { ObjectiveKind, PublishedGame, Side } from "@aov/community-contracts"
import { StreamIcon, type StreamIconName } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { trackLanes, type TimelineRow } from "../../../lib/series-model"
import { clock } from "../../../lib/tournament-model"
import "./game-track.css"

export const OBJECTIVE_NAMES: Record<ObjectiveKind, readonly [string, string]> = {
  DARK_SLAYER: ["Hạ tà thần Caesar", "Took the Dark Slayer"],
  ABYSSAL_DRAGON: ["Hạ Rồng", "Took the Abyssal Dragon"],
  TURRET: ["Phá trụ", "Destroyed a tower"],
  BASE: ["Phá nhà chính", "Destroyed the base"],
  OTHER: ["Chiếm mục tiêu", "Took an objective"],
}
export const OBJECTIVE_ICONS: Record<ObjectiveKind, StreamIconName> = {
  DARK_SLAYER: "slayer",
  ABYSSAL_DRAGON: "dragon",
  TURRET: "tower",
  BASE: "core",
  OTHER: "flag",
}

/**
 * The objectives of a game along the time it took, one team above the line and the other below it. `order` is the side
 * drawn above, then the one below.
 */
export function GameTrack({ game, rows, order }: { game: PublishedGame; rows: TimelineRow[]; order: [Side, Side] }) {
  const { text } = useStreamLocale()
  const last = rows.at(-1)!.event.atSeconds
  const seconds = Math.max(game.content.durationSeconds ?? 0, last)
  const lanes = trackLanes(rows, seconds)
  const kinds = [...new Set(rows.map((row) => row.event.objective ?? "OTHER"))]
  // A mark every two minutes, or every five of a long game.
  const step = seconds > 20 * 60 ? 300 : 120
  const marks = Array.from({ length: Math.floor((seconds - 1) / step) }, (_, index) => (index + 1) * step)
  return (
    <div className="tn-objectives">
      <ul className="tn-objectives-legend">
        {kinds.map((kind) => (
          <li key={kind}>
            <StreamIcon name={OBJECTIVE_ICONS[kind]} size={16} />
            {text(...OBJECTIVE_NAMES[kind])}
          </li>
        ))}
      </ul>
      {order.map((side, at) => {
        const team = game.teams[game.content.sides.find((item) => item.side === side)?.teamId ?? ""]
        const name =
          team?.shortName ||
          team?.name ||
          (side === "BLUE" ? text("Bên xanh", "Blue side") : text("Bên đỏ", "Red side"))
        const { marks: events, levels } = lanes[side]
        return (
          <section
            key={side}
            className="tn-objectives-lane"
            data-side={side}
            data-at={at === 0 ? "above" : "below"}
            style={{ "--levels": levels } as CSSProperties}
          >
            <h3>
              <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={name} />
              {name}
              <small>{text(`${events.length} mục tiêu`, `${events.length} objectives`)}</small>
            </h3>
            <ol>
              {events.map(({ event, share, level }) => {
                const kind = event.objective ?? "OTHER"
                const named = text(...OBJECTIVE_NAMES[kind])
                return (
                  <li
                    key={event.id}
                    title={[`${clock(event.atSeconds)} ${named}`, event.note].filter(Boolean).join("\n")}
                    style={{ "--at": share, "--level": level } as CSSProperties}
                  >
                    <span>
                      <StreamIcon name={OBJECTIVE_ICONS[kind]} size={18} />
                      <span className="sr-only">{named}</span>
                    </span>
                    <time>{clock(event.atSeconds)}</time>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
      <div className="tn-objectives-line" aria-hidden="true">
        {marks.map((mark) => (
          <span key={mark} style={{ "--at": mark / seconds } as CSSProperties}>
            {mark / 60}′
          </span>
        ))}
      </div>
    </div>
  )
}
