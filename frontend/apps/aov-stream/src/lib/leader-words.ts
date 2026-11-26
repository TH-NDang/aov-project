import type { Leader } from "./facts-model.ts"
import { shownText } from "./feed-words.ts"
import type { Counted } from "./game-feed.ts"
import { enoughPicks, type HeroLine } from "./hero-model.ts"
import { wonShare } from "./heroes-view.ts"

type Say = (vi: string, en: string) => string
type Names = readonly [vi: string, en: string]

/** Words of which some are stressed: those between two asterisks. */
export const stressed = (words: string) =>
  words
    .split("*")
    .map((part, at) => ({ part, strong: at % 2 === 1 }))
    .filter(({ part }) => part)

/** The first three places of each thing a hero can lead by. */
const PICKED: Names[] = [
  ["Được chọn nhiều nhất", "Most picked"],
  ["Được chọn nhiều thứ hai", "Second most picked"],
  ["Được chọn nhiều thứ ba", "Third most picked"],
]
const BANNED: Names[] = [
  ["Bị cấm nhiều nhất", "Most banned"],
  ["Bị cấm nhiều thứ hai", "Second most banned"],
  ["Bị cấm nhiều thứ ba", "Third most banned"],
]
const WINNING: Names[] = [
  ["Tỷ lệ thắng cao nhất", "Highest win rate"],
  ["Tỷ lệ thắng cao thứ hai", "Second highest win rate"],
  ["Tỷ lệ thắng cao thứ ba", "Third highest win rate"],
]

/** The name of the place behind as many heroes as `ahead`. */
const placed = (names: Names[], ahead: number, text: Say) => text(...names[Math.min(ahead, names.length - 1)]!)

const decided = ({ wins, losses }: HeroLine) => wins + losses
const rate = (line: HeroLine) => (decided(line) ? line.wins / decided(line) : 0)

/** The share of the games a hero was left open in that has to be picked before "banned or picked" is said of it. */
const NEARLY_ALWAYS = 0.9

/**
 * The place of a hero by the share of games it won. Any hero that won its only game has a higher share, so the title
 * says from how many games on it holds: the fewest that leave out the shorter records above it.
 */
function winningTitle(line: HeroLine, lines: HeroLine[], games: number, text: Say) {
  const above = lines.filter((other) => rate(other) > rate(line))
  const shorter = above.filter((other) => decided(other) < decided(line))
  const title = placed(WINNING, above.length - shorter.length, text)
  if (!shorter.length) return title
  const from = Math.max(enoughPicks(games), ...shorter.map((other) => decided(other) + 1))
  return `${title}, ${text(`từ ${from} ván`, `${from} games or more`)}`
}

/** What a hero leads by, in words that hold among all the `lines` of its competition. */
export function leaderTitle({ kind, line }: Leader, lines: HeroLine[], { games, shown }: Counted, text: Say): string {
  if (kind === "PICKED") return placed(PICKED, lines.filter(({ picks }) => picks > line.picks).length, text)
  if (kind === "BANNED") return placed(BANNED, lines.filter(({ bans }) => bans > line.bans).length, text)
  if (kind === "WINNING") return winningTitle(line, lines, games, text)
  const open = shown - line.bans
  const taken = line.seen - line.bans
  return line.bans > taken && open > 0 && taken >= NEARLY_ALWAYS * open
    ? text("Không cấm thì chọn", "Banned or picked")
    : text("Có mặt nhiều nhất", "Seen most often")
}

type Figure = (value: number) => string

/** What became of a hero in the games that show their bans: only there what was not banned was left open. */
function presentFact(line: HeroLine, counted: Counted, text: Say, figure: Figure) {
  const { bans, presence, seen } = line
  const { shown } = counted
  const picks = line.picks - (presence - seen)
  const only = shownText(counted, text)
  const [all, present, banned, picked] = [shown, seen, bans, picks].map(figure)
  // A hero both teams took in one game is seen in fewer games than it was picked and banned.
  if (picks + bans !== seen)
    return text(`có mặt *${present}* trong ${all} ván${only}`, `seen in *${present}* of ${all} games${only}`)
  if (!bans)
    return picks === shown
      ? text(`được chọn ở cả *${all}* ván${only}, không ai cấm`, `picked in all *${all}* games${only}, never banned`)
      : text(
          `được chọn *${picked}* trong ${all} ván${only}, không ai cấm`,
          `picked in *${picked}* of ${all} games${only}, never banned`,
        )
  const open = shown - bans
  if (!open) return text(`bị cấm ở cả *${all}* ván${only}`, `banned in all *${all}* games${only}`)
  const first = text(`bị cấm *${banned}* trong ${all} ván${only}`, `banned in *${banned}* of ${all} games${only}`)
  // Elsewhere it may have been picked all the same.
  if (!picks && line.picks) return first
  const left = figure(open)
  const rest = !picks
    ? text("không đội nào chọn", "never picked")
    : picks < open
      ? text(`${left} ván còn lại thì *${picked}* ván được chọn`, `picked in *${picked}* of the other ${left}`)
      : open === 1
        ? text("ván còn lại được chọn", "picked in the other one")
        : text(`*${left}* ván còn lại đều được chọn`, `picked in all *${left}* others`)
  return `${first}, ${rest}`
}

function pickedFact(line: HeroLine, text: Say, figure: Figure) {
  const { picks, wins, losses } = line
  const played = text(`*${figure(picks)}* ván`, `*${figure(picks)}* ${picks === 1 ? "game" : "games"}`)
  if (!decided(line)) return played
  if (!wins) return `${played}, ${text("chưa thắng ván nào", "none of them won")}`
  if (!losses && wins === picks) return `${played}, ${text("thắng tất cả", "all of them won")}`
  return `${played}, ${text(`thắng *${figure(wins)}*`, `won *${figure(wins)}*`)}`
}

function winningFact(line: HeroLine, text: Say, figure: Figure) {
  const [won, all] = [line.wins, decided(line)].map(figure)
  if (!line.losses) return text(`thắng cả *${all}* ván`, `won all *${all}* games`)
  const share = wonShare(line)
  const record = text(`thắng *${won}* trong ${all} ván`, `won *${won}* of ${all} games`)
  return share ? `${record}, ${text(`tức *${share}*`, `*${share}*`)}` : record
}

function bannedFact({ picks, bans }: HeroLine, counted: Counted, text: Say, figure: Figure) {
  const [all, banned, picked, games] = [counted.shown, bans, picks, counted.games].map(figure)
  const only = shownText(counted, text)
  const record =
    bans === counted.shown
      ? text(`bị cấm ở cả *${all}* ván${only}`, `banned in all *${all}* games${only}`)
      : text(`bị cấm *${banned}* trong ${all} ván${only}`, `banned in *${banned}* of ${all} games${only}`)
  // The picks are those of every game.
  const of = only && text(` trong cả ${games} ván`, ` of all ${games}`)
  return picks ? `${record}, ${text(`được chọn *${picked}*`, `picked in *${picked}*`)}${of}` : record
}

/** What a hero leads by in one sentence of counts; the numbers it is about are stressed. */
export function leaderFact({ kind, line }: Leader, counted: Counted, text: Say, languageTag: string): string {
  const figure: Figure = (value) => value.toLocaleString(languageTag)
  if (kind === "PRESENT") return presentFact(line, counted, text, figure)
  if (kind === "PICKED") return pickedFact(line, text, figure)
  if (kind === "WINNING") return winningFact(line, text, figure)
  return bannedFact(line, counted, text, figure)
}
