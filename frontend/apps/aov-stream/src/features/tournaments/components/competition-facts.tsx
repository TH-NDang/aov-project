import type { ReactNode } from "react"
import type { CompetitionView } from "@aov/community-contracts"
import { LocalPrizeText } from "@aov/ui/components/local-money"
import { LocalTime } from "@aov/ui/components/local-time"
import { GoLink } from "../../../components/go-link"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { codeName, COMPETITION_TYPE_NAMES, VENUE_MODE_NAMES } from "../../../lib/competition-model"
import { stageName } from "../../../lib/match-labels"

/**
 * Who runs a competition, what it is worth, where it is played, and where its facts come from. `wide` sets the facts
 * side by side, where the card has a page's main column.
 */
export function CompetitionFacts({ view, wide = false }: { view: CompetitionView; wide?: boolean }) {
  const { text, languageTag } = useStreamLocale()
  const { tournament, plan, organizer } = view.content
  const venues = plan.venues.filter((venue) => venue.name || venue.city)
  const stageOf = (code: string) => plan.stages.find((stage) => stage.code === code)?.name
  const rows: [string, ReactNode][] = [
    [
      text("Đơn vị tổ chức", "Organizer"),
      organizer ? (
        <GoLink className="cp-organizer" to={`/pages/${organizer.code}`}>
          {organizer.logoUrl && <img src={organizer.logoUrl} alt="" />}
          {organizer.name}
        </GoLink>
      ) : (
        plan.organizer
      ),
    ],
    [
      text("Quỹ giải thưởng", "Prize pool"),
      plan.prizePool && (
        <LocalPrizeText
          text={plan.prizePool}
          currency={plan.currency}
          on={tournament.endsOn ?? tournament.startsOn}
          locale={languageTag}
        />
      ),
    ],
    [
      text("Hình thức", "Format"),
      [
        codeName(COMPETITION_TYPE_NAMES, tournament.competitionType, text),
        codeName(VENUE_MODE_NAMES, tournament.venueMode, text)?.toLocaleLowerCase(languageTag),
      ]
        .filter(Boolean)
        .join(", "),
    ],
    [
      text("Địa điểm", "Venue"),
      venues.length > 0 &&
        venues.map((venue, index) => {
          const stage = venues.length > 1 && venue.stageCode ? stageOf(venue.stageCode) : null
          return (
            <div key={index}>
              {[venue.name, venue.city].filter(Boolean).join(", ")}
              {stage && ` (${stageName(stage)})`}
            </div>
          )
        }),
    ],
    [text("Múi giờ của lịch", "Schedule time zone"), plan.timezone],
  ]
  const links = [
    ...(tournament.links ?? []),
    ...(plan.sourceUrl && !(tournament.links ?? []).some((link) => link.url === plan.sourceUrl)
      ? [{ label: text("Nguồn kiểm chứng", "Verification source"), url: plan.sourceUrl }]
      : []),
  ]
  return (
    <section className="tn-side-card">
      <h2>{text("Thông tin", "Information")}</h2>
      <dl className="tn-facts" data-variant={wide ? "wide" : undefined}>
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      {links.length > 0 && (
        <ul className="tn-links">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer noopener">
                {link.label}
                <StreamIcon name="external" size={13} />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="cp-meta">
        {text("Cập nhật:", "Updated:")} <LocalTime value={view.publishedAt} locale={languageTag} />
      </p>
    </section>
  )
}
