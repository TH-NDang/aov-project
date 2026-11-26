import { Fragment, useMemo, type ReactNode } from "react"
import type { Lane, Selection, Side } from "@aov/community-contracts"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { formatClock } from "@/lib/clock"
import { LANE_ORDER } from "@/lib/lanes"
import { endInventory } from "../../model/build"
import { slotsAt, type GameSeat, type GameView, type IconRef } from "../../model/game-view"
import type { ItemLookups } from "../../model/item-lookups"
import type { RosterOption } from "../../model/line-up"
import type { LoadoutPart } from "../../model/loadout"
import type { HeroLocks } from "../../model/series-rules"
import { inventoryAt, seatStatsAt, type SeatKey, type SlotState, type TimelineEvent } from "../../model/timeline"
import { LaneIcon, TeamLogo } from "../primitives"
import { DockMenuContent } from "./dock-menu"
import { earlierUse } from "./draft-board"
import { LineupSeat } from "./lineup-seat"
import "./lineup.css"

/** Items bought this many seconds before the playhead are outlined. */
const JUST_BOUGHT = 20

const SIDES: readonly Side[] = ["BLUE", "RED"]

/** What can be done with a whole team; entries of one group stand together in its menu. */
export type TeamAction = { label: string; title?: string; group: string; onSelect: () => void }

/** What can be changed in the line-ups; absent while viewing. */
export type LineupActions = {
  onSwap?: (seat: SeatKey, hero: Selection) => void
  onPlayer?: (seat: SeatKey, playerId: string | null) => void
  onPart?: (seat: SeatKey, part: LoadoutPart) => void
  teamActions?: (side: Side) => TeamAction[]
}

/**
 * Both teams lane by lane, blue on the left and red mirrored on the right, with their items at the second on screen.
 * While recording, the hero, the player and every part of a seat are changed by pressing them.
 */
export function LineupBoard({
  game,
  events,
  at,
  lookups,
  locks,
  roster,
  picks,
  wait,
  fill,
  onSwap,
  onPlayer,
  onPart,
  teamActions,
}: LineupActions & {
  game: GameView
  events: TimelineEvent[]
  /** Game second whose items are shown; null for those of the end, which also stand for a game that knows no others. */
  at: number | null
  lookups: ItemLookups
  /** Heroes each team already played in the match. */
  locks: HeroLocks
  roster: (teamId: string) => RosterOption[]
  /** The heroes a team picked, for swapping them among its lanes. */
  picks: (side: Side) => IconRef[]
  /** What the pictures still wait for, in the place of the time of the items. */
  wait?: string
  /** What can be filled in from elsewhere, under the names of the teams. */
  fill?: ReactNode
}) {
  const end = game.durationSeconds ?? Number.MAX_SAFE_INTEGER
  const second = at ?? end
  const stats = useMemo(
    () => (events.some((event) => event.kind === "KILL") ? seatStatsAt(events, second) : null),
    [events, second],
  )
  const onlyLast = useMemo(
    () => knowsItems(game, events, end, true) && !knowsItems(game, events, end - 1, false),
    [game, events, end],
  )
  const last = at === null || onlyLast
  const ended = last || at >= end
  const slotsOf = (key: SeatKey, when: number, over: boolean) => slotsOfSeat(game, events, key, when, over)

  const team = (side: Side) => {
    const { team } = game.sides[side]
    return (
      <span className="esp-lineup-team" data-side={side}>
        <TeamLogo team={team} size={22} />
        <span>{team.shortName}</span>
        {teamActions && (
          <TeamMenu team={team.shortName} align={side === "BLUE" ? "start" : "end"} actions={teamActions(side)} />
        )}
      </span>
    )
  }
  const seat = (entry: GameSeat | undefined, side: Side) => {
    if (!entry) return <span key={side} />
    const { team } = game.sides[side]
    const used = earlierUse(locks, team.id, entry.hero)
    return (
      <LineupSeat
        key={side}
        seat={entry}
        team={team.name}
        slots={slotsOf(entry.key, ended ? end : second, ended)}
        before={ended ? slotsOf(entry.key, end, ended) : slotsOf(entry.key, Math.max(-1, second - JUST_BOUGHT), false)}
        stats={stats?.get(entry.key) ?? (stats ? { kills: 0, deaths: 0, assists: 0 } : undefined)}
        lookups={lookups}
        members={onPlayer ? roster(team.id) : []}
        picks={onSwap ? picks(side) : []}
        warning={used ? `${team.shortName} đã dùng ${used.hero.name} ở ván ${used.gameNumber}` : null}
        onSwap={onSwap && ((hero) => onSwap(entry.key, hero))}
        onPlayer={onPlayer && ((playerId) => onPlayer(entry.key, playerId))}
        onPart={onPart && ((part) => onPart(entry.key, part))}
      />
    )
  }
  const lanes = LANE_ORDER.filter((lane) => SIDES.some((side) => seatIn(game, side, lane)))

  return (
    <section aria-label={`Đội hình ván ${game.number}`}>
      <div className="esp-lineup-head">
        {team("BLUE")}
        <span className="esp-lineup-when" role={wait && "status"}>
          {wait ?? (ended ? "Trang bị cuối ván" : `Trang bị lúc ${formatClock(at)}`)}
        </span>
        {team("RED")}
      </div>
      {fill && <div className="esp-lineup-fill">{fill}</div>}
      {lanes.map((lane) => (
        <div key={lane} className="esp-lineup-row" data-lane={lane}>
          {seat(seatIn(game, "BLUE", lane), "BLUE")}
          {seat(seatIn(game, "RED", lane), "RED")}
          <span className="esp-lineup-lane">
            <LaneIcon lane={lane} size={18} />
          </span>
        </div>
      ))}
    </section>
  )
}

