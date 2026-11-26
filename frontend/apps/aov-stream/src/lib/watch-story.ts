import type { GameContent, PublishedGame, Side, TimelineEvent, VodPause } from "@aov/community-contracts"
import { gameToVideo, orderedPauses } from "@aov/ui/lib/game-video"
import { readVideoLink } from "@aov/ui/lib/video-playback"
import {
  timed,
  type Chapter,
  type MomentKind,
  type Story,
  type TimedChapter,
  type WatchMoment,
  type WatchTeam,
  type WatchTurn,
} from "./watch-types.ts"

/** Seconds that decide which stretches of a video tell a match. */
export const WATCH = {
  /** Kept before a draft, and before 0:00 where the video jumps to it. */
  lead: 5,
  /** Kept after the end of a game, and after the lock where a long wait follows. */
  tail: 15,
  /** The result of a game is told this long after its last second. */
  tell: 3,
  /** A wait between the lock and 0:00 this long is a break. */
  wait: 120,
  /** A pause of the broadcast this long takes no room; so much of it stays at its two ends. */
  pause: 20,
  pauseHead: 8,
  pauseTail: 3,
  /** A game placed by its link alone: what is added to its length, and how long after that a match is over. */
  linkTail: 60,
  linkOver: 240,
  /** The counts before a break and before a pause is skipped. */
  count: 10,
  countPause: 5,
} as const

/** Where a video is entered for what begins at a second of it. */
export const leadIn = (second: number) => Math.max(0, second - WATCH.lead)

/** Assumed for a game placed by its link alone whose length nobody recorded. */
const LINK_LENGTH = 900

/** The last item that passes the test. */
export function lastOf<Item>(list: readonly Item[], test: (item: Item) => boolean): Item | undefined {
  for (let index = list.length - 1; index >= 0; index--) if (test(list[index])) return list[index]
  return undefined
}

type TeamOf = (side: Side) => WatchTeam

function linkOf(url?: string | null) {
  const link = url ? readVideoLink(url) : null
  return { video: link?.providerVideoId ?? null, second: link?.startSeconds ?? 0 }
}

export const kindOf = (event: Pick<TimelineEvent, "kind" | "objective">): MomentKind =>
  event.kind === "OBJECTIVE" ? (event.objective ?? "OTHER") : event.kind

function momentsOf(content: GameContent, teamOf: TeamOf): WatchMoment[] {
  const moments: WatchMoment[] = []
  for (const event of [...(content.timeline?.events ?? [])].sort((a, b) => a.atSeconds - b.atSeconds)) {
    const at = event.atSeconds
    const side = event.side ?? event.killer?.side ?? event.by?.side ?? null
    const kind = kindOf(event)
    const same =
      event.kind === "OBJECTIVE" &&
      moments.find((other) => other.at === at && other.side === side && other.kind === kind)
    if (same) same.count += 1
    else
      moments.push({ at, second: null, side, team: side && teamOf(side), kind, count: 1, title: event.title ?? null })
  }
  return moments
}

/** A turn nobody timed is shown with the next one that is, or else as the draft is locked. */
function turnsOf(content: GameContent, teamOf: TeamOf): WatchTurn[] {
  const turns = [...(content.draft?.turns ?? [])].sort((a, b) => a.order - b.order)
  let next = content.draft?.lockedSecond ?? null
  const seconds = [...turns]
    .reverse()
    .map((turn) => (next = turn.atSecond ?? next))
    .reverse()
  return turns.map((turn, index) => ({
    order: turn.order,
    kind: turn.kind,
    side: turn.side,
    team: teamOf(turn.side),
    hero: turn.hero ?? null,
    second: seconds[index],
    own: turn.atSecond != null,
  }))
}

/** Pauses that hold the same second of the game are one. */
function pausesOf(content: GameContent): VodPause[] {
  const pauses: VodPause[] = []
  for (const { atSeconds, durationSeconds } of orderedPauses(content.timeline?.pauses)) {
    const last = pauses.at(-1)
    if (last?.atSeconds === atSeconds) last.durationSeconds += durationSeconds
    else pauses.push({ atSeconds, durationSeconds })
  }
  return pauses
}

