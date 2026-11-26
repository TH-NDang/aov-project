import { useCallback, useMemo } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, SeriesContent } from "@aov/community-contracts"
import { Swords } from "lucide-react"
import { Skeleton } from "@aov/ui/components/skeleton"
import { parseClock } from "@/lib/clock"
import { initialGame } from "@/features/tournaments/model/tournament-model"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { EmptyState } from "../components/primitives"
import { useFullscreen } from "../components/series/use-fullscreen"
import { withSeats } from "../data/game-seats"
import { useGames, useRecords, useRosters } from "../data/use-esports-data"
import { useTournamentView } from "../data/use-tournament-view"
import { byStanding, type RosterOption } from "../model/line-up"
import { hasEveryGame } from "../model/series-score"
import { AccessGate, EsportsPage, LoadError, StudioPage, tournamentPath, type Access } from "./esports-shell"
import { MatchStudio, type GameStart } from "./match-studio"

const linkSecond = (value: string | null) =>
  value === null ? null : /^\d+$/.test(value) ? Number(value) : parseClock(value)

export function MatchPage() {
  return <AccessGate pending={<StudioSkeleton />}>{(access) => <MatchView access={access} />}</AccessGate>
}

/** The desk before its match is there: everything where it will be. */
function StudioSkeleton() {
  return (
    <StudioPage aria-busy="true" aria-label="Đang tải trận đấu">
      <div className="esp-desk">
        <div className="esp-head">
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <div className="esp-watch">
          <div className="esp-view" />
          <div className="flex min-h-12 items-center px-3 min-[900px]:min-h-11">
            <Skeleton className="h-5 w-60" />
          </div>
          <div className="flex min-h-7 items-center px-3">
            <Skeleton className="h-5 w-full" />
          </div>
          <div className="min-h-8" />
        </div>
        <div className="esp-dock">
          <div className="esp-games" />
          <div className="esp-tools" />
          <div className="esp-notice" />
          <div className="esp-body space-y-3 p-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-7 w-full" />
            ))}
          </div>
        </div>
      </div>
    </StudioPage>
  )
}

function MatchView({ access }: { access: Access }) {
  const { tournamentId = "", seriesId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  // The desk of the next match keeps the whole screen, so full screen belongs to the page.
  const { fullscreen, toggle } = useFullscreen()
  const view = useTournamentView(tournamentId)
  const players = useRecords("players")
  const games = useGames(seriesId)
  const rosters = useRosters(tournamentId)
  const record = view.records.find((entry) => entry.id === seriesId) as DocumentView<SeriesContent> | undefined
  const sorted = useMemo(
    () => (games.data ?? []).map(withSeats).sort((a, b) => a.content.number - b.content.number),
    [games.data],
  )
  const setParam = useCallback(
    (values: Record<string, string | null>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(values)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  const onConsumeLink = useCallback(() => setParam({ game: null, t: null, view: null }), [setParam])
  const create = useMutation({
    mutationFn: async ({ number, start }: { seriesId: string; number: number; start: GameStart | null }) => {
      if (!record) throw new Error("Không tìm thấy trận.")
      const content = initialGame(record.id, record.content, number, view.tournament?.content.region ?? "VN")
      // A game recorded from the broadcast opens with its ban/pick phase where the admin paused the video.
      const created = await tournamentApi.create(
        "games",
        start
          ? { ...content, sourceUrl: start.url, draft: { startSecond: start.second, lockedSecond: null, turns: [] } }
          : content,
      )
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      if (start && created.content.draft?.startSecond == null)
        throw new Error(
          `Đã tạo ván ${number} nhưng máy chủ giải đấu chưa lưu được giai đoạn cấm chọn. Khởi động lại community-service bản mới, rồi dùng “Vào trận” để đặt mốc ván.`,
        )
      return created.id
    },
    meta: { silent: true },
  })
  const roster = useMemo(() => {
    const profiles = new Map((players.data ?? []).map((player) => [player.id, player.content]))
    const byTeam = new Map<string, RosterOption[]>()
    // Members who left stay listed, last, so a game they played can still name them; filling never seats them.
    for (const { content } of rosters.data ?? []) {
      const members = byTeam.get(content.teamId) ?? []
      members.push({
        id: content.playerId,
        name: profiles.get(content.playerId)?.nickname ?? "Tuyển thủ",
        photoUrl: profiles.get(content.playerId)?.photoUrl,
        lane: content.lane,
        status: content.status,
      })
      byTeam.set(content.teamId, members)
    }
    for (const members of byTeam.values()) members.sort(byStanding)
    return (teamId: string) => byTeam.get(teamId) ?? []
  }, [players.data, rosters.data])

  // The page stays when the next match is opened; a game being made, or refused, belongs to the match it was made for.
  const creating = create.variables?.seriesId === seriesId
  // A refetch that fails while the desk is up leaves it there, with what was read before.
  const loaded = !!record && !!view.tournament && !!games.data && view.teams.length > 0
  if (!loaded && (view.error || games.error))
    return (
      <EsportsPage>
        <LoadError
          error={view.error ?? games.error}
          onRetry={() => void Promise.all([view.refetch(), games.refetch()])}
        />
      </EsportsPage>
    )
  if (view.pending || games.isPending || players.isPending) return <StudioSkeleton />
  if (!record || !view.tournament)
    return (
      <EsportsPage>
        <EmptyState icon={<Swords size={28} />} title="Không tìm thấy trận đấu">
          <Link to={tournamentPath(tournamentId)} className="underline">
            Về trang giải
          </Link>
        </EmptyState>
      </EsportsPage>
    )

  return (
    <MatchStudio
      key={seriesId}
      series={record}
      records={view.records}
      tournament={view.tournament}
      games={sorted}
      teams={view.teams}
      team={view.team}
      players={players.data ?? []}
      roster={roster}
      access={access}
      editable={access.canWrite && params.get("edit") === "1"}
      onMode={(recording) => setParam({ edit: recording ? "1" : null })}
      addGame={{
        // A match whose score is complete gets another game only after its score changed.
        allowed: access.canWrite && sorted.length < record.content.bestOf && !hasEveryGame(record.content, sorted),
        pending: creating && create.isPending,
        failure: creating && create.isError ? tournamentError(create.error) : null,
        onAdd: (number, start) => create.mutateAsync({ seriesId, number, start }),
      }}
      requestedGame={params.get("game")}
      fromLink={linkSecond(params.get("t"))}
      openInfo={params.get("view") === "data"}
      onConsumeLink={onConsumeLink}
      fullscreen={fullscreen}
      onFullscreen={toggle}
    />
  )
}
