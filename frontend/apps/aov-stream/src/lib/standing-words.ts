import type { CompetitionStanding } from "@aov/community-contracts"
import { bracketRoundName, type BracketRound } from "./bracket-model.ts"
import { capital } from "./capital.ts"
import { stageName } from "./match-labels.ts"
import { dayMonth } from "./match-time.ts"
import type { PlaceWay, PlaceZone } from "./place-zones.ts"
import type { StandingStep } from "./standings-steps.ts"

type Say = (vi: string, en: string) => string

/** A name inside a sentence: "Semifinal" reads "semifinal", while "Playoffs" and other names keep their capital. */
function within(name: string, languageTag: string) {
  return /^(?:vòng|bảng|nhánh|giai đoạn|chung kết|bán kết|tứ kết|tranh|stage|round)(?=\s|$)/iu.test(name)
    ? name.charAt(0).toLocaleLowerCase(languageTag) + name.slice(1)
    : name
}

/** Whether a round of a bracket without lanes has a number for a name, which says too little on its own. */
const numbered = ({ lane, left, matches }: BracketRound) =>
  lane === "rounds" &&
  !((left === 0 && matches === 1) || (left === 1 && matches === 2) || (left === 2 && matches === 4))

/** The place a way leads to, inside a sentence; `full` names the stage of a round too. */
function target(way: PlaceWay, languageTag: string, full: boolean) {
  if (way.kind === "STAGE") return within(stageName(way.stage.name), languageTag)
  if (way.kind !== "ROUND") return ""
  const name = bracketRoundName(way.round, languageTag)
  const round = name.charAt(0).toLocaleLowerCase(languageTag) + name.slice(1)
  return full || numbered(way.round) ? `${round} ${stageName(way.stage.name)}` : round
}

/**
 * Where a place leads, in words: "Into the upper bracket semifinal". While the table can still change nobody goes
 * anywhere yet, so the words name the group of places: "Places into the upper bracket semifinal".
 */
export function wayWords(way: PlaceWay, final: boolean, text: Say, languageTag: string, full = false): string {
  if (way.kind === "ON") return final ? text("Đi tiếp", "Go on") : text("Nhóm đi tiếp", "Places that go on")
  if (way.kind === "OUT") return final ? text("Dừng bước", "Out") : text("Nhóm dừng bước", "Places that go out")
  const name = target(way, languageTag, full)
  return final ? text(`Vào ${name}`, `Into the ${name}`) : text(`Nhóm vào ${name}`, `Places into the ${name}`)
}

/** The words of every zone of a table; a round two stages share is told apart by its stage. */
export function zoneWords(zones: PlaceZone[], final: boolean, text: Say, languageTag: string): string[] {
  const words = zones.map(({ way }) => wayWords(way, final, text, languageTag))
  return words.map((word, index) =>
    words.indexOf(word) === index && words.lastIndexOf(word) === index
      ? word
      : wayWords(zones[index]!.way, final, text, languageTag, true),
  )
}

/** What becomes of a team, after its name in a sentence: "go on", "go into the upper bracket final", "are out". */
export function wayPredicate(way: PlaceWay, text: Say, languageTag: string): string {
  if (way.kind === "ON") return text("đi tiếp", "go on")
  if (way.kind === "OUT") return text("dừng bước", "are out")
  const name = target(way, languageTag, false)
  return text(`vào ${name}`, `go into the ${name}`)
}

/** The places of a zone in words. */
export const placesWords = ({ from, to }: Pick<PlaceZone, "from" | "to">, text: Say) =>
  from === to ? text(`hạng ${from}`, `place ${from}`) : text(`hạng ${from}–${to}`, `places ${from}–${to}`)

type Step = Pick<StandingStep, "key" | "kind" | "number">

/** A step inside a sentence: "round 12", "week 3", "09/20". */
function stepName({ key, kind, number }: Step, text: Say, languageTag: string) {
  if (kind === "ROUND") return text(`vòng ${number}`, `round ${number}`)
  if (kind === "WEEK") return text(`tuần ${number}`, `week ${number}`)
  if (kind === "MATCHDAY") return text(`ngày thi đấu ${number}`, `matchday ${number}`)
  return text(`ngày ${dayMonth(key, languageTag)}`, dayMonth(key, languageTag))
}

/** When a table was as it is shown. A step that is still being played is not over, so it is named as such. */
export function stepWords(step: Step, underWay: boolean, text: Say, languageTag: string): string {
  const name = stepName(step, text, languageTag)
  if (underWay) return text(`Đang đấu ${name}`, `During ${name}`)
  return step.kind === "DAY" || step.kind === "MATCHDAY"
    ? text(`Hết ${name}`, `After ${name}`)
    : text(`Sau ${name}`, `After ${name}`)
}

/** The heading over the matches of a step. */
export function stepMatchesWords(step: Step, text: Say, languageTag: string): string {
  const name = stepName(step, text, languageTag)
  return text(`Các trận ${name}`, `Matches of ${name}`)
}

/**
 * What a match under the heading of its step still says of its round: nothing of what that heading or the one of its
 * stage says already.
 */
export function roundUnderStep(
  round: string | null,
  step: Step,
  stage: string,
  text: Say,
  languageTag: string,
): string | null {
  const said = [stepName(step, text, languageTag), stageName(stage)].map((name) => name.toLocaleLowerCase(languageTag))
  const rest = (round?.split(", ") ?? []).filter((part) => !said.includes(part.toLocaleLowerCase(languageTag)))
  return rest.length ? capital(rest.join(", ")) : null
}

/** The days of a step: one, two, or the first and the last of more; nothing where the plan dates no match. */
export function stepDays({ kind, days }: Pick<StandingStep, "kind" | "days">, languageTag: string): string {
  // A step that is a day is named by it already.
  if (kind === "DAY") return ""
  const [first, last] = [days[0], days.at(-1)]
  if (!first || !last) return ""
  if (days.length > 2) return `${dayMonth(first, languageTag)} – ${dayMonth(last, languageTag)}`
  return days.map((day) => dayMonth(day, languageTag)).join(", ")
}

/** What a step is called where there is only room for its number or its date. */
export const stepMark = ({ key, kind, number }: Step, languageTag: string) =>
  kind === "DAY" ? dayMonth(key, languageTag) : String(number)

/** How many places a team moved, for those who do not see the arrow; empty for a team that stayed. */
export function movementWords(moved: number, text: Say): string {
  const places = Math.abs(moved)
  if (!places) return ""
  return moved > 0
    ? text(`lên ${places} hạng`, `up ${places} ${places === 1 ? "place" : "places"}`)
    : text(`xuống ${places} hạng`, `down ${places} ${places === 1 ? "place" : "places"}`)
}

/** The place of a team in its table; a team that has not played has none yet. */
export const placeFigure = ({ rank, played }: Pick<CompetitionStanding, "rank" | "played">) =>
  played > 0 ? String(rank) : "–"

/** A difference with its sign. */
export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : "0")

/** A group of a table by its letter, or by its number where the plan names none. */
export const groupWords = (name: string, text: Say) =>
  /^[A-Z]$/.test(name) ? text(`Bảng ${name}`, `Group ${name}`) : text(`Nhóm ${name}`, `Group ${name}`)
