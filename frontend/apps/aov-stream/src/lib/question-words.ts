import type { CompetitionView, Lane } from "@aov/community-contracts"
import { soleHero, type Condition, type Question } from "./finder-model.ts"
import { lengthOf } from "./found-model.ts"
import type { FeedHero } from "./game-feed.ts"
import { dayMonth } from "./match-time.ts"

type Say = (vi: string, en: string) => string

/** What a page says for the names of a competition. */
export type Names = { team: (id: string) => string; player: (id: string) => string }

export const namesOf = ({ content }: CompetitionView, text: Say): Names => ({
  team: (id) => content.teams[id]?.shortName || content.teams[id]?.name || text("đội chưa rõ", "unknown team"),
  player: (id) => content.players[id]?.nickname || text("tuyển thủ chưa rõ", "unknown player"),
})

/** Heroes by name in one row, with commas and one "and" before the last. */
export function heroNames(heroes: Pick<FeedHero, "name">[], text: Say): string {
  const names = heroes.map(({ name }) => name)
  const last = names.pop() ?? ""
  const before = names.join(", ")
  return before ? text(`${before} và ${last}`, `${before} and ${last}`) : last
}

/** A lane inside a sentence; the names of lanes keep their capitals. */
export const LANE_WORDS: Record<Lane, readonly [string, string]> = {
  TOP: ["đường Caesar", "in the Dark Slayer lane"],
  JUNGLE: ["đi rừng", "in the jungle"],
  MID: ["đường giữa", "in the mid lane"],
  DRAGON: ["đường Rồng", "in the Abyssal Dragon lane"],
  SUPPORT: ["hỗ trợ", "as support"],
}

/** A length in words: one of those offered, or the minutes asked for. */
export function lengthWords({ min, max }: Pick<Question, "min" | "max">, text: Say): string {
  const offered = lengthOf({ min, max })
  if (max != null && min == null) return text(`dưới ${max + 1} phút`, `under ${max + 1} minutes`)
  if (min != null && max == null) return text(`từ ${min} phút`, `${min} minutes or more`)
  if (min != null && min === max) return text(`dài ${min} phút`, `${min} minutes long`)
  const to = (max ?? 0) + (offered ? 1 : 0)
  return text(`${min}–${to} phút`, `${min}–${to} minutes`)
}

function dayWords({ from, to }: Pick<Question, "from" | "to">, text: Say, languageTag: string): string {
  const day = (key: string) => dayMonth(key, languageTag)
  if (from && from === to) return text(`ngày ${day(from)}`, `on ${day(from)}`)
  return [from && text(`từ ${day(from)}`, `from ${day(from)}`), to && text(`đến ${day(to)}`, `to ${day(to)}`)]
    .filter(Boolean)
    .join(" ")
}

const sideWords = (side: NonNullable<Question["side"]>, text: Say) =>
  side === "BLUE" ? text("bên xanh", "on the blue side") : text("bên đỏ", "on the red side")

/** Side A of a question: who played, for whom, or what. Empty while it asks for nobody there. */
function ownWords({ team, pick, player }: Question, names: Names, text: Say): string {
  const own = team ? names.team(team) : ""
  const who = player ? names.player(player) : ""
  const heroes = heroNames(pick, text)
  if (!heroes) return own && who ? text(`${own} có ${who}`, `${own} with ${who}`) : own || who
  if (who && pick.length === 1)
    return own
      ? text(`${who} chơi ${heroes} cho ${own}`, `${who} playing ${heroes} for ${own}`)
      : text(`${who} chơi ${heroes}`, `${who} playing ${heroes}`)
  const played = own ? text(`${own} chơi ${heroes}`, `${own} playing ${heroes}`) : heroes
  return who ? text(`${played}, có ${who}`, `${played}, with ${who}`) : played
}

/** Who a question is about, in a few words: what side A is, and what it met. Empty while it tells no sides apart. */
export function partiesWords(question: Question, names: Names, text: Say): string {
  const { team, opp, pick, vs, player } = question
  const own = ownWords(question, names, text)
  const met = heroNames(vs, text)
  const other = opp ? names.team(opp) : ""
  const rival = met && other ? text(`${met} của ${other}`, `${met} of ${other}`) : met || other
  if (rival)
    return own ? text(`${own} gặp ${rival}`, `${own} against ${rival}`) : text(`gặp ${rival}`, `against ${rival}`)
  return pick.length > 1 && !team && !player ? text(`${own} cùng đội`, `${own} on one team`) : own
}

/** Who the score of a question belongs to: whoever side A is called by first. */
export function scoredParty({ team, pick, player }: Question, names: Names, text: Say): string {
  if (player) return names.player(player)
  if (team) return names.team(team)
  return heroNames(pick, text) || text("Đội này", "This side")
}

