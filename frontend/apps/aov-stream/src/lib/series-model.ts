import type { GameSide, Lane, PublishedGame, Selection, Side, TimelineEvent } from "@aov/community-contracts"
import { LANES } from "./tournament-model.ts"

/** The team that won a game, or null while its winner is not recorded. */
export function gameWinner(game: Pick<PublishedGame, "content">): string | null {
  const { winner, sides } = game.content
  return sides.find((side) => side.side === winner)?.teamId ?? null
}

export type DraftCell = { game: PublishedGame; hero: Selection; won: boolean | null; mvp: boolean } | null
export type DraftRow = {
  /** The player, or the lane while a game does not name who played it. */
  key: string
  playerId: string | null
  lane: Lane
  /** One cell per game, in the order of the games. */
  cells: DraftCell[]
}

/**
 * The heroes a team picked over the games of a match: one row per player and lane, in lane order, and one cell per
 * game. A player who was substituted or changed lanes gets a row of their own, so every cell says who played it.
 */
export function draftRows(games: PublishedGame[], teamId: string): DraftRow[] {
  const rows = new Map<string, DraftRow>()
  games.forEach((game, at) => {
    const side = game.content.sides.find((item) => item.teamId === teamId)
    const winner = gameWinner(game)
    for (const seat of side?.participants ?? []) {
      const key = `${seat.lane}:${seat.playerId ?? ""}`
      const row = rows.get(key) ?? {
        key,
        playerId: seat.playerId ?? null,
        lane: seat.lane,
        cells: games.map((): DraftCell => null),
      }
      row.cells[at] = {
        game,
        hero: seat.hero,
        won: winner == null ? null : winner === teamId,
        mvp: !!seat.playerId && seat.playerId === game.content.mvpPlayerId,
      }
      rows.set(key, row)
    }
  })
  return [...rows.values()].sort((x, y) => LANES.indexOf(x.lane) - LANES.indexOf(y.lane))
}

/** Both players of each lane of a game, in lane order; a lane nobody is recorded in is left out. */
export function laneDuels([a, b]: [GameSide, GameSide]) {
  return LANES.flatMap((lane) => {
    const duel = {
      lane,
      a: a.participants.find((seat) => seat.lane === lane),
      b: b.participants.find((seat) => seat.lane === lane),
    }
    return duel.a || duel.b ? [duel] : []
  })
}

export type DraftPhase = { kind: "BAN" | "PICK"; turns: NonNullable<PublishedGame["content"]["draft"]>["turns"] }

/** The turns of a draft in order, neighbouring bans and neighbouring picks gathered into phases. */
export function draftPhases(game: Pick<PublishedGame, "content">): DraftPhase[] {
  const phases: DraftPhase[] = []
  for (const turn of [...(game.content.draft?.turns ?? [])].sort((x, y) => x.order - y.order)) {
    const last = phases.at(-1)
    if (last?.kind === turn.kind) last.turns.push(turn)
    else phases.push({ kind: turn.kind, turns: [turn] })
  }
  return phases
}

export type TimelineRow = { event: TimelineEvent; side: Side | null; kills: Record<Side, number> }

/** The moments of a game in order, each with the side it belongs to and the kills of both sides up to then. */
export function timelineRows(game: Pick<PublishedGame, "content">): TimelineRow[] {
  const kills: Record<Side, number> = { BLUE: 0, RED: 0 }
  return [...(game.content.timeline?.events ?? [])]
    .sort((x, y) => x.atSeconds - y.atSeconds)
    .map((event) => {
      const side = event.side ?? event.killer?.side ?? event.by?.side ?? null
      if (event.kind === "KILL" && event.killer) kills[event.killer.side] += 1
      return { event, side, kills: { ...kills } }
    })
}

/** The room a mark of the track takes, as a share of the game's length. */
const MARK = 0.046

export type TrackMark = { event: TimelineEvent; share: number; level: number }

/**
 * The moments of each side along the length of a game. A mark that would meet the one before it steps to the next
 * level, away from the line.
 */
export function trackLanes(rows: TimelineRow[], seconds: number) {
  const lane = (side: Side) => {
    const ends: number[] = []
    const marks = rows
      .filter((row) => row.side === side)
      .map(({ event }): TrackMark => {
        const share = Math.min(1, Math.max(0, event.atSeconds / seconds))
        const free = ends.findIndex((end) => end <= share)
        const level = free < 0 ? ends.length : free
        ends[level] = share + MARK
        return { event, share, level }
      })
    return { marks, levels: Math.max(1, ends.length) }
  }
  return { BLUE: lane("BLUE"), RED: lane("RED") }
}
