import type { ObjectiveKind } from "@aov/community-contracts"
import { Flag } from "lucide-react"
import { OBJECTIVE_LABELS } from "../../model/timeline"

// Original emblems generated for this project; `new URL` keeps them bundled by Vite and loadable in Node tests.
const OBJECTIVE_ART: Partial<Record<ObjectiveKind, string>> = {
  DARK_SLAYER: new URL("../../assets/objectives/dark-slayer.webp", import.meta.url).href,
  ABYSSAL_DRAGON: new URL("../../assets/objectives/abyssal-dragon.webp", import.meta.url).href,
  TURRET: new URL("../../assets/objectives/turret.webp", import.meta.url).href,
  BASE: new URL("../../assets/objectives/base.webp", import.meta.url).href,
}

export function ObjectiveIcon({ objective, size = 28 }: { objective: ObjectiveKind; size?: number }) {
  const art = OBJECTIVE_ART[objective]
  return art ? (
    <img
      src={art}
      alt={OBJECTIVE_LABELS[objective]}
      title={OBJECTIVE_LABELS[objective]}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
      title={OBJECTIVE_LABELS[objective]}
    >
      <Flag size={size * 0.5} />
    </span>
  )
}
