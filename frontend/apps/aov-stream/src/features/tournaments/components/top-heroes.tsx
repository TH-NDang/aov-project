import { Link } from "react-router"
import type { CompetitionStatistics, CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { shareOrGames } from "../../../lib/shares"
import { mostSeen } from "../../../lib/statistics-model"
import { statsHref } from "../../../lib/statistics-routes"
import { HeroPortrait } from "./hero-portrait"
import { Section } from "./section"
import "./top-heroes.css"

/** Heroes on the overview: one line of them, as many as fit the page. */
const SHOWN = 10

/** The heroes most often picked or banned, as one line of pictures; the statistics hold all of them. */
export function TopHeroes({
  view,
  statistics,
  open,
}: {
  view: CompetitionView
  statistics: CompetitionStatistics
  open: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  // Presence says little where some games do not show their bans; picks are known of every game.
  const seen = statistics.withBans === statistics.games
  const heroes = mostSeen(statistics, SHOWN, seen ? "presence" : "picks")
  if (!heroes.length) return null
  return (
    <Section
      title={
        seen
          ? text("Tướng có mặt nhiều nhất", "Most present heroes")
          : text("Tướng được chọn nhiều nhất", "Most picked heroes")
      }
      note={seen ? text("chọn hoặc cấm", "picked or banned") : text("số ván được chọn", "games picked in")}
      more={{ label: text("Thống kê", "Statistics"), open }}
    >
      <ol className="tn-top-heroes">
        {heroes.map((hero) => (
          <li key={hero.key}>
            <Link to={statsHref(view.id, { hero })}>
              <HeroPortrait hero={hero} />
              <b>{shareOrGames(seen ? hero.presence : hero.picks, statistics.games, text, languageTag)}</b>
              <span>{hero.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  )
}