function TeamMenu({ team, align, actions }: { team: string; align: "start" | "end"; actions: TeamAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon-xs" variant="ghost" aria-label={`Thao tác với cả đội ${team}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DockMenuContent align={align}>
        {actions.map((action, index) => (
          <Fragment key={action.label}>
            {index > 0 && actions[index - 1]!.group !== action.group && <DropdownMenuSeparator />}
            <DropdownMenuItem title={action.title} onSelect={action.onSelect}>
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DockMenuContent>
    </DropdownMenu>
  )
}

/**
 * The six slots a seat ended the game with: its own list, else an inventory seen in the last minute of the game. What a
 * player held earlier says nothing of the end, so those slots stay unknown, as the items part and the service read it.
 */
function endSlots(game: GameView, key: SeatKey): SlotState[] {
  const kept = game.kept?.[key]
  if (kept)
    return Array.from({ length: 6 }, (_, slot) => {
      const held = kept[slot]
      return held && { id: held.id, name: held.name }
    })
  const snapshot = endInventory(game.snapshots[key] ?? [], game.durationSeconds)
  return snapshot ? inventoryAt(key, snapshot.atSeconds, [snapshot], []) : Array<SlotState>(6).fill(undefined)
}

const slotsOfSeat = (game: GameView, events: TimelineEvent[], key: SeatKey, when: number, over: boolean) =>
  over
    ? endSlots(game, key)
    : slotsAt(game.kept?.[key], inventoryAt(key, when, game.snapshots[key] ?? [], events), when, false)

/** Whether an item of any of the ten players is known at a second. */
const knowsItems = (game: GameView, events: TimelineEvent[], when: number, over: boolean) =>
  SIDES.some((side) =>
    game.sides[side].seats.some(({ key }) => slotsOfSeat(game, events, key, when, over).some(Boolean)),
  )

const seatIn = (game: GameView, side: Side, lane: Lane) => game.sides[side].seats.find((entry) => entry.lane === lane)
