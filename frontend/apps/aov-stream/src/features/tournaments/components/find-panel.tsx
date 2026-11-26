import type { ReactNode } from "react"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { GoLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText, laneName } from "../../../lib/feed-words"
import {
  choices,
  findGames,
  movedHero,
  releasedHero,
  roleChoices,
  soleHero,
  type HeroRole,
  type Question,
} from "../../../lib/finder-model"
import type { FeedHero } from "../../../lib/game-feed"
import { statsHref } from "../../../lib/statistics-routes"
import { ChipGroup } from "./chips"
import type { Finder, Spot } from "./find-question"
import { ROLE_NAMES } from "./find-seat"
import { HeroPortrait } from "./hero-portrait"
import "./find-panel.css"

type Choice = { key: string; name: ReactNode; games: number; on: boolean; next: Question }

/** One thing that can be asked of a hero. */
function Asks({
  title,
  choices: list,
  note,
  onAsk,
}: {
  title: string
  choices: Choice[]
  note?: string | null
  onAsk: (next: Question) => void
}) {
  if (!list.length) return null
  const chips = list.map(({ next, ...chip }) => ({ ...chip, press: () => onAsk(next) }))
  return <ChipGroup className="tn-find-asks" title={title} chips={chips} note={note} />
}

/** What else can be asked of the only hero of a question: its lane, its player and its turn of the draft. */
function useHeroChoices({ data, question, names }: Finder, hero: FeedHero, role: HeroRole) {
  const { text, languageTag } = useStreamLocale()
  const sole = soleHero(question)
  if (sole?.hero.key !== hero.key || sole.role !== role) return null
  const { games } = data.feed
  /** The values of a condition that narrow anything, and how many games name none. */
  const counted = (key: "lane" | "player" | "turn", open: Partial<Question>) => {
    const list = [...choices(games, question, key)].sort((x, y) => y[1] - x[1])
    const all = findGames(games, { ...question, ...open }).length
    const unknown = all - list.reduce((sum, [, count]) => sum + count, 0)
    return { list: list.filter(([value, count]) => count < all || String(question[key]) === value), unknown }
  }
  const none = { list: [], unknown: 0 }
  const picked = role === "pick"
  const lanes = picked ? counted("lane", { lane: null }) : none
  const players = picked ? counted("player", { player: null, mvp: false }) : none
  const turns = counted("turn", { turn: null })
  const unknown = (count: number, vi: string, en: string) => {
    const left = gamesText(count, text, languageTag)
    return count > 0 ? text(`${left} ${vi}`, `${left} ${en}`) : null
  }
  return {
    lanes: lanes.list.map(([lane, count]): Choice => ({
      key: lane,
      name: (
        <>
          <HeroLaneIcon lane={lane as Lane} size={16} />
          {laneName(lane as Lane, text)}
        </>
      ),
      games: count,
      on: question.lane === lane,
      next: { ...question, lane: question.lane === lane ? null : (lane as Lane) },
    })),
    players: players.list.map(([player, count]): Choice => ({
      key: player,
      name: names.player(player),
      games: count,
      on: question.player === player,
      next: { ...question, player: question.player === player ? null : player, mvp: false },
    })),
    unnamed: players.list.length ? unknown(players.unknown, "chưa rõ ai chơi", "with no known player") : null,
    turns: turns.list
      .sort((x, y) => Number(x[0]) - Number(y[0]))
      .map(([turn, count]): Choice => ({
        key: turn,
        name: text(`Lượt ${turn}`, `Turn ${turn}`),
        games: count,
        on: question.turn === Number(turn),
        next: { ...question, turn: question.turn === Number(turn) ? null : Number(turn) },
      })),
    unordered: turns.list.length ? unknown(turns.unknown, "chưa rõ lượt", "with no known turn") : null,
  }
}

