import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { useStreamLocale } from "../../../components/stream-locale"
import type { PairRecord, TeamHeroRecord } from "../../../lib/facts-model"
import { score } from "../../../lib/feed-words"
import { playerTold, seatsOf, seatWords } from "../../../lib/highlights"
import { namesOf } from "../../../lib/question-words"
import { statsHref } from "../../../lib/statistics-routes"
import { FactRow } from "./fact-row"
import { FactWords } from "./fact-words"
import { cellUnit, GameCells } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-records.css"

export type Records = { teams: TeamHeroRecord[]; pairs: PairRecord[]; duels: PairRecord[] }

/** The pixels the cells of the longest record may take, on the narrowest screen of each layout. */
const TRACK = { compact: 186, wide: 232 }

type RecordRow = {
  key: string
  to: string
  heroes: TeamHeroRecord["hero"][]
  words: string
  note?: string | null
  wins: number
  losses: number
}

/**
 * The records a competition is remembered by: of one hero with a team, of two heroes side by side and of one against
 * another, each as its games. One cell is one game and has the same width in all of them, so they compare.
 */
export function FactRecords({ data, records: { teams, pairs, duels } }: { data: StatsData; records: Records }) {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const names = namesOf(data.view, text)
  const scope = data.period?.key
  const longest = Math.max(1, ...[...teams, ...pairs, ...duels].map(({ wins, losses }) => wins + losses))
  const unit = cellUnit(longest, TRACK[layout])
  const groups: { title: string; rows: RecordRow[] }[] = [
    {
      title: text("Một tướng của một đội", "One hero of one team"),
      rows: teams.map((record) => {
        const { teamId, hero, wins, losses } = record
        const seats = seatsOf(data.records.get(hero.key)!, teamId)
        const told = playerTold(record, seats)
        const team = names.team(teamId)
        return {
          key: `${teamId}${hero.key}`,
          to: statsHref(data.view.id, { question: { team: teamId, pick: [hero] }, scope }),
          heroes: [hero],
          words: told
            ? text(
                `*${names.player(told)}* chơi *${hero.name}* cho *${team}*`,
                `*${names.player(told)}* on *${hero.name}* for *${team}*`,
              )
            : text(`*${team}* chơi *${hero.name}*`, `*${team}* on *${hero.name}*`),
          note: seatWords(seats, told, names.player, text),
          wins,
          losses,
        }
      }),
    },
    {
      title: text("Hai tướng cùng đội", "Two heroes on one team"),
      rows: pairs.map(({ heroes, wins, losses }) => {
        const [one, other] = heroes
        return {
          key: `${one.key}${other.key}`,
          to: statsHref(data.view.id, { question: { pick: heroes }, scope }),
          heroes,
          words: text(`*${one.name}* cùng đội *${other.name}*`, `*${one.name}* with *${other.name}*`),
          wins,
          losses,
        }
      }),
    },
    {
      title: text("Hai tướng gặp nhau", "One hero against another"),
      rows: duels.map(({ heroes, wins, losses }) => {
        const [one, other] = heroes
        return {
          key: `${one.key}${other.key}`,
          to: statsHref(data.view.id, { question: { pick: [one], vs: [other] }, scope }),
          heroes,
          words: text(`*${one.name}* gặp *${other.name}*`, `*${one.name}* against *${other.name}*`),
          wins,
          losses,
        }
      }),
    },
  ]
  return (
    <Section title={text("Thành tích đáng nhớ", "Records to remember")}>
      <div className="tn-fact-records">
        {groups
          .filter(({ rows }) => rows.length > 0)
          .map(({ title, rows }) => (
            <section key={title}>
              <h3>{title}</h3>
              <ol>
                {rows.map(({ key, to, heroes, words, note, wins, losses }) => (
                  <FactRow
                    key={key}
                    to={to}
                    art={heroes.map((hero) => (
                      <HeroPortrait key={hero.key} hero={hero} />
                    ))}
                    figure={score({ wins, losses })}
                    said={[
                      words.replaceAll("*", ""),
                      text(`thắng ${wins}, thua ${losses}`, `won ${wins}, lost ${losses}`),
                      note,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  >
                    <span>
                      <FactWords words={words} />
                    </span>
                    <GameCells wins={wins} losses={losses} unit={unit} whole={longest} height={14} />
                    {note && <small>{note}</small>}
                  </FactRow>
                ))}
              </ol>
            </section>
          ))}
      </div>
    </Section>
  )
}
