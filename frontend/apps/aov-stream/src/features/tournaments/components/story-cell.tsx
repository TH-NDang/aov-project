import { memo, type CSSProperties, type ReactNode } from "react"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { clock } from "../../../lib/tournament-model"
import { startOf } from "../../../lib/watch-follow"
import {
  timed,
  type BarCell,
  type Chapter,
  type StoryPart,
  type WatchLength,
  type WatchMatch,
} from "../../../lib/watch-types"
import { gameWords, shortName, type Say } from "../../../lib/watch-words"
import { StoryMarks } from "./story-marks"
import { playGame } from "./use-story-pointer"
import "./story-cell.css"

/** From this width on the label of a game has room for the game's length. */
const LABEL_LENGTH = 104
/** From this width on an untimed game has room to say that it is. */
const BLANK_WORDS = 96

/** What a press on a game does, in words: it begins where the length being watched begins it. */
function playWords(chapter: Chapter, length: WatchLength, text: Say) {
  const game = text(`Phát ván ${chapter.number}`, `Play game ${chapter.number}`)
  if (!timed(chapter) || length === "quick") return game
  return length === "games" || chapter.draftStart == null
    ? text(`${game} từ lúc vào trận`, `${game} from its start`)
    : text(`${game} từ lúc cấm chọn`, `${game} from its draft`)
}

/** The button of a game, for who cannot see its winner's logo. */
export function pressWords(match: WatchMatch, chapter: Chapter, length: WatchLength, told: boolean, text: Say) {
  const play = playWords(chapter, length, text)
  const winner = told && chapter.winner ? shortName(match, chapter.winner) : null
  return winner ? text(`${play}, ${winner} thắng`, `${play}, won by ${winner}`) : play
}

/** The logo of who won a game. */
export function StoryWinner({ match, chapter }: { match: WatchMatch; chapter: Chapter }) {
  if (!chapter.winner) return null
  const { logoUrl, logoDarkUrl } = match.teams[chapter.winner]
  return <StreamImage src={logoUrl} darkSrc={logoDarkUrl} logo name={shortName(match, chapter.winner)} />
}

/** The name of a game over its chapter, which plays the game; a line too low to be pressed only names it. */
function StoryLabel({
  match,
  cell: { chapter, chip, blank, width },
  current,
  told,
  length,
  pressed,
}: {
  match: WatchMatch
  cell: BarCell
  current: boolean
  told: boolean
  length: WatchLength
  pressed: boolean
}) {
  const { text } = useStreamLocale()
  const words = (
    <>
      {chip ? chapter.number : gameWords(chapter.number, text)}
      {told && <StoryWinner match={match} chapter={chapter} />}
      {!chip && !blank && chapter.length != null && width > LABEL_LENGTH && <small>{clock(chapter.length)}</small>}
    </>
  )
  if (!pressed || !chapter.video || startOf(chapter, match.cuts, length) == null)
    return (
      <span className="tn-story-label" aria-current={current || undefined}>
        {words}
      </span>
    )
  return (
    <button
      type="button"
      className="tn-story-label"
      aria-current={current || undefined}
      aria-label={pressWords(match, chapter, length, told, text)}
      title={playWords(chapter, length, text)}
      data-chip={chip || undefined}
      onClick={() => playGame(chapter, match.cuts)}
    >
      {words}
    </button>
  )
}

/** A draft, a stretch of play or a whole folded game, with the share of it that the video has passed. */
function Stretch({
  kind,
  at,
  seconds,
  left,
  width,
  children,
}: Pick<StoryPart, "kind" | "at" | "seconds"> & { left: number; width: number; children?: ReactNode }) {
  const style = { left, width, "--from": at, "--long": seconds } as CSSProperties
  return (
    <span className="tn-story-part" data-kind={kind} style={style}>
      <i />
      {children}
    </span>
  )
}

/** The pieces of the quick cut within a part, as shares of it. */
function pieceStyles({ cuts }: WatchMatch, { index }: Chapter, { from, to, seconds }: StoryPart) {
  return cuts.quick.pieces
    .filter((piece) => piece.chapter === index && piece.from < to && piece.to > from)
    .map((piece) => {
      const begins = Math.max(0, piece.from - from)
      const long = Math.min(seconds, piece.to - from) - begins
      return { left: `${(begins / seconds) * 100}%`, width: `${(long / seconds) * 100}%` }
    })
}

/**
 * A game of the story: its name, its draft and its play with a line through the middle, and the marks of both teams.
 * How much of it the video has passed is drawn from `--story-at`, which follows the video without a render.
 */
export const StoryCell = memo(function StoryCell({
  match,
  cell,
  current,
  told,
  limit,
  lane,
  length,
  label,
  crossed,
}: {
  match: WatchMatch
  cell: BarCell
  current: boolean
  told: boolean
  limit: number
  lane: number
  length: WatchLength
  label: "PRESSED" | "READ" | null
  /** The video is in a stretch without times, where its place stands on the untimed games. */
  crossed: boolean
}) {
  const { text } = useStreamLocale()
  const { chapter, left, width, parts, chip, blank } = cell
  return (
    <div className="tn-story-cell" style={{ left, width }}>
      {label && (
        <StoryLabel
          match={match}
          cell={cell}
          current={current}
          told={told}
          length={length}
          pressed={label === "PRESSED"}
        />
      )}
      <span className="tn-story-parts" aria-hidden="true">
        {chip && <Stretch kind="PLAY" at={chapter.parts[0]!.at} seconds={chapter.seconds} left={0} width={width} />}
        {parts.map(({ part, ...box }) => (
          <Stretch key={part.from} kind={part.kind} at={part.at} seconds={part.seconds} {...box}>
            {length === "quick" &&
              pieceStyles(match, chapter, part).map((style) => (
                <span key={style.left} className="tn-story-piece" style={style} />
              ))}
          </Stretch>
        ))}
      </span>
      {blank && (
        <span className="tn-story-blank">
          {!crossed && width >= BLANK_WORDS && text("chưa có mốc", "not timed yet")}
        </span>
      )}
      <StoryMarks cell={cell} limit={limit} lane={lane} />
    </div>
  )
})
