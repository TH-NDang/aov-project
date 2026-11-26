import type { ReactNode } from "react"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { useStreamLocale } from "../../../components/stream-locale"
import { laneName } from "../../../lib/feed-words"
import "./column-heading.css"

/** The name of one of several columns, over the rule its list hangs from. */
export function ColumnHeading({ children }: { children: ReactNode }) {
  return <h3 className="tn-column-heading">{children}</h3>
}

/** The lane a column is about; null for what was played in a lane nobody recorded. */
export function LaneHeading({ lane }: { lane: Lane | null }) {
  const { text } = useStreamLocale()
  return (
    <ColumnHeading>
      {lane && <HeroLaneIcon lane={lane} size={20} />}
      {lane ? laneName(lane, text) : text("Chưa rõ đường", "Lane not known")}
    </ColumnHeading>
  )
}
