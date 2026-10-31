import { CalendarDays, ChevronRight } from "lucide-react"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { TableCell, TableRow } from "@aov/ui/components/table"
import { StatusPill } from "@/features/esports/components/primitives"
import type { TournamentStats } from "@/features/esports/components/tournament-cards"
import { dateRange, TIER_LABELS } from "@/features/esports/model/labels"
import { ManagementTable } from "./management-list"
import { RegistryLogo } from "./registry-logo"
import { TeamRegionBadge } from "./team-region"

export function TournamentList({
  entries,
  stats,
  onOpen,
}: {
  entries: DocumentView<TournamentContent>[]
  stats: Map<string, TournamentStats>
  onOpen: (entry: DocumentView<TournamentContent>) => void
}) {
  return (
    <ManagementTable
      label="Danh sách giải đấu"
      columns={[
        { label: "Giải đấu" },
        { label: "Khu vực", className: "hidden w-40 @4xl:table-cell" },
        { label: "Trạng thái", className: "hidden w-40 @2xl:table-cell" },
        { label: "Trận đấu", className: "hidden w-40 @4xl:table-cell" },
      ]}
    >
      {entries.map((entry) => {
        const content = entry.content
        const counts = stats.get(entry.id) ?? { teams: 0, matches: 0, played: 0 }
        return (
          <TableRow key={entry.id}>
            <TableCell>
              <button
                type="button"
                onClick={() => onOpen(entry)}
                aria-label={`Mở giải ${content.name}`}
                className="group flex w-full min-w-0 items-start gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RegistryLogo url={content.logoUrl} name={content.name} />
                <span className="min-w-0 flex-1 space-y-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="type-body">{content.name}</strong>
                    {content.tier && content.tier !== "UNKNOWN" && (
                      <span className="type-label rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {TIER_LABELS[content.tier]}
                      </span>
                    )}
                  </span>
                  <span className="type-meta flex items-start gap-1.5">
                    <CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {dateRange(content.startsOn, content.endsOn)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 @4xl:hidden">
                    <TeamRegionBadge code={content.region} />
                    <span className="type-meta">
                      {counts.teams} đội · {counts.played}/{counts.matches} trận đã đấu
                    </span>
                  </span>
                  <span className="block @2xl:hidden">
                    <StatusPill status={content.status} />
                  </span>
                </span>
                <ChevronRight
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </TableCell>
            <TableCell className="hidden @4xl:table-cell">
              <TeamRegionBadge code={content.region} />
              <p className="type-meta mt-1.5">{counts.teams} đội tham dự</p>
            </TableCell>
            <TableCell className="hidden @2xl:table-cell">
              <StatusPill status={content.status} />
            </TableCell>
            <TableCell className="hidden @4xl:table-cell">
              <span className="type-body tabular-nums">
                {counts.played}
                <span className="text-muted-foreground"> / {counts.matches}</span>
              </span>
              <p className="type-meta mt-1">Đã có kết quả</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary/60"
                  style={{ width: `${counts.matches ? (counts.played / counts.matches) * 100 : 0}%` }}
                />
              </div>
            </TableCell>
          </TableRow>
        )
      })}
    </ManagementTable>
  )
}
