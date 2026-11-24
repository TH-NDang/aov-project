import type { CSSProperties } from "react"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { hueOf } from "./community-ui"
import { useStreamLocale } from "./stream-locale"
import { LANE_NAMES } from "../lib/tournament-model"
import "./player-mark.css"

/**
 * A player's mark: the first letter of the nickname on a colour of its own, with the lane at its corner. Nobody has a
 * photo here, so this is what tells people apart at a glance; `round` is for those who do not play. The name beside it
 * says who it is.
 */
export function PlayerMark({
  name,
  lane,
  size = 40,
  round = false,
}: {
  name: string
  lane?: Lane | null
  size?: number
  round?: boolean
}) {
  const { text } = useStreamLocale()
  const letter = [...name.replace(/[^\p{L}\p{N}]/gu, "")][0] ?? "?"
  return (
    <span
      className="pl-mark"
      data-round={round || undefined}
      style={{ "--pl-hue": hueOf(name), width: size, height: size, fontSize: size * 0.46 } as CSSProperties}
    >
      <span aria-hidden="true">{letter.toLocaleUpperCase("vi-VN")}</span>
      {lane && (
        <span className="pl-mark-lane">
          <HeroLaneIcon
            lane={lane}
            size={Math.max(12, Math.round(size * 0.34))}
            label={text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])}
          />
        </span>
      )}
    </span>
  )
}
