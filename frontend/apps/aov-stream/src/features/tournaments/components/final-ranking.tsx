import type { CompetitionView } from "@aov/community-contracts"
import { LocalMoney } from "@aov/ui/components/local-money"
import { EntityPageLink } from "../../../components/public-competitions"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { finalTable } from "../../../lib/champion-model"
import "./final-ranking.css"

/** The final table of a competition: each place, the team that took it and its prize. Nothing shows without one. */
export function FinalRanking({ view }: { view: CompetitionView }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament } = view.content
  const rows = finalTable(view)
  if (!rows.length) return null
  return (
    <section className="tn-side-card">
      <h2>{text("Xếp hạng chung cuộc", "Final ranking")}</h2>
      <ol className="tn-ranking">
        {rows.map(({ place, team, prizeUsd, prizeLocal }) => (
          <li key={`${place}:${team.name}`} data-first={place.trim() === "1" || undefined}>
            <span className="tn-ranking-place">
              <span className="sr-only">{text("Hạng", "Place")} </span>
              {place}
            </span>
            <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.name} />
            <strong>{team.id ? <EntityPageLink kind="TEAM" id={team.id} name={team.name} /> : team.name}</strong>
            {(prizeUsd != null || prizeLocal != null) && (
              <span className="tn-ranking-prize">
                <LocalMoney
                  amounts={[
                    { amount: prizeUsd, currency: "USD" },
                    { amount: prizeLocal, currency: tournament.localCurrency },
                  ]}
                  on={tournament.endsOn ?? tournament.startsOn}
                  locale={languageTag}
                  compact
                />
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
