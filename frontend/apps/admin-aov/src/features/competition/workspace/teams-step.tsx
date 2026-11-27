import { useEffect, useState } from "react"
import {
  personRoleLabels,
  type DocumentView,
  type Lane,
  type PlayerContent,
  type RosterMembershipContent,
  type StaffMember,
  type TeamContent,
  type TournamentContent,
} from "@aov/community-contracts"
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  CopyPlus,
  Crown,
  Pencil,
  Plus,
  Trash2,
  UserRoundPlus,
  Users,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { LaneIcon, PlayerPhoto, TeamLogo } from "@/features/esports/components/primitives"
import { CreateProfileSheet } from "@/features/community/components/create-profile-sheet"
import { PasteNamesDialog } from "@/features/tournaments/components/paste-names-dialog"
import { RecordPicker } from "@/features/tournaments/components/record-picker"
import { RosterBoardSheet } from "@/features/tournaments/components/roster-board-sheet"
import { TeamRecordSheet } from "@/features/tournaments/components/team-record-sheet"
import { PersonChip, type KnownPeople } from "@/features/tournaments/components/crew-people"
import { staffOfTeam } from "@/features/tournaments/model/crew-model"
import { tournamentApi } from "@/features/tournaments/api/tournament-api"
import { FillMissingRosters } from "./missing-rosters"
import { PlayerName, TeamName } from "../peek/competitor-peek"
import { ENTRY_STATUS_LABELS } from "../peek/peek-model"
import { rosterBoard, rosterOrder } from "./model"
import { Chip, Panel, type Workspace } from "./parts"
import { useRosterPlayers } from "./use-roster-players"
import { NativeSelect } from "@/components/native-select"
import { LANE_LABELS } from "@/lib/lanes"

type Names = { players?: Map<string, PlayerContent>; loading: boolean }

const nicknameOf = (names: Names, playerId: string) =>
  names.players?.get(playerId)?.nickname ?? (names.loading ? "…" : "Chưa rõ tên")

/** The crown after a captain's name. */
const CaptainMark = ({ row }: { row: RosterMembershipContent }) =>
  row.captain ? (
    <span role="img" aria-label="Đội trưởng" title="Đội trưởng" className="shrink-0 text-(--aov-warning)">
      <Crown aria-hidden className="size-3.5 fill-current" />
    </span>
  ) : null

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
              <span className="type-body flex min-w-0 items-center gap-1">
                <PlayerName id={row.playerId}>{nickname}</PlayerName>
                <CaptainMark row={row} />
              </span>
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
            <PlayerName id={row.playerId}>{nickname}</PlayerName>
            <CaptainMark row={row} />
            {row.lane && <LaneIcon lane={row.lane} size={14} className="shrink-0" />}
          </span>
        )
      })}
    </span>
  )
}

/** A team's coaches and analysts at this tournament, on one line under its roster; edited in the roster sheet. */
function Staff({ lines, people, actorKey }: { lines: StaffMember[]; people: KnownPeople; actorKey: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="type-label text-muted-foreground">Ban huấn luyện</span>
      {lines.length ? (
        lines.map((line) => (
          <PersonChip
            key={`${line.pageId}-${line.role}`}
            pageId={line.pageId}
            known={people?.[line.pageId]}
            actorKey={actorKey}
            meta={line.title || personRoleLabels[line.role]}
          />
        ))
      ) : (
        <span className="type-meta">Chưa có</span>
      )}
    </div>
  )
}

/**
 * Entrants with their tournament rosters drawn out: who plays where, who waits on the bench and who left, and the
 * team's staff. `tournament` is the record that holds the staff; absent while it loads.
 */
