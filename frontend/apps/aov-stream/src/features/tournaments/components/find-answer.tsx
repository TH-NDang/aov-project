import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { GoLink } from "../../../components/go-link"
import { useStreamLocale } from "../../../components/stream-locale"
import { gamesText } from "../../../lib/feed-words"
import { asksAnything, namesSide } from "../../../lib/finder-model"
import { foundTally, hasScore, sideWins, unseenBans, unseenMvps } from "../../../lib/found-model"
import { averageSeconds } from "../../../lib/game-feed"
import { foundWords, questionWords, scoredParty } from "../../../lib/question-words"
import { clock } from "../../../lib/tournament-model"
import type { Finder } from "./find-question"
import { cellUnit, GameCells } from "./game-marks"
import "./find-answer.css"

/** Under this many games a score is told with a word of caution. */
const FEW = 5

/** What side A won and lost of the games found, with a cell for each. */
function Score({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const { question, found, names } = finder
  const { games, wins, losses } = foundTally(found)
  const open = games - wins - losses
  const unit = cellUnit(games, compact ? 320 : 480)
  const figure = (count: number) => <b>{count.toLocaleString(languageTag)}</b>
  return (
    <>
      <p className="tn-find-score">
        <span>
          {scoredParty(question, names, text)} {text("thắng", "won")} {figure(wins)}, {text("thua", "lost")}{" "}
          {figure(losses)}
          {open > 0 && text(`, ${gamesText(open, text, languageTag)} chưa rõ`, `, ${open} unknown`)}
        </span>
        {wins + losses > 0 && (
          <span className="tn-find-cells">
            <GameCells wins={wins} losses={losses} unit={unit} whole={wins + losses} height={18} />
          </span>
        )}
      </p>
      {games < FEW && (
        <p className="tn-find-few">
          {text(
            `Chỉ ${gamesText(games, text, languageTag)}, chưa nói lên nhiều.`,
            `Only ${gamesText(games, text, languageTag)}, which says little.`,
          )}
        </p>
      )}
    </>
  )
}

/** What the games found have in common when neither side is asked about: which side of the map won, how long they were. */
function Facts({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const games = finder.found.map(({ game }) => game)
  const { BLUE, RED } = sideWins(games)
  const average = averageSeconds(games)
  const open = games.length - BLUE - RED
  const figure = (count: number) => <b>{count.toLocaleString(languageTag)}</b>
  const sides = !asksAnything(finder.question) && BLUE + RED > 0
  return (
    <p className="tn-find-score">
      <span>
        {sides && (
          <>
            {text("bên xanh thắng", "the blue side won")} {figure(BLUE)}, {text("bên đỏ thắng", "the red side won")}{" "}
            {figure(RED)}
            {open > 0 && text(`, ${gamesText(open, text, languageTag)} chưa rõ`, `, ${open} unknown`)}
          </>
        )}
        {sides && average != null && ", "}
        {average != null && (
          <>
            {text("trung bình", "average length")} <b>{clock(average)}</b>
          </>
        )}
      </span>
    </p>
  )
}

/** The games a question about bans could not be asked of, because nobody wrote down who was banned in them. */
function Unseen({ finder: { data, question } }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const games = unseenBans(data.feed.games, question)
  if (!games) return null
  const count = gamesText(games, text, languageTag)
  return (
    <p className="tn-find-unseen">
      {text(`Chưa kể ${count} chưa ghi lượt cấm.`, `Not counting ${count} whose bans are not recorded.`)}
    </p>
  )
}

/** The games a player was the MVP of that the question leaves out, because no seat of theirs names the player. */
function UnseenMvps({ finder: { data, question, found, names, href, follow } }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const games = unseenMvps(data.feed.games, question)
  if (!games) return null
  const count = gamesText(games, text, languageTag)
  const player = names.player(question.player!)
  const best = text(`${player} là MVP`, `${player} as the MVP`)
  return (
    <p className="tn-find-unseen">
      {text(`Chưa kể ${count} `, `Not counting ${count} with `)}
      {/* It opens every game the player was the MVP of, also those found already, so the number stands before it. */}
      {found.length > 0 ? (
        <GoLink prose to={href({ ...question, mvp: true })} onClick={follow}>
          {best}
        </GoLink>
      ) : (
        best
      )}
      {text(" mà chưa rõ chơi tướng nào.", ", whose hero is not recorded.")}
    </p>
  )
}

/**
 * What the question found, in one sentence: the heading, the title of the page and what a screen reader hears when it
 * changes. Under it stands the score of the side asked about, or what is true of the games of neither.
 */
export function FindAnswer({ finder }: { finder: Finder }) {
  const { text, languageTag } = useStreamLocale()
  const { data, question, found, names } = finder
  const count = gamesText(found.length, text, languageTag)
  const words = foundWords(question, names, text, languageTag)
  const none = text("Không ván nào khớp", "No game matches")
  const title = found.length ? `${count} ${words}`.trim() : none
  return (
    <div className="tn-find-answer" role="status" aria-atomic="true">
      <title>{`${title}, ${data.view.content.tournament.name} — AOV Stream`}</title>
      <h2 tabIndex={-1} data-spot="answer">
        {found.length ? (
          <>
            <b>{count}</b> {words}
          </>
        ) : (
          <b>{none}.</b>
        )}
      </h2>
      {!found.length ? (
        <p className="tn-find-asked">{questionWords(question, names, text, languageTag)}</p>
      ) : hasScore(question) ? (
        <Score finder={finder} />
      ) : (
        !namesSide(question) && question.won == null && <Facts finder={finder} />
      )}
      <Unseen finder={finder} />
      <UnseenMvps finder={finder} />
    </div>
  )
}
