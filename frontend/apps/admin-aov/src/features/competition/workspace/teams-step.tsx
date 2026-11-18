import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { Lane, PlayerContent, RosterMembershipContent } from "@aov/community-contracts"
import { Pencil, Trash2, UserRoundPlus, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { LaneIcon, PlayerPhoto, TeamLogo } from "@/features/esports/components/primitives"
import { useRecords } from "@/features/esports/data/use-esports-data"
import { LANE_LABELS } from "@/features/esports/model/labels"
import { RecordPicker } from "@/features/tournaments/components/record-picker"
import { TeamRecordSheet } from "@/features/tournaments/components/team-record-sheet"
import { TeamRosterSheet } from "@/features/tournaments/components/team-roster-sheet"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { rosterBoard, rosterOrder } from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"
import { selectClass } from "./plan-fields"
import { useRosterPlayers } from "./use-roster-players"

const ENTRY_STATUS: Record<string, string> = {
  REGISTERED: "Đã đăng ký",
  INVITED: "Khách mời",
  QUALIFIED: "Vượt vòng loại",
  WITHDRAWN: "Rút lui",
}

type Names = { players?: Map<string, PlayerContent>; loading: boolean }

const nicknameOf = (names: Names, playerId: string) =>
  names.players?.get(playerId)?.nickname ?? (names.loading ? "…" : "Chưa rõ tên")

/** A starter in the position they play: the largest thing in a roster, since it is what a reader looks for. */
function Starter({ lane, rows, names }: { lane: Lane; rows: RosterMembershipContent[]; names: Names }) {
  if (!rows.length)
    return (
      <div className="flex min-h-12 items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5">
        <LaneIcon lane={lane} size={16} className="shrink-0 opacity-50" />
        <span className="type-meta">Chưa có {LANE_LABELS[lane].short.toLowerCase()}</span>
      </div>
    )
  return (
    <div className="flex min-h-12 min-w-0 flex-col justify-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5">
      {rows.map((row) => {
        const nickname = nicknameOf(names, row.playerId)
        return (
          <div key={row.playerId} className="flex min-w-0 items-center gap-2" title={row.note ?? undefined}>
            <PlayerPhoto name={nickname} url={names.players?.get(row.playerId)?.photoUrl} size={32} />
            <span className="min-w-0">
              <span className="type-body block truncate">{nickname}</span>
              <span className="type-meta flex items-center gap-1">
                <LaneIcon lane={lane} size={14} className="shrink-0" />
                <span className="truncate">{LANE_LABELS[lane].short}</span>
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Everyone who is not a starter, small and on one line; `faded` marks those who no longer play for the team. */
function Others({
  label,
  rows,
  names,
  faded,
}: {
  label: string
  rows: RosterMembershipContent[]
  names: Names
  faded?: boolean
}) {
  if (!rows.length) return null
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="type-label text-muted-foreground">{label}</span>
      {rows.map((row) => {
        const nickname = nicknameOf(names, row.playerId)
        return (
          <span
            key={row.playerId}
            title={row.note ?? undefined}
            className={cn(
              "type-body inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5",
              faded && "text-muted-foreground opacity-70",
            )}
          >
            <PlayerPhoto name={nickname} url={names.players?.get(row.playerId)?.photoUrl} size={20} />
            {nickname}
            {row.lane && <LaneIcon lane={row.lane} size={14} className="shrink-0" />}
          </span>
        )
      })}
    </span>
  )
}

/** Entrants with their tournament rosters drawn out: who plays where, who waits on the bench and who left. */
export function TeamsStep({ ws }: { ws: Workspace }) {
  const [editing, setEditing] = useState(false)
  const [missingOnly, setMissingOnly] = useState(false)
  const [rosterTeam, setRosterTeam] = useState<string | null>(null)
  const [recordTeam, setRecordTeam] = useState<string | null>(null)
  const team = useQuery({
    queryKey: tournamentKeys.one("teams", ws.access.actorKey, rosterTeam),
    queryFn: ({ signal }) => tournamentApi.read("teams", rosterTeam!, signal),
    enabled: !!rosterTeam,
  })
  // The sheet names players from the whole directory, so it is loaded only once a roster is opened.
  const players = useRecords("players", !!rosterTeam)
  const rosterPlayers = useRosterPlayers(ws.entry.id, ws.access.actorKey, ws.rosters.length > 0)
  const names: Names = { players: rosterPlayers.data, loading: rosterPlayers.isPending }
  const rostersOf = (teamId: string) =>
    ws.rosters.filter((row) => row.content.teamId === teamId).map((row) => row.content)
  const missing = ws.plan.entrants.filter((entry) => !rostersOf(entry.teamId).length).length
  const shown = ws.plan.entrants.filter((entry) => !missingOnly || !rostersOf(entry.teamId).length)
  const setEntrants = (value: typeof ws.plan.entrants) => ws.change("entrants", value)
  const remove = async (teamId: string) => {
    const confirmed = await confirmAction({
      title: `Gỡ ${ws.team(teamId).name} khỏi giải?`,
      description: "Đội sẽ rời danh sách tham dự khi bạn lưu bản nháp. Hồ sơ đội và đội hình đã nhập không bị xóa.",
      confirmLabel: "Gỡ đội",
    })
    if (confirmed) setEntrants(ws.plan.entrants.filter((row) => row.teamId !== teamId))
  }

  return (
    <div className="space-y-4">
      {missing > 0 && (
        <Notice tone="warn">
          {missing} đội chưa có đội hình. Ván đấu chỉ gán được tuyển thủ khi đội đã có đội hình đăng ký ở giải này.
        </Notice>
      )}
      <Panel
        title={`Đội tham dự · ${ws.plan.entrants.length}`}
        icon={Users}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {missing > 0 && (
              <Button
                type="button"
                variant={missingOnly ? "secondary" : "ghost"}
                aria-pressed={missingOnly}
                onClick={() => setMissingOnly(!missingOnly)}
              >
                Chưa có đội hình · {missing}
              </Button>
            )}
            {ws.canEdit && (
              <Button type="button" variant="outline" onClick={() => setEditing(!editing)}>
                <Pencil aria-hidden /> {editing ? "Xong" : "Sửa danh sách"}
              </Button>
            )}
          </div>
        }
      >
        {shown.map((entry) => {
          const view = ws.team(entry.teamId)
          const rows = rostersOf(entry.teamId)
          const board = rosterBoard(rows)
          const used = ws.plan.matches.some(
            (match) => match.a.teamId === entry.teamId || match.b.teamId === entry.teamId,
          )
          return (
            <section key={entry.teamId} aria-label={view.name} className="border-b px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="type-meta w-4 text-right">{ws.plan.entrants.indexOf(entry) + 1}</span>
                <TeamLogo team={view} size={32} />
                <span className="type-body min-w-0 truncate">{view.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Sửa hồ sơ đội ${view.name} và tuyển thủ`}
                  title={`Sửa hồ sơ đội ${view.name} và tuyển thủ`}
                  onClick={() => setRecordTeam(entry.teamId)}
                >
                  <Pencil aria-hidden />
                </Button>
                {editing && ws.canEdit ? (
                  <select
                    aria-label={`Trạng thái ${view.name}`}
                    className={cn(selectClass, "h-9 w-40")}
                    value={entry.status || "REGISTERED"}
                    onChange={(event) =>
                      setEntrants(
                        ws.plan.entrants.map((row) =>
                          row.teamId === entry.teamId ? { ...row, status: event.target.value } : row,
                        ),
                      )
                    }
                  >
                    {Object.entries(ENTRY_STATUS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Chip tone={entry.status === "WITHDRAWN" ? "danger" : "neutral"}>
                    {ENTRY_STATUS[entry.status] ?? ENTRY_STATUS.REGISTERED}
                  </Chip>
                )}
                {rows.length ? (
                  <span className="type-meta">{rows.length} tuyển thủ</span>
                ) : (
                  <Chip tone="warn">Chưa có đội hình</Chip>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant={rows.length ? "ghost" : "outline"}
                    onClick={() => setRosterTeam(entry.teamId)}
                  >
                    <UserRoundPlus aria-hidden /> {rows.length ? "Sửa đội hình" : "Thêm đội hình"}
                  </Button>
                  {editing && ws.canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Gỡ ${view.name} khỏi giải`}
                      title={used ? "Đội đang có trong lịch đấu nên chưa gỡ được" : `Gỡ ${view.name} khỏi giải`}
                      disabled={used}
                      onClick={() => void remove(entry.teamId)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </span>
              </div>
              {rows.length > 0 && (
                <>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {board.lanes.map((cell) => (
                      <Starter key={cell.lane} lane={cell.lane} rows={cell.players} names={names} />
                    ))}
                  </div>
                  {rows.length > board.lanes.reduce((sum, cell) => sum + cell.players.length, 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                      <Others label="Chính thức, chưa rõ vị trí" rows={board.unplaced} names={names} />
                      <Others label="Dự bị" rows={board.bench} names={names} />
                      <Others label="Đã rời" rows={board.left} names={names} faded />
                      <Others label="Chưa rõ vai trò" rows={board.unknown} names={names} />
                    </div>
                  )}
                </>
              )}
            </section>
          )
        })}
        {!ws.plan.entrants.length && (
          <p className="type-body px-4 py-6 text-muted-foreground">
            Chưa có đội tham dự. Bấm "Sửa danh sách" để thêm đội.
          </p>
        )}
        {rosterPlayers.isError && (
          <p className="type-meta border-t px-4 py-2">
            Chưa tải được tên tuyển thủ. Mở "Sửa đội hình" để xem chi tiết.
          </p>
        )}
        {editing && ws.canEdit && (
          <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3">
            <div className="max-w-md min-w-64">
              <RecordPicker
                kind="teams"
                value=""
                label="Thêm đội tham dự"
                context={{ tournamentId: ws.entry.id }}
                exclude={ws.plan.entrants.map((row) => row.teamId)}
                onChange={(teamId, name) => {
                  if (!teamId) return
                  ws.rememberTeam(teamId, name)
                  setEntrants([...ws.plan.entrants, { teamId, status: "REGISTERED", note: "" }])
                }}
              />
            </div>
            <Link className="type-body underline" to="/teams">
              Tạo hồ sơ đội
            </Link>
            <span className="type-meta">Danh sách đội được ghi khi bạn bấm Lưu bản nháp.</span>
          </div>
        )}
      </Panel>
      <Link className="type-body underline" to="/players">
        Quản lý hồ sơ tuyển thủ
      </Link>
      {recordTeam && (
        <TeamRecordSheet
          teamId={recordTeam}
          playerIds={rosterOrder(rostersOf(recordTeam)).map((row) => row.playerId)}
          actorKey={ws.access.actorKey}
          canWrite={ws.access.canWrite}
          onClose={() => setRecordTeam(null)}
        />
      )}
      {rosterTeam && team.data && (
        <TeamRosterSheet
          team={team.data}
          players={players.data || []}
          initialTournamentId={ws.entry.id}
          canWrite={ws.access.canWrite}
          actorKey={ws.access.actorKey}
          onClose={() => setRosterTeam(null)}
        />
      )}
    </div>
  )
}
