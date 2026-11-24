import type { CompetitionView } from "@aov/community-contracts"
import { EntityPageLink } from "../../../components/go-link"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { Section } from "./section"
import "./team-wall.css"

/** The teams of a competition nobody has played in yet, by their logos. Nothing shows until they are known. */
export function TeamWall({ view, open }: { view: CompetitionView; open: () => void }) {
  const { text } = useStreamLocale()
  const { plan, teams } = view.content
  const known = plan.entrants.filter((entrant) => teams[entrant.teamId])
  if (!known.length) return null
  return (
    <Section
      title={text("Đội tham dự", "Teams")}
      note={text(`${known.length} đội`, `${known.length} ${known.length === 1 ? "team" : "teams"}`)}
      more={{ label: text("Đội hình", "Rosters"), open }}
    >
      <ul className="tn-wall">
        {known.map((entrant) => {
          const team = teams[entrant.teamId]!
          return (
            <li key={entrant.teamId}>
              <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
              <span>
                <EntityPageLink kind="TEAM" id={entrant.teamId} name={team.name} plain />
              </span>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