function chapterOf(game: PublishedGame, index: number, teams: Story["teams"], fallback: string | null): Chapter {
  const { content } = game
  const [first, second] = teams ?? []
  const teamOf: TeamOf = (side) => (content.sides.find((item) => item.side === side)?.teamId === first ? "A" : "B")
  const sideOf = (team?: string) => content.sides.find((item) => item.teamId === team)?.side ?? null
  const link = linkOf(content.sourceUrl)
  const zero = link.video ? (content.sourceTimestampSeconds ?? null) : null
  const moments = momentsOf(content, teamOf)
  const last = moments.at(-1)
  const length = content.durationSeconds || (last ? last.at + 60 : null)
  const chapter: Chapter = {
    index,
    number: content.number,
    game,
    video: link.video ?? fallback,
    timing: zero != null && length ? "CLOCK" : zero == null && link.video && link.second > 0 ? "LINK" : "NONE",
    link: link.second,
    zero: null,
    length,
    pauses: pausesOf(content),
    draftStart: null,
    lock: null,
    end: null,
    parts: [],
    from: null,
    to: null,
    seconds: 0,
    span: null,
    moments,
    turns: turnsOf(content, teamOf),
    sides: { A: sideOf(first), B: sideOf(second) },
    winner: content.winner ? teamOf(content.winner) : null,
  }
  if (chapter.timing === "CLOCK") clockParts(chapter, zero!, length!)
  if (chapter.timing === "LINK") {
    chapter.end = link.second + (length ?? LINK_LENGTH) + WATCH.linkTail
    addPart(chapter, "GAME", link.second, chapter.end, "BREAK")
  }
  return chapter
}

function addPart(
  chapter: Chapter,
  kind: Chapter["parts"][number]["kind"],
  from: number,
  to: number,
  after: Chapter["parts"][number]["after"],
) {
  chapter.parts.push({ kind, from, to, at: 0, seconds: 0, after })
}

function clockParts(chapter: Chapter, zero: number, length: number) {
  const { startSecond: start = null, lockedSecond: lock = null } = chapter.game.content.draft ?? {}
  const second = (at: number) => gameToVideo(zero, chapter.pauses, at)
  chapter.zero = zero
  chapter.end = second(length)
  for (const moment of chapter.moments) moment.second = second(moment.at)
  if (start != null && start < zero && (lock == null || (lock > start && lock <= zero))) {
    chapter.draftStart = start
    chapter.lock = lock
  }
  const waited = chapter.lock != null && zero - chapter.lock >= WATCH.wait
  if (chapter.draftStart != null) {
    const from = leadIn(chapter.draftStart)
    addPart(chapter, "DRAFT", from, waited ? chapter.lock! + WATCH.tail : zero, waited ? "WAIT" : null)
  }
  let from = chapter.draftStart == null || waited ? leadIn(zero) : zero
  for (const pause of chapter.pauses) {
    if (pause.durationSeconds < WATCH.pause || pause.atSeconds >= length) continue
    const at = second(pause.atSeconds)
    addPart(chapter, "PLAY", from, at + WATCH.pauseHead, "PAUSE")
    from = at + pause.durationSeconds - WATCH.pauseTail
  }
  addPart(chapter, "PLAY", from, chapter.end + WATCH.tail, "BREAK")
}

function loseTimes(chapter: Chapter) {
  Object.assign(chapter, { timing: "NONE", zero: null, end: null, draftStart: null, lock: null, parts: [] })
  for (const moment of chapter.moments) moment.second = null
  for (const turn of chapter.turns) Object.assign(turn, { second: null, own: false })
}

