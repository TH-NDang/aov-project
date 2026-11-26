import type { DraftKind, Side } from "@aov/community-contracts"
import { ArrowLeftRight, ChevronRight, TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { formatClock } from "@/lib/clock"
import type { GameView, IconRef } from "../../model/game-view"
import { heroKeys, type HeroLocks, type HeroUse } from "../../model/series-rules"
import { HeroIcon } from "../primitives"
import { EntityRef } from "./entity-ref"
import "./draft.css"

/** One place of the board. Without an order, as in an imported game, only its team and its kind are known. */
export type BoardSlot = {
  index: number
  order: number | null
  kind: DraftKind
  side: Side
  hero: IconRef | null
  recorded: boolean
  atSecond: number | null
}

const SIDES: readonly Side[] = ["BLUE", "RED"]
const KINDS: readonly DraftKind[] = ["BAN", "PICK"]

export const turnWords = (kind: DraftKind) => (kind === "BAN" ? "cấm" : "chọn")

/** The earlier game a hero was played in by a team that may not pick it again. */
export const earlierUse = (locks: HeroLocks, teamId: string, hero: IconRef | null): HeroUse | undefined => {
  const keys = new Set(heroKeys(hero))
  return keys.size
    ? locks.byTeam.get(teamId)?.find((use) => heroKeys(use.hero).some((key) => keys.has(key)))
    : undefined
}

/** What a slot says when it is read out or pointed at. */
function slotLabel(slot: BoardSlot, team: string) {
  const turn = slot.order === null ? "" : `Lượt ${slot.order}, `
  const hero = slot.hero?.name ?? (slot.recorded && slot.kind === "BAN" ? "không cấm" : "")
  const at = slot.atSecond === null ? "" : `, ▸${formatClock(slot.atSecond)}`
  return `${turn}${team} ${turnWords(slot.kind)}${hero && ` ${hero}`}${at}`
}

/**
 * The bans and picks of both teams where a broadcast shows them. Recording, a recorded turn is pressed to change it and
 * the next one is ringed; viewing, the faces open the cards of their heroes.
 */
export function DraftBoard({
  game,
  slots,
  next = null,
  selected = null,
  locks,
  onSelect,
  onSwapSides,
}: {
  game: GameView
  slots: BoardSlot[]
  /** The slot the next turn fills. */
  next?: number | null
  selected?: number | null
  locks: HeroLocks
  /** Absent while viewing. */
  onSelect?: (index: number) => void
  onSwapSides?: () => void
}) {
  const slot = (entry: BoardSlot) => {
    const team = game.sides[entry.side].team
    const used = entry.kind === "PICK" ? earlierUse(locks, team.id, entry.hero) : undefined
    const warning = used ? `${team.shortName} đã dùng ${used.hero.name} ở ván ${used.gameNumber}` : null
    const label = [slotLabel(entry, team.shortName), warning].filter(Boolean).join(". ")
    const face = entry.hero && (
      <HeroIcon hero={entry.hero} size={52} title="" className="aspect-square h-auto! w-full! rounded-md" />
    )
    const marks = (
      <>
        {entry.order !== null && <span className="esp-draft-order">{entry.order}</span>}
        {warning && <TriangleAlert size={14} className="esp-draft-warn" aria-hidden />}
      </>
    )
    const props = {
      className: "esp-draft-slot",
      title: label,
      "data-kind": entry.kind,
      "data-turn": entry.order ?? undefined,
      "data-recorded": entry.recorded || undefined,
      "data-next": entry.index === next || undefined,
    }
    if (onSelect && (entry.recorded || entry.index === next))
      return (
        <button
          key={entry.index}
          type="button"
          {...props}
          aria-label={label}
          aria-pressed={entry.recorded ? entry.index === selected : undefined}
          onClick={() => onSelect(entry.index)}
        >
          {face}
          {marks}
        </button>
      )
    if (onSelect || !entry.hero)
      return (
        <span key={entry.index} {...props} role="img" aria-label={label}>
          {face}
          {marks}
        </span>
      )
    return (
      <span key={entry.index} {...props}>
        <EntityRef kind="hero" entity={entry.hero}>
          {face}
        </EntityRef>
        {marks}
      </span>
    )
  }

  return (
    <div className="esp-draft-board" aria-label="Cấm chọn" role="group">
      <div className="esp-draft-head">
        <span className="esp-draft-team" data-side="BLUE">
          {game.sides.BLUE.team.shortName}
        </span>
        {onSwapSides ? (
          <Button type="button" size="xs" variant="ghost" onClick={onSwapSides}>
            <ArrowLeftRight aria-hidden /> Đổi bên
          </Button>
        ) : (
          <span />
        )}
        <span className="esp-draft-team" data-side="RED">
          {game.sides.RED.team.shortName}
        </span>
      </div>
      {SIDES.map((side) => (
        <div key={side} className="esp-draft-side" data-side={side}>
          {KINDS.map((kind) => (
            <div key={kind} className="esp-draft-line" data-kind={kind}>
              {slots.filter((entry) => entry.side === side && entry.kind === kind).map(slot)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Heroes the teams played earlier in the match, folded away: they are only looked up now and then. */
export function UsedHeroes({
  game,
  locks,
  icon,
}: {
  game: GameView
  locks: HeroLocks
  icon: (hero: { id?: string | null; name: string }) => IconRef | null
}) {
  const teams = SIDES.map((side) => ({
    team: game.sides[side].team,
    uses: locks.byTeam.get(game.sides[side].team.id) ?? [],
  }))
  const total = teams.reduce((sum, { uses }) => sum + uses.length, 0)
  if (locks.decider && game.number > 1)
    return <p className="esp-draft-line-note">{`Ván ${game.number} mở lại toàn bộ tướng.`}</p>
  if (!total) return null
  return (
    <details className="esp-draft-used">
      <summary>
        <ChevronRight size={14} aria-hidden /> Đã dùng ở ván trước: {total} tướng
      </summary>
      {teams.map(({ team, uses }) =>
        uses.length ? (
          <div key={team.id} role="group" aria-label={`Tướng ${team.name} đã dùng ở ván trước`}>
            <b className="font-semibold text-foreground">{team.shortName}</b>
            {uses.map((use, index) => (
              <EntityRef key={index} kind="hero" entity={icon(use.hero)}>
                <span className="inline-flex items-center gap-1" title={`${use.hero.name}, ván ${use.gameNumber}`}>
                  <HeroIcon hero={icon(use.hero)} size={22} title="" className="rounded-md" />
                  {use.gameNumber}
                </span>
              </EntityRef>
            ))}
          </div>
        ) : null,
      )}
    </details>
  )
}
