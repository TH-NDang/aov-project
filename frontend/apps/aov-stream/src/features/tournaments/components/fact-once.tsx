import { Link } from "react-router"
import { useStreamLocale } from "../../../components/stream-locale"
import type { rarePicks } from "../../../lib/highlights"
import { matchRound } from "../../../lib/match-schedule"
import { namesOf } from "../../../lib/question-words"
import { GameMarks } from "./game-marks"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import type { StatsData } from "./stats-data"
import "./fact-once.css"

/** The heroes picked in a single game, each with who played it and how that game ended; it opens the game. */
export function FactOnce({ data, once }: { data: StatsData; once: ReturnType<typeof rarePicks> }) {
  const { text, languageTag } = useStreamLocale()
  const names = namesOf(data.view, text)
  return (
    <Section
      title={text("Chỉ được chọn một lần", "Picked only once")}
      note={text(`${once.length} tướng`, `${once.length} ${once.length === 1 ? "hero" : "heroes"}`)}
    >
      <ul className="tn-fact-once">
        {once.map(({ hero, game, won, teamId }) => {
          const team = teamId ? names.team(teamId) : text("Đội chưa rõ", "Unknown team")
          const result =
            won == null ? team : won ? text(`${team} thắng`, `${team} won`) : text(`${team} thua`, `${team} lost`)
          const round = game.entry ? matchRound(game.entry, languageTag) : null
          return (
            <li key={hero.key}>
              <Link
                to={`/games/${game.id}`}
                title={[round, text(`ván ${game.number}`, `game ${game.number}`)].filter(Boolean).join(", ")}
              >
                <HeroPortrait hero={hero} />
                <span>
                  <strong>{hero.name}</strong>
                  <span>
                    <GameMarks marks={[won]} unit={5} height={12} /> {result}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
