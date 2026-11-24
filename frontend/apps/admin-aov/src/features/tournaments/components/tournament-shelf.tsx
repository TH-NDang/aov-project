import { Link } from "react-router"
import { AlertTriangle, CalendarDays, Swords, Users } from "lucide-react"
import type { DocumentView, TournamentContent, TournamentStats as ContractStats } from "@aov/community-contracts"
import { StatusPill, TierBadge } from "@/features/esports/components/primitives"
import { dateRange } from "@/features/esports/model/labels"
import { tournamentTiming } from "../model/record-reason"
import { statusConflict } from "../model/tournament-status"
import { RegistryLogo } from "./registry-logo"
import { ProgressBar } from "./tournament-progress"

type TournamentStats = Omit<ContractStats, "tournamentId">
type Entry = DocumentView<TournamentContent>

/** Cards before the shelf gets longer than the list it leads. */
const SHELF = 6

/**
 * The tournaments an editor works on now, each one click away: on, coming up or announced, then those whose dates say
 * otherwise than their status. The list below keeps every tournament, these included, with its boxes and menus.
 */
export function TournamentShelf({
  entries,
  stats,
  href = (id) => `/tournaments/${id}`,
}: {
  entries: Entry[]
  stats?: Map<string, TournamentStats>
  href?: (id: string) => string
}) {
  if (!entries.length) return null
  return (
    <section aria-labelledby="active-tournaments" className="@container space-y-3">
      <h2 id="active-tournaments" className="type-section-title">
        Đang và sắp diễn ra
      </h2>
      <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {entries.slice(0, SHELF).map((entry) => (
          <ShelfCard key={entry.id} entry={entry} counts={stats?.get(entry.id)} href={href(entry.id)} />
        ))}
      </ul>
    </section>
  )
}

function ShelfCard({ entry, counts, href }: { entry: Entry; counts?: TournamentStats; href: string }) {
  const { content } = entry
  const timing = tournamentTiming(content)
  const conflict = statusConflict(content)
  const live = content.status === "ONGOING" && !conflict
  return (
    <li
      data-live={live || undefined}
      className="group relative flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/60 data-live:border-(--esp-live)/50"
    >
      <div className="flex min-w-0 items-start gap-3">
        <RegistryLogo url={content.logoUrl} darkUrl={content.logoDarkUrl} name={content.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusPill status={content.status} />
            <TierBadge tier={content.tier} compact />
          </span>
          <h3 className="type-section-title text-balance">
            {/* The whole card opens the tournament. */}
            <Link
              to={href}
              className="underline-offset-2 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {content.name}
            </Link>
          </h3>
        </div>
      </div>
      <p className="type-meta flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
          {dateRange(content.startsOn, content.endsOn)}
        </span>
        {!!counts?.teams && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Users className="size-3.5 shrink-0" aria-hidden="true" />
            {counts.teams} đội
          </span>
        )}
        {conflict ? (
          <span className="inline-flex items-center gap-1.5 text-(--aov-warning)">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            {conflict.reason}
          </span>
        ) : (
          timing && <span className="whitespace-nowrap text-foreground">{timing}</span>
        )}
      </p>
      {!!counts?.matches && (
        <div className="mt-auto flex items-center gap-2">
          <Swords className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <ProgressBar played={counts.played} matches={counts.matches} />
          <span className="type-meta whitespace-nowrap tabular-nums">
            {counts.played}/{counts.matches} trận
          </span>
        </div>
      )}
    </li>
  )
}
