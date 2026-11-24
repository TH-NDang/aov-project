import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router"
import {
  personRoleLabels,
  type DocumentView,
  type RosterMembershipContent,
  type TeamContent,
  type TournamentContent,
} from "@aov/community-contracts"
import { ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { dataIssues, staffMovedTo, type DataIssue } from "./data-checks"
import { Panel, type Workspace } from "./parts"
import { useRosterPlayers } from "./use-roster-players"

/**
 * Data faults Admin can see in this tournament, each with its fix (spec 04, the data check panel). Fixes write the
 * records straight away after a confirmation; they are not part of the plan draft.
 */
export function DataChecksPanel({ ws, record }: { ws: Workspace; record?: DocumentView<TournamentContent> }) {
  const client = useQueryClient()
  const staff = record?.content.staff ?? []
  const players = useRosterPlayers(ws.entry.id, ws.access.actorKey, ws.rosters.length > 0)
  const unknownTeams = [...new Set(staff.map((line) => line.teamId))].filter((id) => !ws.teams[id])
  const extraTeams = useQueries({
    queries: unknownTeams.map((id) => ({
      queryKey: tournamentKeys.one("teams", ws.access.actorKey, id),
      queryFn: ({ signal }: { signal: AbortSignal }) => tournamentApi.read("teams", id, signal),
      staleTime: 60_000,
    })),
  })
  const teams: Record<string, TeamContent | undefined> = { ...ws.teams }
  extraTeams.forEach((query, index) => (teams[unknownTeams[index]!] = query.data?.content))
  const teamName = (id: string) => teams[id]?.name ?? "đội không rõ"
  const personName = (id: string) => ws.entry.content.people?.[id]?.name ?? "Người chưa rõ tên"
  const playerName = (row: DocumentView<RosterMembershipContent>) =>
    players.data?.get(row.content.playerId)?.nickname ?? "Tuyển thủ chưa rõ tên"

  const issues = dataIssues({
    plan: ws.plan,
    staff,
    rosters: ws.rosters,
    series: ws.series,
    games: ws.games,
    teams,
    players: players.data,
  })
  const refresh = () => client.invalidateQueries({ queryKey: tournamentKeys.all })
  const fix = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    meta: { successMessage: "Đã sửa." },
    onSuccess: refresh,
  })

  const moveStaff = async (issue: Extract<DataIssue, { kind: "STAFF_OFF_TEAMS" }>) => {
    if (!record || !issue.suggestedTeamId) return
    const confirmed = await confirmAction({
      title: "Chuyển ban huấn luyện sang đúng đội?",
      description: `${personName(issue.staff.pageId)} · ${personRoleLabels[issue.staff.role]}: ${teamName(issue.staff.teamId)} → ${teamName(issue.suggestedTeamId)}.`,
      confirmLabel: "Chuyển",
    })
    if (!confirmed) return
    const lines = staffMovedTo(staff, issue.staff, issue.suggestedTeamId)
    fix.mutate(() => tournamentApi.save("tournaments", record, { ...record.content, staff: lines }))
  }
  const removeRow = async (
    row: DocumentView<RosterMembershipContent>,
    other: DocumentView<RosterMembershipContent>,
  ) => {
    const confirmed = await confirmAction({
      title: `Bỏ dòng ${playerName(row)} khỏi đội hình?`,
      description: `${playerName(row)} và ${playerName(other)} có vẻ là cùng một người ở ${teamName(row.content.teamId)}. Dòng của ${playerName(row)} vào thùng rác và khôi phục được; hồ sơ tuyển thủ giữ nguyên.`,
      confirmLabel: "Bỏ dòng",
    })
    if (confirmed) fix.mutate(() => tournamentApi.remove("roster-memberships", row))
  }
  const moveRoster = async (issue: Extract<DataIssue, { kind: "PLAYS_WITHOUT_ROSTER" }>) => {
    if (!issue.rosterTeamId) return
    const confirmed = await confirmAction({
      title: "Chuyển đội hình sang đội đá trận?",
      description: `${issue.rosterRows.length} dòng đội hình: ${teamName(issue.rosterTeamId)} → ${teamName(issue.teamId)}.`,
      confirmLabel: "Chuyển đội hình",
    })
    if (!confirmed) return
    fix.mutate(async () => {
      for (const row of issue.rosterRows)
        await tournamentApi.save("roster-memberships", row, { ...row.content, teamId: issue.teamId })
    })
  }

  return (
    <Panel title="Kiểm tra dữ liệu" icon={ShieldCheck} meta={issues.length ? `${issues.length} lỗi` : undefined}>
      {!issues.length ? (
        <p className="type-body px-4 py-3 text-muted-foreground">
          {players.isPending && ws.rosters.length ? "Đang kiểm tra…" : "Không thấy lỗi dữ liệu nào."}
        </p>
      ) : (
        <ul>
          {issues.map((issue) => (
            <li key={issue.key} className="space-y-2 border-b px-4 py-3 last:border-b-0">
              {issue.kind === "STAFF_OFF_TEAMS" && (
                <>
                  <IssueText
                    title="Ban huấn luyện gắn với đội không tham dự"
                    detail={`${personName(issue.staff.pageId)} · ${personRoleLabels[issue.staff.role]} đang ở ${teamName(issue.staff.teamId)}, nên không hiện ở đội nào của giải.`}
                  />
                  {ws.canEdit && issue.suggestedTeamId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fix.isPending}
                      onClick={() => void moveStaff(issue)}
                    >
                      Chuyển sang {teamName(issue.suggestedTeamId)}
                    </Button>
                  )}
                  {!issue.suggestedTeamId && (
                    <p className="type-meta">Không có đội cùng tên trong giải. Sửa ở bảng ban huấn luyện của đội.</p>
                  )}
                </>
              )}
              {issue.kind === "ROSTER_SAME_PERSON" && (
                <>
                  <IssueText
                    title="Có thể là một người hai dòng"
                    detail={`${playerName(issue.rows[0])} và ${playerName(issue.rows[1])} ở ${teamName(issue.teamId)} có tên trùng nhau. Gộp hai hồ sơ ở bảng sửa tuyển thủ nếu đúng là một người.`}
                  />
                  {ws.canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {issue.rows.map((row, index) => (
                        <Button
                          key={row.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={fix.isPending}
                          onClick={() => void removeRow(row, issue.rows[1 - index]!)}
                        >
                          Bỏ dòng {playerName(row)}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {issue.kind === "PLAYS_WITHOUT_ROSTER" && (
                <>
                  <IssueText
                    title="Đội đá trận chưa có đội hình"
                    detail={
                      issue.rosterTeamId
                        ? `${teamName(issue.teamId)} đá trận, còn đội hình lại nằm ở ${teamName(issue.rosterTeamId)} (cùng tên, không đá trận nào).`
                        : `${teamName(issue.teamId)} có trận ở giải nhưng chưa có dòng đội hình nào.`
                    }
                  />
                  {ws.canEdit && issue.rosterTeamId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={fix.isPending}
                      onClick={() => void moveRoster(issue)}
                    >
                      Chuyển {issue.rosterRows.length} dòng đội hình
                    </Button>
                  )}
                  {!issue.rosterTeamId && (
                    <Button type="button" variant="outline" size="sm" onClick={() => ws.go("teams")}>
                      Mở đội hình
                    </Button>
                  )}
                </>
              )}
              {issue.kind === "UNLINKED_MVP" && (
                <>
                  <IssueText
                    title="MVP chưa liên kết tuyển thủ"
                    detail={`${issue.games} ván ghi tên MVP nhưng chưa trỏ tới hồ sơ tuyển thủ.`}
                  />
                  <Button asChild variant="outline" size="sm">
                    <Link to="/link-review">Mở Liên kết cần xem</Link>
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function IssueText({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="block min-w-0">
      <strong className="type-body block">{title}</strong>
      <span className="type-meta block">{detail}</span>
    </span>
  )
}
