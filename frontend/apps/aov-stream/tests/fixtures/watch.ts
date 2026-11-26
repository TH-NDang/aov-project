import type { DraftTurn, ObjectiveKind, PublishedGame, Side, TimelineEvent } from "@aov/community-contracts"
import { cutsOf } from "../../src/lib/watch-cuts.ts"
import { placeAt } from "../../src/lib/watch-place.ts"
import { CLOSED, type WatchView } from "../../src/lib/watch-store.ts"
import { storyOf } from "../../src/lib/watch-story.ts"
import type { Story, WatchMatch, WatchSide } from "../../src/lib/watch-types.ts"
import type { Say } from "../../src/lib/watch-words.ts"

/**
 * Real matches of 2026 as the video tells them: seconds, turns and moments. `turns` are kind, side and second of the
 * video ("BB685" is a ban of blue at 685), `moments` the second of the game, the side and the objective ("133Bd").
 */
export type TestGame = {
  number: number
  /** The team of the blue side: the first or the second of the series. */
  blue: "a" | "b"
  winner: Side | null
  seconds: number | null
  zero: number | null
  draft: [start: number, lock: number] | null
  pauses?: [at: number, seconds: number][]
  link: string
  turns?: string
  moments?: string
}

const KINDS: Record<string, ObjectiveKind> = {
  t: "TURRET",
  d: "ABYSSAL_DRAGON",
  s: "DARK_SLAYER",
  b: "BASE",
  o: "OTHER",
}
const LANES = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"] as const
const mapSide = (letter: string): Side => (letter === "B" ? "BLUE" : "RED")

const turnsOf = (game: TestGame): DraftTurn[] =>
  (game.turns ?? "")
    .split(" ")
    .filter(Boolean)
    .map((turn, index) => ({
      order: index + 1,
      kind: turn[0] === "B" ? "BAN" : "PICK",
      side: mapSide(turn[1]!),
      hero: { id: `g${game.number}t${index + 1}` },
      atSecond: turn.length > 2 ? Number(turn.slice(2)) : null,
    }))

const momentsOf = (game: TestGame): TimelineEvent[] =>
  (game.moments ?? "")
    .split(" ")
    .filter(Boolean)
    .map((moment, index) => ({
      id: `m${index}`,
      atSeconds: Number.parseInt(moment, 10),
      kind: "OBJECTIVE",
      side: mapSide(moment.at(-2)!),
      objective: KINDS[moment.at(-1)!]!,
    }))

/** The published games of a test match; what a test does not read is absent. */
export function watchGames(games: TestGame[], bestOf: number, series: object = {}): PublishedGame[] {
  return games.map((game) => {
    const turns = turnsOf(game)
    const picks = (letter: Side) => turns.filter((turn) => turn.kind === "PICK" && turn.side === letter)
    return {
      id: `game-${game.number}`,
      content: {
        seriesId: "series",
        number: game.number,
        durationSeconds: game.seconds,
        winner: game.winner,
        sourceUrl: game.link,
        sourceTimestampSeconds: game.zero,
        sides: (["BLUE", "RED"] as const).map((letter) => ({
          side: letter,
          teamId: (letter === "BLUE") === (game.blue === "a") ? "a" : "b",
          bans: [],
          participants: picks(letter).map((turn, index) => ({ lane: LANES[index], hero: turn.hero })),
        })),
        draft: game.draft ? { startSecond: game.draft[0], lockedSecond: game.draft[1], turns } : { turns },
        timeline: {
          pauses: (game.pauses ?? []).map(([atSeconds, durationSeconds]) => ({ atSeconds, durationSeconds })),
          events: momentsOf(game),
        },
      },
      series: { teamAId: "a", teamBId: "b", bestOf, ...series },
    } as unknown as PublishedGame
  })
}

