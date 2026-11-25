import { Link } from "react-router"
import type { CompetitionStatistics, CompetitionView } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { heroHref, heroLines, percent } from "../../../lib/statistics-model"
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
  const { text } = useStreamLocale()
  const heroes = heroLines(statistics)
    .filter((line) => line.id)
    .slice(0, SHOWN)
  if (!heroes.length) return null
  return (
    <Section
      title={text("Tướng có mặt nhiều nhất", "Most present heroes")}
      note={text("chọn hoặc cấm", "picked or banned")}
      more={{ label: text("Thống kê", "Statistics"), open }}
    >
      <ol className="tn-top-heroes">
        {heroes.map((hero) => (
          <li key={hero.key}>
            <Link to={heroHref(view.id, hero)}>
              <HeroPortrait hero={hero} />
              <strong>{hero.name}</strong>
              <span>{percent(hero.presence, statistics.games)}%</span>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  )
}
