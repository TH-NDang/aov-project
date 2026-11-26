import type { CompetitionView } from "@aov/community-contracts"
import type { FoundGame, Question } from "./finder-model.ts"
import type { FeedBan, FeedPick, FeedSide } from "./game-feed.ts"
import { matchRound } from "./match-schedule.ts"
import { dayMonth } from "./match-time.ts"
import { heroNames } from "./question-words.ts"
import { clock } from "./tournament-model.ts"

type Say = (vi: string, en: string) => string

/** What the lines of a list are about: the heroes and the player of its question. */
export type Asked = Partial<Pick<Question, "pick" | "vs" | "ban" | "banA" | "banB" | "player">>

/** The seat of side A a list is about: that of its one hero, or else that of its player. */
export function askedSeat({ a }: Pick<FoundGame, "a">, { pick = [], player }: Asked): FeedPick | null {
  if (pick.length > 1) return null
  const [hero] = pick
  return a.picks.find((seat) => (hero ? seat.hero.key === hero.key : !!player && seat.playerId === player)) ?? null
}

/** The bans a list is about, at the side that made them. */
export function askedBans({ a, b }: Pick<FoundGame, "a" | "b">, { ban = [], banA = [], banB = [] }: Asked) {
  const of = (side: FeedSide | null, heroes: Question["ban"]): FeedBan[] =>
    (side?.bans ?? []).filter((item) => heroes.some(({ key }) => key === item.hero.key))
  return { a: of(a, [...ban, ...banA]), b: of(b, [...ban, ...banB]) }
}

/**
 * A game of a list in one sentence, with everything its line shows in pictures: the round and the day, who beat whom,
 * who played the hero asked about, who banned what, and the side of the map each team sat on.
 */
export function lineWords(view: CompetitionView, found: FoundGame, asked: Asked, text: Say, languageTag: string) {
  const { game, a, b } = found
  const { teams, players } = view.content
  const team = (side: FeedSide | null | undefined) =>
    (side?.teamId && (teams[side.teamId]?.shortName || teams[side.teamId]?.name)) || text("Đội", "Team")
  const [winner, loser] = found.won === false ? [b, a] : [a, b]
  const seat = askedSeat(found, asked)
  const player = seat?.playerId ? players[seat.playerId]?.nickname : null
  const bans = askedBans(found, asked)
  const banned = (side: FeedSide | null, list: FeedBan[]) => {
    const names = heroNames(
      list.map(({ hero }) => hero),
      text,
    )
    return names && text(`${team(side)} cấm ${names}`, `${team(side)} banned ${names}`)
  }
  const blue = game.sides.find(({ side }) => side === "BLUE")
  const mvp = game.mvpId ? players[game.mvpId]?.nickname : null
  return [
    game.entry && matchRound(game.entry, languageTag),
    game.day && dayMonth(game.day, languageTag),
    text(`ván ${game.number}`, `game ${game.number}`),
    found.won == null
      ? text(`${team(a)} gặp ${team(b)}`, `${team(a)} against ${team(b)}`)
      : text(`${team(winner)} thắng ${team(loser)}`, `${team(winner)} beat ${team(loser)}`),
    game.seconds && clock(game.seconds),
    player && text(`${player} chơi ${seat!.hero.name}`, `${player} playing ${seat!.hero.name}`),
    banned(a, bans.a),
    banned(b, bans.b),
    blue && text(`${team(blue)} bên xanh`, `${team(blue)} on the blue side`),
    mvp && `MVP ${mvp}`,
  ]
    .filter(Boolean)
    .join(", ")
}
