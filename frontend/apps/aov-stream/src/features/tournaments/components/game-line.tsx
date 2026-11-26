import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import type { FoundGame } from "../../../lib/finder-model"
import { wonBy, type FeedBan, type FeedGame, type FeedHero, type FeedSide } from "../../../lib/game-feed"
import { askedBans, askedSeat, lineWords, type Asked } from "../../../lib/line-words"
import { matchRound } from "../../../lib/match-schedule"
import { dayMonth } from "../../../lib/match-time"
import { clock, unbroken } from "../../../lib/tournament-model"
import { HeroPortrait } from "./hero-portrait"
import "./game-line.css"

type Slot = "a" | "b"

/** The seats of a side; one whose hero nobody recorded stays blank. */
const SEATS = 5

/** The five picks of one side in lane order; the heroes asked about stand out of them. */
function Picks({ game, side, slot, marked }: { game: FeedGame; side: FeedSide; slot: Slot; marked: FeedHero[] }) {
  if (!side.picks.length) return null
  const blank = Math.max(0, SEATS - side.picks.length)
  return (
    <span
      className="tn-line-picks"
      data-slot={slot}
      data-side={side.side}
      data-lost={wonBy(game, side) === false || undefined}
    >
      {side.picks.map(({ hero }) => (
        <span key={hero.key} title={hero.name} data-marked={marked.some(({ key }) => key === hero.key) || undefined}>
          <HeroPortrait hero={hero} />
        </span>
      ))}
      {Array.from({ length: blank }, (_, index) => (
        <i key={index} />
      ))}
    </span>
  )
}

/** The bans asked about, at the side that made them. */
function Bans({ bans, slot }: { bans: FeedBan[]; slot: Slot }) {
  if (!bans.length) return null
  return (
    <span
      className="tn-line-bans"
      data-slot={slot}
      data-many={bans.length > 2 ? "more" : bans.length > 1 ? "two" : undefined}
    >
      {bans.map(({ hero }) => (
        <span key={hero.key} title={hero.name}>
          <HeroPortrait hero={hero} banned />
        </span>
      ))}
    </span>
  )
}

function Team({
  view,
  game,
  side,
  slot,
  note,
}: {
  view: CompetitionView
  game: FeedGame
  side: FeedSide | null
  slot: Slot
  /** Who played the hero a list is about, where the line has no column for it. */
  note?: string | null
}) {
  const { text } = useStreamLocale()
  const team = side?.teamId ? view.content.teams[side.teamId] : undefined
  const name = team?.shortName || team?.name || text("Đội", "Team")
  const won = side ? wonBy(game, side) : null
  return (
    <span
      className="tn-line-team"
      data-slot={slot}
      data-won={won === true || undefined}
      data-lost={won === false || undefined}
    >
      <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={name} />
      <span className="tn-line-name">
        <span>
          <strong title={team?.name}>{unbroken(name)}</strong>
          {won && <StreamIcon name="trophy" size={14} />}
        </span>
        {note && <small>{note}</small>}
      </span>
    </span>
  )
}

/**
 * One game of a competition on a line, the side a list is about on the left: when it was played, both teams with their
 * picks, how long it took and who was its MVP. The heroes of a question stand out, as does what its player played, and
 * bans are drawn only where one was asked about, so the line says why it is here. The whole line opens the game. A line
 * is as wide as the column it stands in: where both teams do not fit side by side, each has a line of its own.
 */
export function GameLine({
  view,
  found,
  asked = {},
  follows = false,
}: {
  view: CompetitionView
  found: FoundGame
  asked?: Asked
  /** The line above is of the same match, so the round and the day stand there. */
  follows?: boolean
}) {
  const { text, languageTag } = useStreamLocale()
  const { game, a, b } = found
  const { players } = view.content
  const round = game.entry ? matchRound(game.entry, languageTag) : null
  const mvp = game.mvpId ? players[game.mvpId]?.nickname : undefined
  const seat = askedSeat(found, asked)
  // A list about one player names them once; a list about a hero says on each line who played it.
  const player = asked.pick?.length && seat?.playerId ? players[seat.playerId]?.nickname : undefined
  const bans = askedBans(found, asked)
  return (
    <Link className="tn-line" to={`/games/${game.id}`} aria-label={lineWords(view, found, asked, text, languageTag)}>
      <span className="tn-line-cols tn-line-row">
        <span className="tn-line-when" data-follows={follows || undefined}>
          {round && <b>{round}</b>}
          {game.day && <span>{dayMonth(game.day, languageTag)}</span>}
          {player && <span className="tn-line-played">{text(`${player} chơi`, `played by ${player}`)}</span>}
        </span>
        <Team view={view} game={game} side={a} slot="a" note={player} />
        <Picks game={game} side={a} slot="a" marked={[...(asked.pick ?? []), ...(seat ? [seat.hero] : [])]} />
        <span className="tn-line-game">
          <Bans slot="a" bans={bans.a} />
          <span className="tn-line-clock">
            <span>{text(`Ván ${game.number}`, `Game ${game.number}`)}</span>
            <b>{game.seconds ? clock(game.seconds) : "–"}</b>
          </span>
          <Bans slot="b" bans={bans.b} />
        </span>
        {b && <Picks game={game} side={b} slot="b" marked={asked.vs ?? []} />}
        <Team view={view} game={game} side={b} slot="b" />
        <span className="tn-line-mvp">
          {mvp && (
            <>
              <StreamIcon name="spark" size={13} />
              <b title={`MVP: ${mvp}`}>{mvp}</b>
            </>
          )}
        </span>
      </span>
    </Link>
  )
}