/** Whether a question is about one team, or one player, and whatever it met, picked or banned is left open. */
const isBare = ({ team, opp, pick, vs, player }: Question) =>
  !pick.length && !vs.length && !opp && !!(team ? !player : player)

function mainWords(question: Question, names: Names, text: Say): string {
  const { team, opp, ban, banA, banB, player, mvp, lane } = question
  const bare = isBare(question)
  const banned = (who: string, heroes: FeedHero[]) =>
    text(`${who} cấm ${heroNames(heroes, text)}`, `${who} banning ${heroNames(heroes, text)}`)
  // A team that is only asked for a ban of its own is named once.
  const acts = bare && team && banA.length > 0
  const own =
    bare && player && mvp && !lane
      ? text(`${names.player(player)} là MVP`, `${names.player(player)} as the MVP`)
      : partiesWords(question, names, text)
  const parties = acts ? banned(names.team(team), banA) : own
  const bans = [
    ban.length && text(`${heroNames(ban, text)} bị cấm`, `${heroNames(ban, text)} banned`),
    !acts && banA.length && banned(team ? names.team(team) : text("đội này", "this side"), banA),
    banB.length && banned(opp ? names.team(opp) : text("đối thủ", "the opponent"), banB),
  ].filter(Boolean)
  const when = bans.join(text(" và ", " and "))
  return parties && when ? text(`${parties} khi ${when}`, `${parties} with ${when}`) : parties || when
}

/**
 * A question as one sentence without its number: who met whom, what was banned, then the rest in short parts. It is
 * the heading of the answer, the title of the page and what a screen reader hears.
 */
export function questionWords(question: Question, names: Names, text: Say, languageTag: string): string {
  const { team, pick, player, mvp, lane, turn, side, won, min, max, duel } = question
  const main = mainWords(question, names, text)
  const sole = soleHero(question)
  const result = won == null ? "" : won ? text("thắng", "won") : text("thua", "lost")
  const rest = [
    duel && text("cùng đường", "in the same lane"),
    lane && text(...LANE_WORDS[lane]),
    turn != null &&
      sole &&
      (sole.role === "pick"
        ? text(`chọn ở lượt ${turn}`, `picked at turn ${turn}`)
        : text(`ở lượt ${turn}`, `at turn ${turn}`)),
    mvp &&
      player &&
      !(isBare(question) && !lane) &&
      (pick.length > 1 || (team && !pick.length)
        ? text(`${names.player(player)} là MVP`, `${names.player(player)} as the MVP`)
        : text("là MVP", "as the MVP")),
    // Nobody is named, so the side of the map is who won or lost.
    ...(main || !side || !result
      ? [side && sideWords(side, text), result]
      : [text(`${sideWords(side, text)} ${result}`, `${result} ${sideWords(side, text)}`)]),
    (min != null || max != null) && lengthWords({ min, max }, text),
    dayWords(question, text, languageTag),
  ].filter(Boolean)
  return [main, ...rest].filter(Boolean).join(", ")
}

/** A question as it follows the number of its games; a team or a player alone owns them. */
export function foundWords(question: Question, names: Names, text: Say, languageTag: string): string {
  const words = questionWords(question, names, text, languageTag)
  const { team, pick, player, mvp, lane, ban, banA, banB } = question
  const named = !!(team || pick.length || player)
  const acts = isBare(question) && ((team && banA.length > 0) || (player && mvp && !lane))
  const vi = isBare(question) && !acts ? `của ${words}` : words
  const onlyBans = !partiesWords(question, names, text) && ban.length + banA.length + banB.length > 0
  return text(vi, named ? `of ${words}` : onlyBans ? `with ${words}` : words)
}

/** One condition of a question in the words of its chip. */
export function conditionWords(
  { key, hero }: Pick<Condition, "key" | "hero">,
  question: Question,
  names: Names,
  text: Say,
  languageTag: string,
): string {
  if (hero) return hero.name
  const { team, opp, player, lane, turn, side, won } = question
  if (key === "team") return team ? names.team(team) : ""
  if (key === "opp") return opp ? names.team(opp) : ""
  if (key === "player") return player ? names.player(player) : ""
  if (key === "lane") return lane ? text(...LANE_WORDS[lane]) : ""
  if (key === "turn") return text(`lượt ${turn}`, `turn ${turn}`)
  if (key === "side") return side === "BLUE" ? text("bên xanh", "blue side") : text("bên đỏ", "red side")
  if (key === "won") return won ? text("thắng", "won") : text("thua", "lost")
  if (key === "duel") return text("cùng đường", "same lane")
  if (key === "mvp") return text("là MVP", "as the MVP")
  if (key === "days") return dayWords(question, text, languageTag)
  return key === "length" ? lengthWords(question, text) : ""
}
