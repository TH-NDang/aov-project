import { createContext, useContext } from "react"
import type { ObjectiveKind } from "@aov/community-contracts"
import { Flag } from "lucide-react"
import { MapGlyph } from "@aov/ui/components/battle-map-glyph"
import { OBJECTIVE_GLYPHS, type MapObjective } from "@aov/ui/lib/battle-map"
import { OBJECTIVE_LABELS } from "../../model/timeline"

/**
 * The game's own icon of each objective, as uploaded to the Wiki's battlefield map. The page supplies it, so these
 * components stay free of app APIs; without it each objective shows the Wiki's drawn symbol.
 */
export const ObjectiveArt = createContext<Partial<Record<MapObjective, string>>>({})

export function ObjectiveIcon({ objective, size = 28 }: { objective: ObjectiveKind; size?: number }) {
  const art = useContext(ObjectiveArt)
  const label = OBJECTIVE_LABELS[objective]
  if (objective === "OTHER")
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
        style={{ width: size, height: size }}
        title={label}
      >
        <Flag size={size * 0.5} />
      </span>
    )
  const icon = art[objective]
  // Game icons are light, so they sit on a dark disc in both themes.
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-black/85 text-white/80"
      style={{ width: size, height: size }}
      title={label}
    >
      {icon ? (
        <img src={icon} alt={label} className="size-[86%] object-contain" />
      ) : (
        <MapGlyph glyph={OBJECTIVE_GLYPHS[objective]} size={Math.round(size * 0.62)} />
      )}
    </span>
  )
}
