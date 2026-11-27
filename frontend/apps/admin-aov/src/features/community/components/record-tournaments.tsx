import { Link, useLocation } from "react-router"
import { useQueries, useQuery } from "@tanstack/react-query"
import type { RosterMembershipContent } from "@aov/community-contracts"
import { ArrowRight, CalendarDays } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { RankBadge } from "@aov/ui/components/rank-badge"
import { ThemedLogoImg } from "@/components/themed-logo-img"
import { Section } from "@/features/community/components/profile-form-primitives"
import { LINE_STATUS_LABELS } from "@/features/competition/peek/peek-model"
import { teamViewOf } from "@/features/competition/workspace/parts"
import { backState } from "@/features/competition/peek/peek-model"
import { TeamLogo } from "@/features/esports/components/primitives"
import { dateRange } from "@/features/esports/model/labels"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { TOURNAMENT_STATUSES } from "@/features/tournaments/components/tournament-metadata"

type Line = { tournamentId: string; teamId: string; lines: RosterMembershipContent[] }

/** The lines of a record grouped by tournament and team: a player may play for two teams in one tournament. */
function groupLines(rows: RosterMembershipContent[]) {
  const groups = new Map<string, Line>()
  for (const row of rows) {
    const key = `${row.tournamentId}:${row.teamId}`
    const group = groups.get(key) ?? { tournamentId: row.tournamentId, teamId: row.teamId, lines: [] }
    group.lines.push(row)
    groups.set(key, group)
  }
  return [...groups.values()]
}

/**
 * The tournaments a team or a player has a roster line in, newest first, each leading to that team in the tournament
 * and keeping the way back to this profile.
 */
export function RecordTournaments({
  kind,
  entityId,
  actorKey,
  profileName,
}: {
  kind: "TEAM" | "PLAYER"
  entityId: string
  actorKey: string
  profileName: string
}) {
  const location = useLocation()
  const lines = useQuery({
    queryKey: tournamentKeys.rostersOf(actorKey, kind, entityId),
    queryFn: ({ signal }) =>
      tournamentApi.list("roster-memberships", signal, kind === "TEAM" ? { teamId: entityId } : { playerId: entityId }),
    select: (rows) => groupLines(rows.map((row) => row.content)),
  })
  const groups = lines.data ?? []
  const tournamentIds = [...new Set(groups.map((group) => group.tournamentId))]
  const tournaments = useQueries({
    queries: tournamentIds.map((id) => ({
      queryKey: tournamentKeys.one("tournaments", actorKey, id),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.read("tournaments", id, signal),
      staleTime: 60_000,
    })),
  })
  const teamIds = kind === "PLAYER" ? [...new Set(groups.map((group) => group.teamId))] : []
  const teams = useQueries({
    queries: teamIds.map((id) => ({
      queryKey: tournamentKeys.one("teams", actorKey, id),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.read("teams", id, signal),
      staleTime: 60_000,
    })),
  })
  const tournamentOf = (id: string) => tournaments[tournamentIds.indexOf(id)]?.data?.content
  const teamOf = (id: string) => teams[teamIds.indexOf(id)]?.data?.content
  const rows = groups
    .map((group) => ({ ...group, tournament: tournamentOf(group.tournamentId) }))
    .sort((a, b) => (b.tournament?.startsOn ?? "").localeCompare(a.tournament?.startsOn ?? ""))
  const back = backState({ label: profileName, to: location.pathname + location.search })

  return (
    <Section
      title="Giải đấu"
      icon={CalendarDays}
      description={
        kind === "TEAM"
          ? "Các giải có đội hình của đội, mới nhất trước."
          : "Các giải có tuyển thủ trong đội hình, mới nhất trước."
      }
    >
      {lines.isPending ? (
        <p className="type-body" role="status">
          Đang tải giải đấu…
        </p>
      ) : lines.isError ? (
        <div className="space-y-3" role="alert">
          <p className="type-body">Chưa tải được giải đấu. Hãy kiểm tra kết nối và thử lại.</p>
          <Button variant="outline" onClick={() => void lines.refetch()}>
            Thử lại
          </Button>
        </div>
      ) : !rows.length ? (
        <div className="space-y-2 rounded-lg border border-dashed p-6">
          <h3 className="type-section-title">Chưa có trong đội hình giải nào</h3>
          <p className="type-body text-muted-foreground">
            Thêm {kind === "TEAM" ? "đội hình của đội" : "tuyển thủ vào đội hình"} ở bước Đội & đội hình của một giải.
          </p>
        </div>
      ) : (
        <>
          <p className="type-meta">{tournamentIds.length} giải</p>
          <div className="divide-y rounded-lg border">
            {rows.map(({ tournamentId, teamId, lines: own, tournament }) => {
              const place = tournament?.placements?.find((row) => row.teamId === teamId)?.place
              const team = teamOf(teamId)
              const status = own[0]?.status ?? "UNKNOWN"
              return (
                <Link
                  key={`${tournamentId}:${teamId}`}
                  to={`/tournaments/${tournamentId}?step=teams&team=${teamId}`}
                  state={back}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    <ThemedLogoImg
                      url={tournament?.logoUrl}
                      darkUrl={tournament?.logoDarkUrl}
                      className="size-full object-contain"
                      fallback={<CalendarDays className="size-5 text-muted-foreground" />}
                    />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="type-section-title break-words">{tournament?.name ?? "Đang tải giải…"}</h3>
                    <p className="type-meta">
                      {dateRange(tournament?.startsOn, tournament?.endsOn)}
                      {tournament?.status && tournament.status !== "UNKNOWN"
                        ? ` · ${TOURNAMENT_STATUSES[tournament.status]}`
                        : ""}
                    </p>
                    <p className="type-meta flex min-w-0 items-center gap-1.5">
                      {kind === "PLAYER" ? (
                        <>
                          <TeamLogo team={teamViewOf(teamId, team)} size={18} />
                          <span className="truncate">{team?.name ?? "Đội"}</span>
                          <span aria-hidden>·</span>
                          {LINE_STATUS_LABELS[status]}
                        </>
                      ) : (
                        `${own.length} tuyển thủ`
                      )}
                    </p>
                  </div>
                  {place && <RankBadge place={place.replace(/\s*-\s*/, "–")} size={32} />}
                  <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                </Link>
              )
            })}
          </div>
        </>
      )}
    </Section>
  )
}
