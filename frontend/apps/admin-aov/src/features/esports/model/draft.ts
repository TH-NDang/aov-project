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

/** The game with one ban/pick turn moved to another video second; null when the turn is not recorded. */
export function moveTurn(content: GameContent, order: number, videoSecond: number): GameContent | null {
  const draft = readDraft(content)
  if (!draft.turns.some((turn) => turn.order === order)) return null
  const turns = draft.turns.map((turn) =>
    turn.order === order ? { ...turn, atSecond: Math.max(0, Math.round(videoSecond)) } : turn,
  )
  return { ...content, draft: { ...draft, turns } }
}

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

/** A ban or a hero of the line-ups as the game holds it, whatever turn it was taken in. */
export type DraftedHero = { side: Side; kind: DraftKind; hero: Selection }

const recordedHeroes = (content: GameContent): DraftedHero[] =>
  content.sides.flatMap(({ side, bans, participants }) => [
    ...bans.filter(present).map((hero) => ({ side, kind: "BAN" as const, hero })),
    ...participants.flatMap(({ hero }) => (present(hero) ? [{ side, kind: "PICK" as const, hero }] : [])),
  ])

/** Bans or heroes without the order they were taken in, as in most imported games. */
export const lacksTurns = (content: GameContent) =>
  !readDraft(content).turns.length && recordedHeroes(content).length > 0

/** Recorded bans and heroes that no turn of their team names. A game that has turns may not keep any of them. */
export const unnamed = (content: GameContent, turns: DraftTurn[]): DraftedHero[] =>
  recordedHeroes(content).filter(
    (entry) =>
      !turns.some((turn) => turn.side === entry.side && turn.kind === entry.kind && same(turn.hero, entry.hero)),
  )

/**
 * The turns of a game that had none, written in one change. A hero of the line-ups takes the spelling of the turn that
 * names it, because the service tells heroes by their id first and an imported line-up may only know the name.
 */
export function withCollectedTurns(content: GameContent, turns: DraftTurn[]): GameContent {
  const next = withTurns(content, turns)
  return {
    ...next,
    sides: next.sides.map((side) => ({
      ...side,
      participants: side.participants.map((participant) => {
        const turn = turns.find(
          (candidate) =>
            candidate.kind === "PICK" && candidate.side === side.side && same(candidate.hero, participant.hero),
        )
        return turn?.hero ? { ...participant, hero: turn.hero } : participant
      }),
    })),
  }
}

/** Puts the turns, the bans and the heroes of every lane back as they were; whatever else was recorded since stays. */
export const restoreDraft =
  (before: GameContent) =>
  (content: GameContent): GameContent => ({
    ...content,
    draft: { ...readDraft(content), turns: readDraft(before).turns },
    sides: content.sides.map((side) => {
      const old = before.sides.find((candidate) => candidate.side === side.side && candidate.teamId === side.teamId)
      if (!old) return side
      return {
        ...side,
        bans: old.bans,
        participants: side.participants.map((participant) => ({
          ...participant,
          hero: old.participants.find((candidate) => candidate.lane === participant.lane)?.hero ?? participant.hero,
        })),
      }
    }),
  })

/**
 * The video second a turn takes when it is recorded at `wanted`: after the draft start and the turns before it, before
 * the turns after it, the lock and the game's 0:00, which is what the service accepts. Null without a draft start.
 */
export function turnSecond(
  content: GameContent,
  wanted: number,
  index = readDraft(content).turns.length,
): number | null {
  const draft = readDraft(content)
  if (draft.startSecond == null) return null
  const timed = (turns: DraftTurn[]) => turns.flatMap((turn) => (turn.atSecond == null ? [] : [turn.atSecond]))
  const min = Math.max(draft.startSecond, ...timed(draft.turns.slice(0, index)))
  const max = Math.min(
    draft.lockedSecond ?? Infinity,
    content.sourceTimestampSeconds ?? Infinity,
    ...timed(draft.turns.slice(index + 1)),
  )
  return max < min ? null : Math.min(max, Math.max(min, Math.floor(wanted)))
}