/** No two games of a video overlap: the next one cuts the one before it, unless it would begin before that one did. */
function keepApart(chapters: Chapter[]) {
  const last = new Map<string, Chapter>()
  for (const chapter of chapters) {
    if (!chapter.parts.length || !chapter.video) continue
    const before = last.get(chapter.video)
    if (before) {
      const start = chapter.parts[0].from
      if (start <= (before.zero ?? before.parts[0].from)) {
        loseTimes(chapter)
        continue
      }
      before.parts = before.parts.filter((part) => part.from < start)
      const end = before.parts.at(-1)!
      end.to = Math.min(end.to, start)
      end.after = "BREAK"
      before.end = Math.min(before.end!, start)
    }
    last.set(chapter.video, chapter)
  }
}

/** Puts the parts one after another, and returns how long the story is. */
function inOrder(chapters: Chapter[]) {
  let at = 0
  for (const chapter of chapters) {
    if (!chapter.parts.length) continue
    const begins = at
    for (const part of chapter.parts) {
      part.at = at
      part.seconds = part.to - part.from
      at += part.seconds
    }
    chapter.from = chapter.parts[0].from
    chapter.to = chapter.parts.at(-1)!.to
    chapter.seconds = at - begins
  }
  return at
}

/** A game without a time stands in its video between the neighbours that have one. */
function placeUntimed(chapters: Chapter[]) {
  for (const chapter of chapters) {
    if (chapter.parts.length || !chapter.video) continue
    const near = (other: Chapter) => other.parts.length > 0 && other.video === chapter.video
    const before = lastOf(chapters.slice(0, chapter.index), near)
    const after = chapters.slice(chapter.index + 1).find(near)
    if (before || after) chapter.span = { from: before?.to ?? 0, to: after?.from ?? null }
  }
}

/**
 * The story of a match: a chapter for each game with the parts of video that tell it; breaks take no room. `source` is
 * the link of the series: often another video than that of its games, so it stands in only when no game has one.
 */
export function storyOf(games: PublishedGame[], source?: string | null): Story {
  const list = [...games].sort((a, b) => a.content.number - b.content.number)
  if (!list.length) {
    const { video } = linkOf(source)
    const videos = video ? [video] : []
    return { level: video ? "PLAIN" : "NONE", chapters: [], seconds: 0, bestOf: 0, teams: null, videos }
  }
  const { series } = list[0]
  const teams: Story["teams"] = [series.teamAId, series.teamBId]
  const own = list.some((game) => linkOf(game.content.sourceUrl).video)
  const fallback = own ? null : linkOf(source ?? series.sourceUrl).video
  const chapters = list.map((game, index) => chapterOf(game, index, teams, fallback))
  keepApart(chapters)
  const seconds = inOrder(chapters)
  placeUntimed(chapters)
  const has = (timing: Chapter["timing"]) => chapters.some((chapter) => chapter.timing === timing)
  const videos = [...new Set(chapters.flatMap(({ video }) => video ?? []))]
  const level = has("CLOCK") ? "TIMED" : has("LINK") ? "LINKED" : videos.length ? "PLAIN" : "NONE"
  return { level, chapters, seconds, bestOf: series.bestOf, teams, videos }
}

/** The game whose own video a video is; null where it shows several, or where its game is the only one recorded. */
export function gameAlone(chapters: Chapter[], video: string | null): Chapter | null {
  const games = video ? chapters.filter((chapter) => chapter.video === video) : []
  return games.length === 1 && chapters.length > 1 ? games[0] : null
}

/**
 * What a game's page can lead to: the game in the video, the video alone, or nothing. The games of its match tell where
 * a game without a time of its own stands, and whether its video is its own.
 */
export function gameWatch(game: PublishedGame, games: PublishedGame[] = [game]): "GAME" | "VIDEO" | null {
  const { chapters } = storyOf(games)
  const chapter = chapters.find((other) => other.game.id === game.id)
  if (!chapter?.video) return null
  return chapter.parts.length || chapter.span || gameAlone(chapters, chapter.video) ? "GAME" : "VIDEO"
}

/** A game whose every second is known in its video, or null: what its page shows of it can then be watched. */
export function timedGame(game: PublishedGame): TimedChapter | null {
  const [chapter] = storyOf([game]).chapters
  return timed(chapter) ? chapter : null
}