/** SGP 4–2 BME, AOG Winter 2026, upper semi-final: every second known, one video of 13504 s. */
export const SGP_BME: TestGame[] = [
  {
    number: 1,
    blue: "b",
    winner: "RED",
    seconds: 883,
    zero: 1546,
    draft: [667, 975],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB685 BR700 BB701 BR707 PB713 PR744 PR744 PB775 PB775 PR796 BR811 BB821 BR831 BB838 PR852 PB899 PB899 PR917",
    moments:
      "137Bs 232Rd 279Bt 279Rt 302Bt 338Rt 361Bd 379Bt 462Rt 503Rs 503Rs 533Rd 545Rt 550Rt 698Rs 716Bt 728Rt 745Rd 793Rt 834Rt 840Rt",
  },
  {
    number: 2,
    blue: "a",
    winner: "RED",
    seconds: 802,
    zero: 3718,
    draft: [3154, 3490],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB3166 BR3181 BB3193 BR3216 PB3241 PR3277 PR3277 PB3309 PB3309 PR3323 BR3337 BB3344 BR3353 BB3363 PR3374 PB3404 PB3404 PR3430",
    moments: "133Bd 275Rt 292Rs 340Rt 381Rd 410Rs 422Bt 434Rt 505Bd 505Rs 529Rt 582Rt 670Rt 700Rs 747Bd 794Rt",
  },
  {
    number: 3,
    blue: "b",
    winner: "RED",
    seconds: 596,
    zero: 5875,
    draft: [5363, 5811],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB5393 BR5404 BB5413 BR5425 PB5453 PR5501 PR5501 PB5529 PB5529 PR5554 BR5565 BB5583 BR5605 BB5640 PR5669 PB5727 PB5727 PR5753",
    moments: "138Bs 173Rd 327Rt 333Rd 380Rt 403Rt 433Rt 433Rt 492Rs 492Rs 527Rd 563Rt 581Rt",
  },
  {
    number: 4,
    blue: "b",
    winner: "RED",
    seconds: 676,
    zero: 7490,
    draft: [7040, 7400],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB7057 BR7075 BB7089 BR7101 PB7114 PR7150 PR7150 PB7199 PB7199 PR7210 BR7232 BB7244 BR7256 BB7275 PR7302 PB7326 PB7326 PR7341",
    moments: "129Bd 276Rt 323Rs 323Rs 341Rt 400Rt 412Rt 418Rd 430Rt 465Rt 489Rt 507Rs 548Rd 648Rt 660Rt",
  },
  {
    number: 5,
    blue: "a",
    winner: "RED",
    seconds: 1196,
    zero: 9275,
    draft: [8782, 9207],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB8795 BR8827 BB8844 BR8863 PB8891 PR8916 PR8916 PB8952 PB8952 PR8993 BR8994 BB9006 BR9021 BB9051 PR9100 PB9132 PB9132 PR9147",
    moments: "127Bs 133Rd 316Bt 316Rt 322Rd 322Bs 434Bt 499Bd 546Bt 558Bt 617Bs 652Bt 664Bt 729Rd 753Rt",
  },
  {
    number: 6,
    blue: "a",
    winner: "BLUE",
    seconds: 617,
    zero: 11617,
    draft: [11239, 11546],
    link: "https://www.youtube.com/watch?v=j8AvYygkzm4",
    turns:
      "BB11273 BR11282 BB11304 BR11321 PB11340 PR11385 PR11385 PB11402 PB11402 PR11414 BR11424 BB11434 BR11444 BB11451 PR11460 PB11479 PB11479 PR11491",
    moments: "130Bd 230Bs 295Bt 307Bt 331Bt 349Bd 372Bt 384Bt 384Bt 419Bs 473Bt 490Bs 532Bd 597Bt",
  },
]
/** FPL–1S: the first game has no times. */
export const FPL_1S: TestGame[] = [
  {
    number: 1,
    blue: "a",
    winner: "BLUE",
    seconds: 805,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/watch?v=eu3SeSNq2gY",
  },
  {
    number: 2,
    blue: "a",
    winner: "BLUE",
    seconds: 656,
    zero: 2992,
    draft: [2383, 2906],
    link: "https://www.youtube.com/watch?v=eu3SeSNq2gY",
  },
  {
    number: 3,
    blue: "a",
    winner: "BLUE",
    seconds: 942,
    zero: 5091,
    draft: [4564, 5014],
    link: "https://www.youtube.com/watch?v=eu3SeSNq2gY",
  },
]
/** BRU–eA: a pause in game 5, and game 6 has no times. */
export const BRU_EA: TestGame[] = [
  {
    number: 1,
    blue: "b",
    winner: "RED",
    seconds: 1290,
    zero: 31704,
    draft: [31144, 31625],
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
  {
    number: 2,
    blue: "b",
    winner: "RED",
    seconds: 1269,
    zero: 33955,
    draft: [33580, 33859],
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
  {
    number: 3,
    blue: "a",
    winner: "BLUE",
    seconds: 831,
    zero: 36919,
    draft: [36504, 36824],
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
  {
    number: 4,
    blue: "b",
    winner: "BLUE",
    seconds: 1134,
    zero: 38889,
    draft: [38305, 38743],
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
  {
    number: 5,
    blue: "a",
    winner: "RED",
    seconds: 1491,
    zero: 41057,
    draft: [40566, 41001],
    pauses: [[721, 180]],
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
  {
    number: 6,
    blue: "b",
    winner: "RED",
    seconds: 1076,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/watch?v=IHQBJayxnLM",
  },
]
/** HKA–LIT: only the links carry a second. */
export const HKA_LIT: TestGame[] = [
  {
    number: 1,
    blue: "b",
    winner: "BLUE",
    seconds: 1313,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/live/WgQTfXMV13A?si=n0wQGUST8J0BowYd&t=2776",
  },
  {
    number: 2,
    blue: "b",
    winner: "RED",
    seconds: 1210,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/live/WgQTfXMV13A?si=e9GF8dx7b-6eDNyv&t=5869",
  },
  {
    number: 3,
    blue: "b",
    winner: "RED",
    seconds: 798,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/live/WgQTfXMV13A?si=gcWGE1AKVZL2tBFn&t=8548",
  },
  {
    number: 4,
    blue: "a",
    winner: "RED",
    seconds: 863,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/live/WgQTfXMV13A?si=vv5h2drUNEWjfVdN&t=10563",
  },
  {
    number: 5,
    blue: "b",
    winner: "BLUE",
    seconds: 710,
    zero: null,
    draft: null,
    link: "https://www.youtube.com/live/WgQTfXMV13A?si=LNjBm2b2spAw6FTP&t=12503",
  },
]
/** The first three games of SGP–BME, as if nobody had timed the second. */
export const UNTIMED_MIDDLE: TestGame[] = [
  SGP_BME[0]!,
  { ...SGP_BME[1]!, zero: null, draft: null, turns: "", moments: "" },
  SGP_BME[2]!,
]
/** The games of HKA–LIT with a link that names the video alone. */
export const UNTIMED: TestGame[] = HKA_LIT.map((game) => ({ ...game, link: game.link.replace(/&t=\d+/, "") }))

/** Both languages, as `text` of the app picks them. */
export const vi: Say = (vietnamese) => vietnamese
export const en: Say = (_, english) => english

const side = (name: string, shortName: string): WatchSide => ({
  id: shortName.toLowerCase(),
  name,
  shortName,
  logoUrl: null,
  logoDarkUrl: null,
})

export function matchOf(story: Story, known: Partial<WatchMatch> = {}): WatchMatch {
  const teams = { A: side("Saigon Phantom", "SGP"), B: side("BOOM Esports", "BME") }
  const cuts = cutsOf(story)
  const before = { A: 0, B: 0 }
  return { seriesId: "s", href: "/matches/s", teams, story, cuts, before, live: false, finished: true, ...known }
}

/** A finished match of test games that can be watched. */
export function watchMatch(games: TestGame[], bestOf: number, known: Partial<WatchMatch> = {}): WatchMatch {
  return matchOf(storyOf(watchGames(games, bestOf)), known)
}

/** The open match with its first video at a second. */
export function viewAt(match: WatchMatch, second: number, known: Partial<WatchView> = {}): WatchView {
  const { story } = match
  const [video] = story.videos
  const place = story.level === "PLAIN" ? null : placeAt(story, video!, second)
  return { ...CLOSED, match, video: video!, second, player: "PLAYING", place, ...known }
}
