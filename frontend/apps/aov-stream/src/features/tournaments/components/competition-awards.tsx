import { useState } from "react"
import type { CompetitionView, TournamentAward } from "@aov/community-contracts"
import { LocalMoney } from "@aov/ui/components/local-money"
import { EntityPageLink } from "../../../components/public-competitions"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { awardTeam } from "../../../lib/crew-model"
import "./competition-awards.css"

function Award({ view, award }: { view: CompetitionView; award: TournamentAward }) {
  const { languageTag } = useStreamLocale()
  const { tournament, teams, players } = view.content
  const team = awardTeam(award, teams)
  const logo = team?.id ? teams[team.id] : Object.values(teams).find((item) => item.name === team?.name)
  const photo = award.playerId ? players[award.playerId]?.photoUrl : undefined
  return (
    <li className="tn-award">
      {photo ? (
        <StreamImage src={photo} name={award.recipientName} />
      ) : (
        <StreamImage
          src={logo?.logoUrl}
          darkSrc={logo?.logoDarkUrl}
          logo={!!(logo?.logoUrl || logo?.logoDarkUrl)}
          name={award.recipientName}
        />
      )}
      <span>
        <strong>
          {award.playerId ? (
            <EntityPageLink kind="PLAYER" id={award.playerId} name={award.recipientName} />
          ) : (
            award.recipientName
          )}
        </strong>
        {team && <span>{team.id ? <EntityPageLink kind="TEAM" id={team.id} name={team.name} /> : team.name}</span>}
      </span>
      {(award.prizeUsd != null || award.prizeLocal != null) && (
        <LocalMoney
          amounts={[
            { amount: award.prizeUsd, currency: "USD" },
            { amount: award.prizeLocal, currency: tournament.localCurrency },
          ]}
          on={tournament.endsOn ?? tournament.startsOn}
          locale={languageTag}
          compact
        />
      )}
    </li>
  )
}

/**
 * Awards grouped by title, since a weekly award names several players. The first `preview` titles show; the rest
 * unfold. `wide` sets the titles side by side, where the card has a page's full width.
 */
export function CompetitionAwards({
  view,
  preview,
  wide = false,
}: {
  view: CompetitionView
  preview: number
  wide?: boolean
}) {
  const { text } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const groups = new Map<string, TournamentAward[]>()
  for (const award of view.content.tournament.awards ?? [])
    groups.set(award.title, [...(groups.get(award.title) ?? []), award])
  if (!groups.size) return null
  const all = [...groups]
  const shown = open ? all : all.slice(0, preview)
  const hidden = all.length - shown.length
  return (
    <section className="tn-side-card">
      <h2>{text("Giải thưởng cá nhân", "Individual awards")}</h2>
      <dl className="tn-awards" data-wide={wide || undefined}>
        {shown.map(([title, awards]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>
              <ul>
                {awards.map((award, index) => (
                  <Award key={index} view={view} award={award} />
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      {all.length > preview && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open
            ? text("Thu gọn", "Show less")
            : text(`Xem thêm ${hidden} giải thưởng`, `Show ${hidden} more ${hidden === 1 ? "award" : "awards"}`)}
          <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
        </button>
      )}
    </section>
  )
}