/** The roles a hero can be given from each role, with what giving it says. */
const MOVES: Record<"pick" | "vs" | "ban", [HeroRole, readonly [string, string]][]> = {
  pick: [
    ["vs", ["Đổi sang đối thủ", "Move to the opponent"]],
    ["ban", ["Đổi thành bị cấm", "Make it banned"]],
  ],
  vs: [
    ["pick", ["Đổi sang đội này", "Move to this side"]],
    ["ban", ["Đổi thành bị cấm", "Make it banned"]],
  ],
  ban: [
    ["pick", ["Đổi thành đội này chọn", "Make this side pick it"]],
    ["vs", ["Đổi thành đối thủ chọn", "Make the opponent pick it"]],
  ],
}

/** Who made a ban. */
const BANNERS: [HeroRole, readonly [string, string]][] = [
  ["ban", ["Bên nào cấm cũng được", "Either side"]],
  ["banA", ROLE_NAMES.banA],
  ["banB", ROLE_NAMES.banB],
]

/**
 * What can be done with a hero on the board: leaving it, along with the player asked about where nothing would be found
 * otherwise, another role, and its lane, its player or its turn.
 */
export function FindPanel({
  finder,
  hero,
  role,
  onAsk,
}: {
  finder: Finder
  hero: FeedHero
  role: HeroRole
  onAsk: (next: Question, spot: Spot) => void
}) {
  const { text, languageTag } = useStreamLocale()
  const { data, question, names } = finder
  const roles = roleChoices(data.feed.games, question, hero, role)
  const left = releasedHero(data.feed.games, question, role, hero)
  const player = question.player && !left.player ? names.player(question.player) : null
  const gone = player ? text(`${hero.name} và ${player}`, `${hero.name} and ${player}`) : hero.name
  const more = useHeroChoices(finder, hero, role)
  const answer = (next: Question) => onAsk(next, "answer")
  const banned = role !== "pick" && role !== "vs"
  const moves = MOVES[banned ? "ban" : role].flatMap(([to, name]) => {
    const games = roles.get(to)
    return games ? [{ to, name, games }] : []
  })
  const banners = BANNERS.flatMap(([to, name]): Choice[] => {
    const games = roles.get(to)
    const next = to === role ? question : movedHero(question, hero, role, to)
    return banned && games ? [{ key: to, name: text(...name), games, on: to === role, next }] : []
  })
  return (
    <div className="tn-find-panel-body">
      <div className="tn-find-panel-head">
        <HeroPortrait hero={hero} />
        <span>
          <b>{hero.name}</b>
          <small>{text(...ROLE_NAMES[role])}</small>
        </span>
        <GoLink
          to={statsHref(data.view.id, { hero, scope: data.period?.key })}
          aria-label={text(`Thống kê của ${hero.name}`, `Statistics of ${hero.name}`)}
        >
          {text("Thống kê", "Statistics")}
        </GoLink>
      </div>
      <ul className="tn-find-moves">
        <li>
          <button type="button" onClick={() => onAsk(left, `add-${banned ? "ban" : role}`)}>
            {text(`Bỏ ${gone}`, `Remove ${gone}`)}
          </button>
        </li>
        {moves.map(({ to, name, games }) => (
          <li key={to}>
            <button type="button" onClick={() => answer(movedHero(question, hero, role, to))}>
              {text(...name)}
              <small>{gamesText(games, text, languageTag)}</small>
            </button>
          </li>
        ))}
      </ul>
      <Asks title={text("Ai cấm", "Banned by")} choices={banners} onAsk={answer} />
      {more && (
        <>
          <Asks title={text("Đường", "Lane")} choices={more.lanes} onAsk={answer} />
          <Asks title={text("Người chơi", "Played by")} choices={more.players} note={more.unnamed} onAsk={answer} />
          <Asks
            title={banned ? text("Cấm ở lượt", "Banned at turn") : text("Chọn ở lượt", "Picked at turn")}
            choices={more.turns}
            note={more.unordered}
            onAsk={answer}
          />
        </>
      )}
    </div>
  )
}
