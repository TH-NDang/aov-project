import type { ReactNode } from "react"
import { Link } from "react-router"
import type { CompetitionView } from "@aov/community-contracts"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { CompetitionLogo } from "../../../components/competition-card"
import { dayRange } from "../../../components/community-ui"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import "./participant-parts.css"

/** A titled part of a team's or a player's page. */
export function Part({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-part">
      <div className="tn-heading" data-flush="">
        <h2>
          {title} {note && <small>{note}</small>}
        </h2>
      </div>
      {children}
    </section>
  )
}

/** One competition of a team or a player: the place taken, the competition, and what the page adds to it. */
export function SeasonLine({
  view,
  place,
  children,
}: {
  view: CompetitionView
  /** The place taken, null while it is unknown; left out for someone who takes none. */
  place?: string | null
  children?: ReactNode
}) {
  const { text } = useStreamLocale()
  const { tournament } = view.content
  return (
    <li className="pt-season" data-placeless={place === undefined || undefined}>
      {place !== undefined && (
        <span className="pt-season-place">
          {place ? (
            <>
              <span className="sr-only">{text("Hạng", "Place")} </span>
              <RankBadge place={place} size={medalOf(place) ? 36 : 28} />
            </>
          ) : (
            <span aria-hidden="true">–</span>
          )}
        </span>
      )}
      <CompetitionLogo name={tournament.name} url={tournament.logoUrl} darkUrl={tournament.logoDarkUrl} />
      <span className="pt-season-name">
        <Link to={`/competitions/${view.id}`}>{tournament.name}</Link>
        <small>{dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}</small>
      </span>
      {children && <span className="pt-season-more">{children}</span>}
      <StreamIcon name="chevronRight" size={16} />
    </li>
  )
}

/** The state of a page whose team or player no published competition names. */
export function ParticipantMissing({ title, back, to }: { title: string; back: string; to: string }) {
  const { text } = useStreamLocale()
  return (
    <div className="hub-state">
      <h1>{title}</h1>
      <p>
        {text(
          "Trang này xuất hiện khi có giải đấu đã công bố nhắc tới.",
          "The page appears once a published tournament names it.",
        )}
      </p>
      <Link className="cp-button" to={to}>
        {back}
      </Link>
    </div>
  )
}
