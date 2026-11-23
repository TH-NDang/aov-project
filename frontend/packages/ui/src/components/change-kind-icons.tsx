import type { ComponentType } from "react"
import {
  BugOff,
  Database,
  Hammer,
  Minus,
  PencilLine,
  Scale,
  SlidersVertical,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { gameIcon } from "./game-icons"

type ChangeKindIcon = ComponentType<{
  size?: number | string
  className?: string
  strokeWidth?: number | string
  "aria-hidden"?: boolean
}>

/**
 * The mark of each kind of change a version made, the same in the Wiki and Admin: Lucide strokes, and a falling star
 * from Game Icons for something new. They take the colour of the text, so each place tints them by kind.
 */
export const changeKindIcons = {
  BUFF: TrendingUp,
  NERF: TrendingDown,
  ADJUSTMENT: SlidersVertical,
  BALANCE: Scale,
  REWORK: Hammer,
  FIX: BugOff,
  ADDED: gameIcon("falling-star"),
  REMOVED: Minus,
  UPDATED: PencilLine,
  DATA_BASELINE: Database,
} satisfies Record<string, ChangeKindIcon>

// A hero joining the game wears the same mark as a new item.
const ALIASES: Record<string, keyof typeof changeKindIcons> = { ADJUST: "ADJUSTMENT", BUG_FIX: "FIX", RELEASE: "ADDED" }

/** The mark for a change kind, or undefined for a kind that has none. */
export function changeKindIcon(kind: string): ChangeKindIcon | undefined {
  const known = ALIASES[kind] ?? kind
  return Object.hasOwn(changeKindIcons, known) ? changeKindIcons[known as keyof typeof changeKindIcons] : undefined
}
