import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import {
  draftScript,
  draftShape,
  orderKnown,
  shapedGames,
  type DraftAct,
  type TakenHero,
} from "../../../lib/draft-shape"
import { gamesText } from "../../../lib/feed-words"
import { statsHref } from "../../../lib/statistics-routes"
import type { TeamRecord } from "../../../lib/team-draft-model"
import { ColumnHeading } from "./column-heading"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./club-script.css"

/** Heroes a list holds. */
const SHOWN = 5

const ACTS: Record<DraftAct["kind"], readonly [string, string]> = { BAN: ["Cấm", "Bans"], PICK: ["Chọn", "Picks"] }

function Taken({ data, name, act, heroes }: { data: StatsData; name: string; act: DraftAct; heroes: TakenHero[] }) {
  const { text, languageTag } = useStreamLocale()
  return (
    <div>
      <h4>{name}</h4>
      <ol>
        {heroes.slice(0, SHOWN).map(({ hero, games }) => (
          <li key={hero.key}>
            <Link to={statsHref(data.view.id, { hero, scope: data.period?.key })}>
              <HeroPortrait hero={hero} banned={act.kind === "BAN"} />
              <strong>{hero.name}</strong>
            </Link>
            {/* The finder asks about one turn, and an act is several, so nothing opens the games counted. */}
            <b>
              {games.toLocaleString(languageTag)}
              <span className="sr-only">{text(" ván", games === 1 ? " game" : " games")}</span>
            </b>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * What a team and whoever it faces take in each part of the draft, the heroes taken most first. Only while the order of
 * the turns is known for enough of the team's games.
 */
export function ClubScript({ data, record }: { data: StatsData; record: TeamRecord }) {
  const { text, languageTag } = useStreamLocale()
  const games = record.games.map(({ game }) => game)
  const shape = draftShape(games)
  if (!orderKnown(shape, games.length)) return null
  const script = draftScript({ ...shape, games: shapedGames(shape, games) }, (_, side) =>
    side.teamId === record.teamId ? 0 : 1,
  )
  const all = gamesText(games.length, text, languageTag)
  const known = script.games.toLocaleString(languageTag)
  return (
    <Section
      title={text("Cấm chọn theo lượt", "The draft, part by part")}
      note={
        script.games < games.length
          ? text(`${known} trong ${all} có ghi thứ tự`, `the order of ${known} of ${all} is recorded`)
          : undefined
      }
    >
      <div className="tn-club-script">
        {script.acts.map(({ act, taken: [own, rival] }) => (
          <section key={`${act.kind}${act.nth}`}>
            <ColumnHeading>{`${text(...ACTS[act.kind])} ${act.nth}`}</ColumnHeading>
            <Taken data={data} act={act} heroes={own} name={text("Đội này", "This team")} />
            <Taken data={data} act={act} heroes={rival} name={text("Đối thủ", "Opponents")} />
          </section>
        ))}
      </div>
    </Section>
  )
}
