import type { Lane } from "@aov/community-contracts"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import type { Counted, FeedPeriod } from "./game-feed.ts"
import { stageName } from "./match-labels.ts"
import { labelWeeks } from "./play-weeks.ts"
import { LANE_NAMES } from "./tournament-model.ts"

type Say = (vi: string, en: string) => string

/** A period as a reader names it: its stage, or the weeks or the update it covers. */
export function periodName(
  { stage, patch }: Pick<FeedPeriod, "stage" | "patch">,
  text: Say,
  languageTag: string,
): string {
  if (!patch) return stageName(stage.name)
  const weeks = labelWeeks(patch.label)
  if (!weeks) {
    const day = patch.releasedOn && formatCalendarDate(patch.releasedOn, undefined, languageTag)
    return patch.label || patch.name || (day ? text(`Bản ${day}`, `Patch of ${day}`) : stageName(stage.name))
  }
  const [from, to] = weeks
  return from === to ? text(`Tuần ${from}`, `Week ${from}`) : text(`Tuần ${from}–${to}`, `Weeks ${from}–${to}`)
}

export const laneName = (lane: Lane, text: Say) => text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])

/** A number of games in words. */
export const gamesText = (count: number, text: Say, languageTag: string) => {
  const figure = count.toLocaleString(languageTag)
  return text(`${figure} ván`, `${figure} ${count === 1 ? "game" : "games"}`)
}

/** What narrows the games a number is out of to those that show their bans; nothing where all of them do. */
export const shownText = ({ games, shown }: Counted, text: Say) =>
  shown < games ? text(" có ghi lượt cấm", " that record bans") : ""

/** How many of some matches, in words. */
export const ofMatches = (count: number, matches: number, text: Say) =>
  text(`${count} trong ${matches} trận`, `${count} of ${matches} ${matches === 1 ? "match" : "matches"}`)

/** Games won and lost, in words. */
export const recordText = ({ wins, losses }: { wins: number; losses: number }, text: Say) =>
  text(`thắng ${wins}, thua ${losses} ván`, `won ${wins}, lost ${losses} ${losses === 1 ? "game" : "games"}`)

/** Games won and lost, the way a table reads them. */
export const score = ({ wins, losses }: { wins: number; losses: number }) => `${wins}–${losses}`
