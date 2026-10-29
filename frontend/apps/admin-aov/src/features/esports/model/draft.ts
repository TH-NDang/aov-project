import type { DraftKind, DraftTurn, GameContent, GameDraft, Selection, Side } from "@aov/community-contracts"
import { heroKeys, type HeroLocks, type Unavailable } from "./series-rules"

export const EMPTY_DRAFT: GameDraft = { startSecond: null, lockedSecond: null, turns: [] }

const empty = (): Selection => ({ id: null, name: null })
const present = (hero: Selection | null | undefined): hero is Selection => heroKeys(hero).length > 0
const same = (a: Selection | null | undefined, b: Selection | null | undefined) => {
  const keys = new Set(heroKeys(a))
  return heroKeys(b).some((key) => keys.has(key))
}

/**
 * Professional turn order: bans blue, red, blue, red; picks blue, red, red, blue, blue, red; bans red, blue, red,
 * blue; picks red, blue, blue, red. A tournament with another format can change any turn's team and kind.
 */
export const DRAFT_ORDER: readonly { kind: DraftKind; side: Side }[] = [
  { kind: "BAN", side: "BLUE" },
  { kind: "BAN", side: "RED" },
  { kind: "BAN", side: "BLUE" },
  { kind: "BAN", side: "RED" },
  { kind: "PICK", side: "BLUE" },
  { kind: "PICK", side: "RED" },
  { kind: "PICK", side: "RED" },
  { kind: "PICK", side: "BLUE" },
  { kind: "PICK", side: "BLUE" },
  { kind: "PICK", side: "RED" },
  { kind: "BAN", side: "RED" },
  { kind: "BAN", side: "BLUE" },
  { kind: "BAN", side: "RED" },
  { kind: "BAN", side: "BLUE" },
  { kind: "PICK", side: "RED" },
  { kind: "PICK", side: "BLUE" },
  { kind: "PICK", side: "BLUE" },
  { kind: "PICK", side: "RED" },
]

export const readDraft = (content: Pick<GameContent, "draft">): GameDraft => content.draft ?? EMPTY_DRAFT

/** Recorded turns followed by the template's remaining turns, which are still empty. */
export function draftSlots(draft: GameDraft): (DraftTurn & { recorded: boolean })[] {
  const recorded = draft.turns.map((turn) => ({ ...turn, recorded: true }))
  const rest = DRAFT_ORDER.slice(recorded.length).map((turn, index) => ({
    ...turn,
    order: recorded.length + index + 1,
    hero: null,
    atSecond: null,
    recorded: false,
  }))
  return [...recorded, ...rest]
}

/**
 * Writes the turns and rebuilds what they imply: each team's bans in turn order, and line-ups that keep a player's
 * hero while it is still one of the team's picks and put new picks into empty lanes in lane order. Players swap heroes
 * afterwards with `assignHero`.
 */
export function withTurns(content: GameContent, turns: DraftTurn[]): GameContent {
  const ordered = turns.map((turn, index) => ({ ...turn, order: index + 1 }))
  const sides = content.sides.map((side) => {
    const own = (kind: DraftKind) => ordered.filter((turn) => turn.side === side.side && turn.kind === kind)
    const bans = own("BAN").map((turn) => turn.hero ?? empty())
    const picks = own("PICK")
      .map((turn) => turn.hero)
      .filter(present)
    const placed = new Set<number>()
    const participants = side.participants.map((participant) => {
      const index = picks.findIndex((pick, position) => !placed.has(position) && same(pick, participant.hero))
      if (index < 0) return { ...participant, hero: empty() }
      placed.add(index)
      return participant
    })
    picks.forEach((pick, index) => {
      if (placed.has(index)) return
      const lane = participants.findIndex((participant) => !present(participant.hero))
      if (lane >= 0) participants[lane] = { ...participants[lane]!, hero: pick }
    })
    return {
      ...side,
      bans: [...bans, ...Array.from({ length: Math.max(0, 4 - bans.length) }, empty)].slice(0, 4),
      participants,
    }
  })
  return { ...content, sides, draft: { ...readDraft(content), turns: ordered } }
}

/** Gives a lane one of its team's picked heroes; the lane that had it takes this lane's previous hero (a swap). */
export function assignHero(content: GameContent, side: Side, lane: number, hero: Selection): GameContent {
  return {
    ...content,
    sides: content.sides.map((entry) => {
      if (entry.side !== side) return entry
      const previous = entry.participants[lane]?.hero ?? empty()
      return {
        ...entry,
        participants: entry.participants.map((participant, index) =>
          index === lane
            ? { ...participant, hero }
            : same(participant.hero, hero)
              ? { ...participant, hero: previous }
              : participant,
        ),
      }
    }),
  }
}

export const setDraftTimes = (
  content: GameContent,
  change: Partial<Pick<GameDraft, "startSecond" | "lockedSecond">>,
): GameContent => ({ ...content, draft: { ...readDraft(content), ...change } })

/** Picked heroes of one team, in pick order. */
export const teamPicks = (draft: GameDraft, side: Side) =>
  draft.turns
    .filter((turn) => turn.kind === "PICK" && turn.side === side)
    .map((turn) => turn.hero)
    .filter(present)

/**
 * Heroes a turn cannot take: anything another turn of this draft already took, and for picks what the picking team
 * played earlier in the series.
 */
export function turnUnavailable(
  draft: GameDraft,
  index: number,
  turn: { kind: DraftKind; side: Side },
  teamId: string | undefined,
  locks: HeroLocks,
  teamName: (teamId: string) => string,
): Map<string, Unavailable> {
  const blocked = new Map<string, Unavailable>()
  const add = (hero: Selection | null | undefined, reason: string) => {
    for (const key of heroKeys(hero)) if (!blocked.has(key)) blocked.set(key, { reason })
  }
  draft.turns.forEach((other, position) => {
    if (position !== index) add(other.hero, `Đã ${other.kind === "BAN" ? "cấm" : "chọn"} ở lượt ${position + 1}`)
  })
  if (turn.kind === "PICK" && teamId)
    for (const use of locks.byTeam.get(teamId) ?? [])
      add(use.hero, `${teamName(teamId)} đã dùng ở ván ${use.gameNumber}`)
  return blocked
}

/** Earliest video second the game can go live: after the draft's last recorded mark. */
export function earliestLive(draft: GameDraft) {
  const marks = [draft.startSecond, draft.lockedSecond, ...draft.turns.map((turn) => turn.atSecond)]
  return Math.max(0, ...marks.filter((value): value is number => value != null))
}
