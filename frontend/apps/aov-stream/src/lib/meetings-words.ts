import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { planZone } from "./match-model.ts"
import { dayMonth, dayMonthInZone } from "./match-time.ts"
import { isOverdue, meetingOutcome, meetingScore, type Meeting, type MeetingRound } from "./meetings-model.ts"
import type { Names } from "./question-words.ts"

type Say = (vi: string, en: string) => string

/** Games won and lost, the way a table reads them. */
export const figures = ({ own, rival }: Pick<Meeting, "own" | "rival">) => `${own}–${rival}`

/** The day a match is planned for, in the reader's zone; null while it has none. */
export function meetingDay({ entry }: Pick<Meeting, "entry">, timeZone: string, languageTag: string): string | null {
  const at = Date.parse(entry.match.scheduledAt || "")
  return Number.isNaN(at) ? null : dayMonthInZone(at, timeZone, languageTag)
}

/** The day a match was played on, on the calendar where the event is held; null while it has none. */
export function playedDay({ entry }: Pick<Meeting, "entry">, languageTag: string): string | null {
  const { match, competition } = entry
  const day = dayKeyInZone(match.scheduledAt, planZone(competition.content.plan))
  return day ? dayMonth(day, languageTag) : null
}

/** What became of a match, as one of its teams says it; one without a score says what it waits for. */
export function meetingWords(meeting: Meeting, day: string | null, text: Say, now = Date.now()): string {
  const outcome = meetingOutcome(meeting)
  if (!outcome) {
    if (!day) return text("chưa có lịch", "not scheduled yet")
    return isOverdue(meeting, now)
      ? text(`chưa có kết quả, ngày ${day}`, `no result yet, ${day}`)
      : text(`chưa đấu, ngày ${day}`, `to be played, ${day}`)
  }
  const score = figures(meeting)
  if (outcome === "won") return text(`thắng ${score}`, `won ${score}`)
  if (outcome === "lost") return text(`thua ${score}`, `lost ${score}`)
  return meeting.own === meeting.rival ? text(`hòa ${score}`, `level at ${score}`) : text(`tỷ số ${score}`, score)
}

export const pairName = (teamId: string, opponentId: string, names: Names, text: Say) =>
  text(`${names.team(teamId)} gặp ${names.team(opponentId)}`, `${names.team(teamId)} against ${names.team(opponentId)}`)

/** Everything a cell of two teams says, in words: who met whom, each match in order, and what they add up to. */
export function pairWords(
  teamId: string,
  list: Meeting[],
  { names, text, timeZone, languageTag }: { names: Names; text: Say; timeZone: string; languageTag: string },
): string {
  const opponentId = list[0]?.opponentId ?? ""
  const score = meetingScore(list)
  const said = list.map((meeting) => meetingWords(meeting, meetingDay(meeting, timeZone, languageTag), text))
  if (score.played > 1) said.push(text(`cộng lại ${figures(score)}`, `${figures(score)} in all`))
  return `${pairName(teamId, opponentId, names, text)}: ${said.join(", ")}`
}

/** What a column of the ways of the teams is called. */
export function roundName({ kind, number }: Pick<MeetingRound, "kind" | "number">, text: Say): string {
  if (kind === "ROUND") return text(`Vòng ${number}`, `Round ${number}`)
  if (kind === "WEEK") return text(`Tuần ${number}`, `Week ${number}`)
  if (kind === "MATCHDAY") return text(`Ngày ${number}`, `Day ${number}`)
  return text(`Lượt ${number}`, `Match ${number}`)
}
