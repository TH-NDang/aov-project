import { Link } from "react-router"
import type { Side } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { capital } from "../../../lib/capital"
import { lengthRows } from "../../../lib/club-model"
import { gamesText, score } from "../../../lib/feed-words"
import type { Question } from "../../../lib/finder-model"
import type { Tally } from "../../../lib/hero-model"
import { lengthWords } from "../../../lib/question-words"
import { ENOUGH_FOR_SHARE, shareWords } from "../../../lib/shares"
import { statsHref } from "../../../lib/statistics-routes"
import { averageLength, sideTally, type TeamRecord } from "../../../lib/team-draft-model"
import { clock } from "../../../lib/tournament-model"
import { useWidth } from "../../../lib/use-width"
import { cellUnit, GameCells } from "./game-marks"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-splits.css"

/** The cells stand in line with the name and the record, or on a line of their own under them. */
type Form = "line" | "block"
/** How tall the cell of a game won is. */
const HEIGHT: Record<Form, number> = { line: 16, block: 26 }

type Split = { key: string; name: string; side?: Side; tally: Tally; asked: Partial<Question> }

/** Parts of a team's games, each with what it won and lost of them; a line leads to its games. */
function Splits({ data, teamId, splits, form }: { data: StatsData; teamId: string; splits: Split[]; form: Form }) {
  const { text, languageTag } = useStreamLocale()
  const { ref, width } = useWidth<HTMLSpanElement>(120)
  const longest = Math.max(1, ...splits.map(({ tally }) => tally.games))
  const unit = cellUnit(longest, width)
  return (
    <ol className="tn-club-splits" data-form={form}>
      {splits
        .filter(({ tally }) => tally.games > 0)
        .map(({ key, name, side, tally, asked }, index) => {
          const { games, wins, losses } = tally
          return (
            <li key={key}>
              <Link
                data-side={side}
                to={statsHref(data.view.id, { question: { team: teamId, ...asked }, scope: data.period?.key })}
                aria-label={[
                  `${name}: ${gamesText(games, text, languageTag)}`,
                  text(`thắng ${wins}`, `won ${wins}`),
                  text(`thua ${losses}`, `lost ${losses}`),
                ].join(", ")}
              >
                <strong>{name}</strong>
                <span className="tn-club-split-cells" ref={index ? undefined : ref}>
                  <GameCells wins={wins} losses={losses} unit={unit} whole={longest} height={HEIGHT[form]} />
                </span>
                <b>{score(tally)}</b>
                <small>{wins + losses >= ENOUGH_FOR_SHARE && shareWords(wins / (wins + losses), text)}</small>
              </Link>
            </li>
          )
        })}
    </ol>
  )
}

/** What a team won and lost on each side of the map, and in games of each length. */
export function ClubSplits({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text } = useStreamLocale()
  const { teamId, games } = record
  const blue = sideTally(record, "BLUE")
  const red = sideTally(record, "RED")
  const sides: Split[] = [
    { key: "BLUE", name: text("Bên xanh", "Blue side"), side: "BLUE", tally: blue, asked: { side: "BLUE" } },
    { key: "RED", name: text("Bên đỏ", "Red side"), side: "RED", tally: red, asked: { side: "RED" } },
  ]
  const lengths = lengthRows(data.feed.games, teamId).map(({ key, min, max, ...tally }): Split => ({
    key,
    name: capital(lengthWords({ min, max }, text)),
    tally,
    asked: { min, max },
  }))
  const [won, lost] = [averageLength(record, true), averageLength(record, false)]
  const average = [
    won && text(`ván thắng trung bình ${clock(won)}`, `games won last ${clock(won)} on average`),
    lost && text(`ván thua trung bình ${clock(lost)}`, `games lost ${clock(lost)}`),
  ].filter(Boolean)
  return (
    <div className="tn-club-split-lists">
      <Section
        title={text("Bên xanh, bên đỏ", "Blue side, red side")}
        note={text(
          `${blue.games} trong ${games.length} ván ở bên xanh`,
          `${blue.games} of ${games.length} games on the blue side`,
        )}
      >
        <Splits data={data} teamId={teamId} splits={sides} form="block" />
      </Section>
      {lengths.some(({ tally }) => tally.games > 0) && (
        <Section title={text("Độ dài ván", "Length of games")} note={average.join(", ")}>
          <Splits data={data} teamId={teamId} splits={lengths} form="line" />
        </Section>
      )}
    </div>
  )
}
