import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
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
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { confirmAction } from "@/components/confirm-dialog"
import { useGamePatches } from "@/features/esports/data/use-esports-data"
import { STATUS_LABELS } from "@/features/esports/model/labels"
import { seriesLabel } from "@/features/esports/model/series-label"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { LANE_LABELS } from "@/lib/lanes"
import { dataIssues, staffMovedTo, type DataIssue } from "./data-checks"
import { plannedFromSeries } from "./outside-series"
import { Panel, type Workspace, type WorkspaceFocus } from "./parts"
import type { WorkspaceStep } from "./model"
import { useRosterPlayers } from "./use-roster-players"

type Fix = { label: string; run: () => void }
type Jump = { label: string; step: WorkspaceStep; focus?: WorkspaceFocus } | { label: string; to: string }
/** One issue in words: what is wrong, what Admin can fix on the spot, and where the rest is fixed. */
type IssueView = { title: string; detail: string; fixes?: Fix[]; jumps?: Jump[] }

const SHOWN = 6

/**
 * Data faults Admin can see in this tournament, each with its fix or a way straight to it (spec 04, the data check
 * panel). Fixes of records are written straight away after a confirmation; those of the plan go into the draft.
 */
export function DataChecksPanel({ ws, record }: { ws: Workspace; record?: DocumentView<TournamentContent> }) {
  const client = useQueryClient()
  const [all, setAll] = useState(false)
  const staff = record?.content.staff ?? []
  const players = useRosterPlayers(ws.entry.id, ws.access.actorKey, ws.rosters.length > 0)
  const patchScopes = useGamePatches(ws.entry.id)
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
  const nickname = (id: string) => players.data?.get(id)?.nickname ?? "Tuyển thủ chưa rõ tên"
  const playerName = (row: DocumentView<RosterMembershipContent>) => nickname(row.content.playerId)

  const found = dataIssues({
    plan: ws.plan,
    staff,
    rosters: ws.rosters,
    series: ws.series,
    games: ws.games,
    teams,
    players: players.data,
    patchScopes: patchScopes.data,
    resolved: ws.resolved,
    tournament: record?.content,
  })
  // An empty roster or schedule that is still on its way is no fault.
  const issues = ws.loaded ? found : []
  const checking = !ws.loaded || (players.isPending && ws.rosters.length > 0)
  const fix = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    meta: { silent: true, successMessage: "Đã sửa." },
    onSuccess: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  const ask = (
    question: { title: string; description: string; confirmLabel: string },
    action: () => Promise<unknown> | void,
    draft = false,
  ) =>
    void confirmAction({ ...question, tone: draft ? "publish" : undefined }).then((confirmed) => {
      if (!confirmed) return
      if (draft) void action()
      else fix.mutate(async () => action())
    })

  const removeRow = (row: DocumentView<RosterMembershipContent>, other: DocumentView<RosterMembershipContent>) =>
    ask(
      {
        title: `Bỏ dòng ${playerName(row)} khỏi đội hình?`,
        description: `${playerName(row)} và ${playerName(other)} có vẻ là cùng một người ở ${teamName(row.content.teamId)}. Dòng của ${playerName(row)} vào thùng rác và khôi phục được; hồ sơ tuyển thủ giữ nguyên.`,
        confirmLabel: "Bỏ dòng",
      },
      () => tournamentApi.remove("roster-memberships", row),
    )

  const view = (issue: DataIssue): IssueView => {
    switch (issue.kind) {
      case "STAFF_OFF_TEAMS": {
        const to = issue.suggestedTeamId
        return {
          title: "Ban huấn luyện gắn với đội không tham dự",
          detail: `${personName(issue.staff.pageId)} · ${personRoleLabels[issue.staff.role]} đang ở ${teamName(issue.staff.teamId)}, nên không hiện ở đội nào của giải.${
            to ? "" : " Không có đội cùng tên trong giải: sửa ở bảng ban huấn luyện của đội."
          }`,
          fixes:
            to && record
              ? [
                  {
                    label: `Chuyển sang ${teamName(to)}`,
                    run: () =>
                      ask(
                        {
                          title: "Chuyển ban huấn luyện sang đúng đội?",
                          description: `${personName(issue.staff.pageId)} · ${personRoleLabels[issue.staff.role]}: ${teamName(issue.staff.teamId)} → ${teamName(to)}.`,
                          confirmLabel: "Chuyển",
                        },
                        () =>
                          tournamentApi.save("tournaments", record, {
                            ...record.content,
                            staff: staffMovedTo(staff, issue.staff, to),
                          }),
                      ),
                  },
                ]
              : [],
        }
      }
      case "ROSTER_SAME_PERSON":
        return {
          title: "Có thể là một người hai dòng",
          detail: `${playerName(issue.rows[0])} và ${playerName(issue.rows[1])} ở ${teamName(issue.teamId)} có tên trùng nhau. Gộp hai hồ sơ ở bảng sửa tuyển thủ nếu đúng là một người.`,
          fixes: issue.rows.map((row, index) => ({
            label: `Bỏ dòng ${playerName(row)}`,
            run: () => removeRow(row, issue.rows[1 - index]!),
          })),
          jumps: [{ label: "Mở hồ sơ", step: "teams", focus: { team: issue.teamId, open: "record" } }],
        }
      case "PLAYS_WITHOUT_ROSTER": {
        const from = issue.rosterTeamId
        return {
          title: "Đội đá trận chưa có đội hình",
          detail: from
            ? `${teamName(issue.teamId)} đá trận, còn đội hình lại nằm ở ${teamName(from)} (cùng tên, không đá trận nào).`
            : `${teamName(issue.teamId)} có trận ở giải nhưng chưa có dòng đội hình nào.`,
          fixes: from
            ? [
                {
                  label: `Chuyển ${issue.rosterRows.length} dòng đội hình`,
                  run: () =>
                    ask(
                      {
                        title: "Chuyển đội hình sang đội đá trận?",
                        description: `${issue.rosterRows.length} dòng đội hình: ${teamName(from)} → ${teamName(issue.teamId)}.`,
                        confirmLabel: "Chuyển đội hình",
                      },
                      () =>
                        tournamentApi.rosterBatch({
                          update: issue.rosterRows.map((row) => ({
                            id: row.id,
                            version: row.version,
                            content: { ...row.content, teamId: issue.teamId },
                          })),
                        }),
                    ),
                },
              ]
            : [],
          jumps: from ? [] : [{ label: "Mở đội hình", step: "teams", focus: { team: issue.teamId, open: "roster" } }],
        }
      }
      case "GAMES_OUTSIDE_PATCH_RANGE":
        return {
          title: "Ván ngoài phạm vi patch",
          detail: `${issue.games} ván không thuộc dòng phiên bản nào${
            issue.firstLineOn ? ` (dòng đầu tiên từ ${formatCalendarDate(issue.firstLineOn)})` : ""
          }. Sửa các dòng phiên bản của giai đoạn, hoặc ghi patch riêng cho ván.`,
          jumps: [{ label: "Mở thể thức", step: "format" }],
        }
      case "UNLINKED_MVP":
        return {
          title: "MVP chưa liên kết tuyển thủ",
          detail: `${issue.games} ván ghi tên MVP nhưng chưa trỏ tới hồ sơ tuyển thủ.`,
          jumps: [{ label: "Mở Liên kết cần xem", to: "/link-review" }],
        }
      case "SCORE_DIFFERS":
        return {
          title: "Tỷ số lệch với ván đã ghi",
          detail: `${issue.matches} trận có tỷ số khác số ván thắng của các ván đã ghi.`,
          jumps: [{ label: "Xem các trận", step: "schedule", focus: { show: "SCORE_DIFFERS" } }],
        }
      case "SCORE_UNREAD":
        return {
          title: "Đã ghi đủ ván nhưng chưa có tỷ số",
          detail: `${issue.matches} trận có các ván đã phân thắng bại mà chưa nhập tỷ số.`,
          jumps: [{ label: "Nhập tỷ số", step: "schedule", focus: { show: "NO_SCORE", open: "results" } }],
        }
      case "ROSTER_LANES": {
        const lanes = (list: typeof issue.crowded) => list.map((lane) => LANE_LABELS[lane].short).join(", ")
        return {
          title: "Đội hình chính lệch vị trí",
          detail: `${teamName(issue.teamId)}: ${[
            ...(issue.crowded.length ? [`trùng ${lanes(issue.crowded)}`] : []),
            ...(issue.empty.length ? [`thiếu ${lanes(issue.empty)}`] : []),
          ].join(", ")}.`,
          jumps: [{ label: "Mở đội hình", step: "teams", focus: { team: issue.teamId, open: "roster" } }],
        }
      }
      case "PLAYER_TWO_TEAMS":
        return {
          title: "Một người thi đấu chính ở hai đội",
          detail: `${nickname(issue.playerId)}: ${issue.teamIds.map(teamName).join(" và ")}.`,
          jumps: issue.teamIds.map((team) => ({
            label: `Mở ${teamName(team)}`,
            step: "teams" as const,
            focus: { team, open: "roster" },
          })),
        }
      case "SERIES_OUTSIDE_PLAN": {
        const matches = plannedFromSeries(ws.plan, issue.series)
        return {
          title: "Trận chưa nằm trong lịch",
          detail: `${issue.series.length} trận của giải không có trong lịch: ${issue.series
            .slice(0, 2)
            .map(
              (row) =>
                seriesLabel(row.content) || `${teamName(row.content.teamAId)} gặp ${teamName(row.content.teamBId)}`,
            )
            .join(", ")}${issue.series.length > 2 ? "…" : ""}`,
          fixes: matches
            ? [
                {
                  label: `Đưa ${issue.series.length} trận vào lịch`,
                  run: () =>
                    ask(
                      {
                        title: `Đưa ${issue.series.length} trận vào lịch?`,
                        description:
                          "Trận được thêm vào giai đoạn cùng mã, giữ nguyên đội, giờ và tỷ số. Hoàn tác được trước khi lưu bản nháp.",
                        confirmLabel: "Đưa vào lịch",
                      },
                      () => ws.change("matches", [...ws.plan.matches, ...matches]),
                      true,
                    ),
                },
              ]
            : [],
        }
      }
      case "STAGE_ORDER":
        return {
          title: "Giai đoạn chưa theo thứ tự ngày đấu",
          detail: `${ws.plan.stages.map((stage) => stage.name).join(" → ")} nên là ${issue.stages.map((stage) => stage.name).join(" → ")}.`,
          fixes: [{ label: "Xếp theo ngày đấu", run: () => ws.change("stages", issue.stages) }],
        }
      case "BRACKET_LOOSE":
        return {
          title: "Nhánh đấu chưa nối",
          detail: `${issue.stageName}: ${issue.links} suất thắng thua đọc được từ kết quả.`,
          jumps: [{ label: "Nối nhánh", step: "schedule", focus: { stage: issue.stageCode } }],
        }
      case "OUTSIDE_DATES":
        return {
          title: "Trận ngoài thời gian của giải",
          detail: `${issue.matches} trận nằm ngoài ngày bắt đầu và kết thúc đã ghi.`,
          fixes: record
            ? [
                {
                  label: "Đặt ngày theo lịch đấu",
                  run: () =>
                    ask(
                      {
                        title: "Đổi thời gian của giải?",
                        description: `${formatCalendarDate(record.content.startsOn!)} – ${formatCalendarDate(record.content.endsOn!)} → ${formatCalendarDate(issue.from)} – ${formatCalendarDate(issue.to)}.`,
                        confirmLabel: "Đổi thời gian",
                      },
                      () =>
                        tournamentApi.save("tournaments", record, {
                          ...record.content,
                          startsOn: issue.from,
                          endsOn: issue.to,
                        }),
                    ),
                },
              ]
            : [],
        }
      case "TEAM_TWICE":
        return {
          title: "Một đội hai trận cùng giờ",
          detail: `${teamName(issue.teamId)} có hai trận cùng một giờ đấu.`,
          jumps: [{ label: "Mở lịch", step: "schedule", focus: { key: issue.matchKeys[1], open: "times" } }],
        }
      case "STATUS_STALE":
        return {
          title: "Trạng thái giải lệch ngày",
          detail: `${issue.reason} nhưng giải đang ghi "${STATUS_LABELS[record?.content.status ?? "UNKNOWN"]}".`,
          fixes: record
            ? [
                {
                  label: `Đặt "${STATUS_LABELS[issue.status]}"`,
                  run: () =>
                    ask(
                      {
                        title: "Đổi trạng thái của giải?",
                        description: `${STATUS_LABELS[record.content.status ?? "UNKNOWN"]} → ${STATUS_LABELS[issue.status]}.`,
                        confirmLabel: "Đổi trạng thái",
                      },
                      () => tournamentApi.save("tournaments", record, { ...record.content, status: issue.status }),
                    ),
                },
              ]
            : [],
        }
    }
  }
  const shown = all ? issues : issues.slice(0, SHOWN)

  return (
    <Panel title="Kiểm tra dữ liệu" icon={ShieldCheck} meta={issues.length ? `${issues.length} lỗi` : undefined}>
      {fix.error && (
        <p className="type-body border-b px-4 py-3 text-destructive" role="alert">
          {tournamentError(fix.error)}
        </p>
      )}
      {!issues.length ? (
        <p className="type-body px-4 py-3 text-muted-foreground">
          {checking ? "Đang kiểm tra…" : "Không thấy lỗi dữ liệu nào."}
        </p>
      ) : (
        <ul>
          {shown.map((issue) => {
            const { title, detail, fixes = [], jumps = [] } = view(issue)
            return (
              <li key={issue.key} className="space-y-2 border-b px-4 py-3 last:border-b-0">
                <span className="block min-w-0">
                  <strong className="type-body block">{title}</strong>
                  <span className="type-meta block">{detail}</span>
                </span>
                {((ws.canEdit && fixes.length > 0) || jumps.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {ws.canEdit &&
                      fixes.map((action) => (
                        <Button
                          key={action.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={fix.isPending}
                          onClick={action.run}
                        >
                          {action.label}
                        </Button>
                      ))}
                    {jumps.map((jump) =>
                      "to" in jump ? (
                        <Button key={jump.label} asChild variant="outline" size="sm">
                          <Link to={jump.to}>{jump.label}</Link>
                        </Button>
                      ) : (
                        <Button
                          key={jump.label}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => ws.go(jump.step, jump.focus)}
                        >
                          {jump.label}
                        </Button>
                      ),
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {issues.length > SHOWN && (
        <button
          type="button"
          className="type-body w-full border-t px-4 py-2.5 text-left hover:bg-muted/60"
          onClick={() => setAll(!all)}
        >
          {all ? "Thu gọn" : `Xem ${issues.length - SHOWN} lỗi khác`}
        </button>
      )}
    </Panel>
  )
}