export function TeamsStep({ ws, tournament }: { ws: Workspace; tournament?: DocumentView<TournamentContent> }) {
  const [editing, setEditing] = useState(!ws.plan.entrants.length)
  const [missingOnly, setMissingOnly] = useState(ws.focus.show === "NO_ROSTER")
  const { team: focusTeam, open: focusOpen } = ws.focus
  const [rosterTeam, setRosterTeam] = useState<string | null>(focusTeam && focusOpen === "roster" ? focusTeam : null)
  const [recordTeam, setRecordTeam] = useState<string | null>(focusTeam && focusOpen === "record" ? focusTeam : null)
  const [adding, setAdding] = useState<"paste" | "create" | null>(null)
  // A link to one team, from its profile or a card, lands on that team.
  const landing = focusTeam && !focusOpen ? focusTeam : null
  useEffect(() => {
    if (landing) document.getElementById(`entrant-${landing}`)?.scrollIntoView({ block: "center" })
  }, [landing])
  const rosterPlayers = useRosterPlayers(ws.entry.id, ws.access.actorKey, ws.rosters.length > 0)
  const names: Names = { players: rosterPlayers.data, loading: rosterPlayers.isPending }
  const rostersOf = (teamId: string) =>
    ws.rosters.filter((row) => row.content.teamId === teamId).map((row) => row.content)
  const missing = ws.plan.entrants.filter((entry) => !rostersOf(entry.teamId).length).length
  const shown = ws.plan.entrants.filter((entry) => !missingOnly || !rostersOf(entry.teamId).length)
  const setEntrants = (value: typeof ws.plan.entrants) => ws.change("entrants", value)
  const missingIds = ws.plan.entrants
    .filter((entry) => entry.status !== "WITHDRAWN" && !rostersOf(entry.teamId).length)
    .map((entry) => entry.teamId)
  const addTeams = (teams: { id: string; name: string; content?: TeamContent }[]) => {
    const fresh = teams.filter((team) => !ws.plan.entrants.some((entry) => entry.teamId === team.id))
    for (const team of fresh) ws.rememberTeam(team.id, team.name, team.content)
    setEntrants([...ws.plan.entrants, ...fresh.map((team) => ({ teamId: team.id, status: "REGISTERED", note: "" }))])
  }
  const move = (teamId: string, offset: -1 | 1) => {
    const next = [...ws.plan.entrants]
    const at = next.findIndex((entry) => entry.teamId === teamId)
    const other = next[at + offset]
    if (!other) return
    next[at + offset] = next[at]!
    next[at] = other
    setEntrants(next)
  }
  const remove = async (teamId: string) => {
    const confirmed = await confirmAction({
      title: `Gỡ ${ws.team(teamId).name} khỏi giải?`,
      description: "Đội sẽ rời danh sách tham dự khi bạn lưu bản nháp. Hồ sơ đội và đội hình đã nhập không bị xóa.",
      confirmLabel: "Gỡ đội",
    })
    if (!confirmed) return
    // A stage or a seeding may only name entrants, so the team leaves them in the same step.
    ws.changeAll({
      entrants: ws.plan.entrants.filter((row) => row.teamId !== teamId),
      stages: ws.plan.stages.map((stage) =>
        stage.teamIds?.includes(teamId) ? { ...stage, teamIds: stage.teamIds.filter((id) => id !== teamId) } : stage,
      ),
      playoffSeeds: Object.fromEntries(Object.entries(ws.plan.playoffSeeds).filter(([, id]) => id !== teamId)),
    })
  }

  return (
    <div className="space-y-4">
      {ws.loaded && missing > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-(--aov-warning-soft) px-3.5 py-2.5">
          <span className="type-body">
            {missing} đội chưa có đội hình nên ván đấu của các đội này chưa gán được tuyển thủ.
          </span>
          {ws.canEdit && missingIds.length > 0 && <FillMissingRosters ws={ws} teamIds={missingIds} />}
        </div>
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
            {ws.canEdit && !ws.plan.entrants.length && (
              <Button type="button" variant="outline" onClick={() => ws.openCopy(["entrants", "rosters", "staff"])}>
                <CopyPlus aria-hidden /> Chép từ giải khác
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
        {editing && ws.canEdit && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
            <span className="w-64">
              <RecordPicker
                kind="teams"
                value=""
                label="Thêm đội tham dự"
                context={{ tournamentId: ws.entry.id }}
                exclude={ws.plan.entrants.map((row) => row.teamId)}
                onChange={(teamId, name) => {
                  if (!teamId) return
                  addTeams([{ id: teamId, name }])
                  void tournamentApi
                    .read("teams", teamId)
                    .then((team) => ws.rememberTeam(teamId, team.content.name, team.content))
                }}
              />
            </span>
            <Button type="button" variant="outline" onClick={() => setAdding("paste")}>
              <ClipboardList aria-hidden /> Dán danh sách
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding("create")}>
              <Plus aria-hidden /> Tạo đội mới
            </Button>
            <Button type="button" variant="outline" onClick={() => ws.openCopy(["entrants", "rosters", "staff"])}>
              <CopyPlus aria-hidden /> Chép từ giải khác
            </Button>
          </div>
        )}
        {shown.map((entry) => {
          const view = ws.team(entry.teamId)
          const rows = rostersOf(entry.teamId)
          const board = rosterBoard(rows)
          const used = ws.plan.matches.some(
            (match) => match.a.teamId === entry.teamId || match.b.teamId === entry.teamId,
          )
          return (
            <section
              key={entry.teamId}
              id={`entrant-${entry.teamId}`}
              aria-label={view.name}
              className={cn(
                "scroll-mt-24 border-b px-4 py-3 last:border-b-0",
                landing === entry.teamId && "bg-(--aov-accent-soft)",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="type-meta w-4 text-right">{ws.plan.entrants.indexOf(entry) + 1}</span>
                <TeamLogo team={view} size={32} />
                <TeamName id={entry.teamId} className="type-section-title min-w-0" />
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
                  <NativeSelect
                    aria-label={`Trạng thái ${view.name}`}
                    className="w-40"
                    value={entry.status || "REGISTERED"}
                    onChange={(event) =>
                      setEntrants(
                        ws.plan.entrants.map((row) =>
                          row.teamId === entry.teamId ? { ...row, status: event.target.value } : row,
                        ),
                      )
                    }
                  >
                    {Object.entries(ENTRY_STATUS_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Chip tone={entry.status === "WITHDRAWN" ? "danger" : "neutral"}>
                    {ENTRY_STATUS_LABELS[entry.status] ?? ENTRY_STATUS_LABELS.REGISTERED}
                  </Chip>
                )}
                {rows.length ? (
                  <span className="type-meta">{rows.length} tuyển thủ</span>
                ) : (
                  ws.loaded && <Chip tone="warn">Chưa có đội hình</Chip>
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
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Đưa ${view.name} lên`}
                        disabled={ws.plan.entrants[0] === entry}
                        onClick={() => move(entry.teamId, -1)}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Đưa ${view.name} xuống`}
                        disabled={ws.plan.entrants.at(-1) === entry}
                        onClick={() => move(entry.teamId, 1)}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                    </>
                  )}
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
              {tournament && (
                <Staff
                  lines={staffOfTeam(tournament.content.staff, entry.teamId)}
                  people={ws.entry.content.people}
                  actorKey={ws.access.actorKey}
                />
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
      </Panel>
      {recordTeam && (
        <TeamRecordSheet
          teamId={recordTeam}
          playerIds={rosterOrder(rostersOf(recordTeam)).map((row) => row.playerId)}
          actorKey={ws.access.actorKey}
          canWrite={ws.access.canWrite}
          onClose={() => setRecordTeam(null)}
        />
      )}
      {rosterTeam && ws.loaded && (
        <RosterBoardSheet
          key={rosterTeam}
          teamId={rosterTeam}
          team={ws.teams[rosterTeam]}
          tournamentId={ws.entry.id}
          rows={ws.rosters.filter((row) => row.content.teamId === rosterTeam)}
          players={rosterPlayers.data}
          actorKey={ws.access.actorKey}
          canWrite={ws.access.canWrite}
          onClose={() => setRosterTeam(null)}
        />
      )}
      {adding === "paste" && (
        <PasteNamesDialog
          kind="teams"
          context={{ tournamentId: ws.entry.id }}
          exclude={ws.plan.entrants.map((row) => row.teamId)}
          onAdd={addTeams}
          onClose={() => setAdding(null)}
        />
      )}
      {adding === "create" && (
        <CreateProfileSheet
          kind="TEAM"
          submitLabel="Tạo và thêm vào giải"
          onClose={() => setAdding(null)}
          onCreated={(profile) => {
            setAdding(null)
            if (profile.entityId) addTeams([{ id: profile.entityId, name: profile.content?.name ?? profile.code }])
          }}
        />
      )}
    </div>
  )
}
