import { useCallback, useMemo, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, SeriesContent } from "@aov/community-contracts"
import { PenLine, Pencil, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { RegistryEditor } from "@/features/tournaments/components/registry-editor"
import { initialGame } from "@/features/tournaments/model/tournament-model"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { parseClock } from "@/lib/clock"
import { useGames, useRecords, useRosters } from "../data/use-esports-data"
import { useTournamentView } from "../data/use-tournament-view"
import { EmptyState } from "../components/primitives"
import { byStanding, type RosterOption } from "../components/game/draft-editor"
import { MatchHeader } from "../components/series/match-header"
import { seriesLabel } from "../model/series-label"
import { stageInfo } from "../model/labels"
import { AccessGate, Crumbs, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"
import type { GameStart } from "./match-recording-tools"
import { MatchViewer } from "./match-viewer"

const linkSecond = (value: string | null) =>
  value === null ? null : /^\d+$/.test(value) ? Number(value) : parseClock(value)

export function MatchPage() {
  return <AccessGate>{(access) => <MatchView access={access} />}</AccessGate>
}

function MatchView({ access }: { access: Access }) {
  const { tournamentId = "", seriesId = "" } = useParams()
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const view = useTournamentView(tournamentId)
  const players = useRecords("players")
  const games = useGames(seriesId)
  const rosters = useRosters(tournamentId)
  const record = view.records.find((entry) => entry.id === seriesId)
  const sorted = useMemo(
    () => [...(games.data ?? [])].sort((a, b) => a.content.number - b.content.number),
    [games.data],
  )
  const [editing, setEditing] = useState(false)
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
  const create = useMutation({
    mutationFn: async ({ number, start }: { number: number; start: GameStart | null }) => {
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
    const names = new Map((players.data ?? []).map((player) => [player.id, player.content.nickname]))
    const byTeam = new Map<string, RosterOption[]>()
    // Members who left stay listed, last, so a game they played can still name them; filling never seats them.
    for (const { content } of rosters.data ?? []) {
      const members = byTeam.get(content.teamId) ?? []
      members.push({
        id: content.playerId,
        name: names.get(content.playerId) ?? "Tuyển thủ",
        lane: content.lane,
        status: content.status,
      })
      byTeam.set(content.teamId, members)
    }
    for (const members of byTeam.values()) members.sort(byStanding)
    return (teamId: string) => byTeam.get(teamId) ?? []
  }, [players.data, rosters.data])

  if (view.error || games.error)
    return (
      <EsportsPage>
        <LoadError
          error={view.error ?? games.error}
          onRetry={() => void Promise.all([view.refetch(), games.refetch()])}
        />
      </EsportsPage>
    )
  if (view.pending || games.isPending || players.isPending)
    return (
      <EsportsPage>
        <div className="aspect-video max-h-[60vh] animate-pulse rounded-2xl bg-muted" />
      </EsportsPage>
    )
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

  const nextNumber = Math.max(0, ...sorted.map((entry) => entry.content.number)) + 1
  const canAddGame = access.canWrite && sorted.length < record.content.bestOf

  return (
    <EsportsPage>
      <Crumbs
        items={[
          { label: "Giải đấu", to: "/tournaments" },
          { label: view.tournament.content.name, to: tournamentPath(tournamentId) },
          { label: seriesLabel(record.content) || stageInfo(record.content.stage).label },
        ]}
      />
      <MatchHeader content={record.content} team={view.team}>
        {access.canWrite && (
          <>
            <Button
              size="sm"
              variant={params.get("edit") === "1" ? "default" : "secondary"}
              aria-pressed={params.get("edit") === "1"}
              onClick={() => setParam({ edit: params.get("edit") === "1" ? null : "1" })}
            >
              <PenLine size={14} /> {params.get("edit") === "1" ? "Đang ghi" : "Chế độ ghi"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Sửa trận
            </Button>
          </>
        )}
      </MatchHeader>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {tournamentError(create.error)}
        </p>
      )}
      <MatchViewer
        key={seriesId}
        series={record}
        games={sorted}
        teams={view.teams}
        players={players.data ?? []}
        roster={roster}
        editable={access.canWrite && params.get("edit") === "1"}
        canWrite={access.canWrite}
        canPublish={access.canPublish}
        onEnableEditing={() => setParam({ edit: "1" })}
        requestedGame={params.get("game")}
        fromLink={linkSecond(params.get("t"))}
        // Links to the former game data page open the same game with its info panel.
        openInfo={params.get("view") === "data"}
        onConsumeLink={() => setParam({ game: null, t: null, view: null })}
        tournamentRegion={view.tournament.content.region}
        resultNote={
          record.content.result && !sorted.length
            ? `Tỉ số cho biết đã đấu ${(record.content.result.scoreA ?? 0) + (record.content.result.scoreB ?? 0)} ván nhưng chưa ghi ván nào.`
            : null
        }
        addGame={
          canAddGame
            ? {
                number: nextNumber,
                pending: create.isPending,
                onAdd: (start) => create.mutateAsync({ number: nextNumber, start }),
              }
            : null
        }
      />
      {record.content.note && (
        <section className="admin-section px-4 py-3 text-sm text-muted-foreground">{record.content.note}</section>
      )}
      {editing && (
        <RegistryEditor
          kind="series"
          entry={record as DocumentView<SeriesContent>}
          open
          onClose={() => setEditing(false)}
          tournamentId={tournamentId}
        />
      )}
    </EsportsPage>
  )
}
