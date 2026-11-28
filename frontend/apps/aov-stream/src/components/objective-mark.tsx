import type { CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ObjectiveKind } from "@aov/community-contracts"
import { MapGlyph } from "@aov/ui/components/battle-map-glyph"
import { OBJECTIVE_GLYPHS, objectiveIcons } from "@aov/ui/lib/battle-map"
import { battleMapQuery, TOURNAMENT_MODE } from "../lib/battle-map-api"
import { StreamIcon } from "./stream-icon"
import "./objective-mark.css"

/**
 * The sign of an objective taken in a game: the game's own icon of Caesar, the dragon, a tower or the base, as uploaded
 * to the Wiki's battlefield map, on a dark disc because game icons are light. Until the map is read, or where it has no
 * icon, the Wiki's drawn symbol stands on the same disc. Any other objective is a flag.
 */
export function ObjectiveMark({ objective, size }: { objective: ObjectiveKind; size: number }) {
  const map = useQuery(battleMapQuery(TOURNAMENT_MODE))
  if (objective === "OTHER") return <StreamIcon name="flag" size={size} />
  const icon = map.data ? objectiveIcons(map.data.content, map.data.images)[objective] : undefined
  return (
    <span className="hub-objective" style={{ "--size": `${size + 4}px` } as CSSProperties} aria-hidden="true">
      {icon ? <img src={icon} alt="" /> : <MapGlyph glyph={OBJECTIVE_GLYPHS[objective]} size={size - 2} />}
    </span>
  )
}
