import { Link } from "react-router"
import { Building2, CalendarDays, Layers, ListChecks, Pencil, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { Section } from "@/features/community/profile-fields"
import { youtubeVideoId } from "@/features/esports/model/vod"
import { tournamentPath } from "@/features/esports/pages/esports-shell"
import { TeamRegionBadge } from "@/features/tournaments/team-region"
import { tournamentDates } from "@/features/tournaments/tournament-metadata"
import type { EventFamily } from "@/features/tournaments/tournament-parts"
import { CompetitionInformationFields } from "../competition-information-fields"
import { OrganizationPicker } from "../organization-picker"
import { EventPartsPanel } from "./event-parts"
import { hasScore, type RecordingTotals, type WorkspaceCheck } from "./model"
import { Panel, Progress, type Workspace } from "./parts"

/** The tournament's facts on the left; on the right what to do next and how much of the season is recorded. */
export function OverviewStep({
  ws,
  checks,
  totals,
  family,
  onEditTournament,
  onAddPart,
}: {
  ws: Workspace
  checks: WorkspaceCheck[]
  totals?: RecordingTotals
  family: EventFamily
  onEditTournament: () => void
  onAddPart: () => void
}) {
  const { entry, plan } = ws
  const tournament = entry.content.tournament
  const scored = plan.matches.filter((match) => hasScore(ws.resolved.get(match.key))).length
  const withRoster = plan.entrants.filter((team) => ws.rosters.some((row) => row.content.teamId === team.teamId)).length
  const withVideo = ws.series.filter((row) => youtubeVideoId(row.content.sourceUrl)).length
  const next = checks.filter((check) => check.state === "todo").slice(0, 3)
  const detailLeft = totals ? totals.games - totals.withPlayers : 0
  const rows: { label: string; value: number; total: number; note?: string }[] = [
    { label: "Đội có đội hình", value: withRoster, total: plan.entrants.length },
    { label: "Trận có tỷ số", value: scored, total: plan.matches.length },
    { label: "Trận có video", value: withVideo, total: ws.series.length },
  ]
  if (totals)
    rows.push(
      { label: "Ván có đội thắng", value: totals.withWinner, total: totals.games },
      { label: "Ván có đủ tuyển thủ", value: totals.withPlayers, total: totals.games },
      { label: "Ván có thứ tự cấm chọn", value: totals.withDraftOrder, total: totals.games },
      { label: "Ván đã công bố", value: totals.published, total: totals.games },
    )

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            title="Thông tin giải"
            icon={Trophy}
            action={
              ws.canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Chỉnh sửa thông tin cơ bản"
                  title="Chỉnh sửa thông tin cơ bản"
                  onClick={onEditTournament}
                >
                  <Pencil size={16} />
                </Button>
              )
            }
          >
            <div className="flex items-start gap-3">
              <Avatar className="size-12 rounded-lg border bg-background">
                <AvatarImage src={tournament.logoUrl || undefined} alt="" className="object-contain" />
                <AvatarFallback className="rounded-lg">
                  <Trophy className="size-6" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="type-section-title">{tournament.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <TeamRegionBadge code={tournament.region} />
                  {tournament.tier && tournament.tier !== "UNKNOWN" && (
                    <span className="type-label rounded-md bg-muted px-2 py-1">{tournament.tier}-Tier</span>
                  )}
                </div>
              </div>
            </div>
            <p className="type-body flex items-center gap-2 border-t pt-3 text-muted-foreground">
              <CalendarDays aria-hidden size={16} />
              {tournamentDates(tournament) || "Chưa có thời gian thi đấu"}
            </p>
            {family.isPart && (
              <p className="type-body flex items-center gap-2 border-t pt-3 text-muted-foreground">
                <Layers aria-hidden size={16} />
                <span>
                  Là một phần của{" "}
                  <Link
                    to={tournamentPath(family.mainEventId)}
                    className="text-foreground underline underline-offset-2"
                  >
                    {family.mainName ?? "giải chính"}
                  </Link>
                </span>
              </p>
            )}
          </Section>
          <Section title="Đơn vị tổ chức" icon={Building2}>
            <OrganizationPicker
              value={plan.organizerPageId}
              actorKey={ws.access.actorKey}
              canWrite={ws.canEdit}
              onSelect={(profile) => {
                ws.change("organizerPageId", profile?.id || null)
                ws.change("organizer", profile?.content?.name || "")
              }}
            />
          </Section>
        </div>
        {!family.isPart && <EventPartsPanel family={family} canEdit={ws.canEdit} onAdd={onAddPart} />}
        <CompetitionInformationFields
          actorKey={ws.access.actorKey}
          plan={plan}
          savedPlan={ws.baseline}
          sourceUrl={tournament.sourceUrl}
          prizeDay={tournament.endsOn ?? tournament.startsOn}
          disabled={!ws.canEdit}
          onChange={ws.change}
        />
      </div>

      <aside className="space-y-5">
        <Panel title="Việc nên làm tiếp" icon={ListChecks}>
          <ul>
            {next.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="type-body block font-semibold">{check.label}</span>
                  <span className="type-meta">{check.detail}</span>
                </span>
                <Button type="button" variant="outline" onClick={() => ws.go(check.step)}>
                  Mở
                </Button>
              </li>
            ))}
            {detailLeft > 0 && (
              <li className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="type-body block font-semibold">Ghi chi tiết {detailLeft} ván</span>
                  <span className="type-meta">Tuyển thủ, phụ trợ và thứ tự cấm chọn theo video</span>
                </span>
                <Button type="button" variant="outline" onClick={() => ws.go("schedule")}>
                  Mở
                </Button>
              </li>
            )}
            {!next.length && detailLeft <= 0 && (
              <li className="type-body px-4 py-3 text-muted-foreground">Không còn việc nào đang chờ.</li>
            )}
          </ul>
        </Panel>
        <Panel title="Tiến độ ghi nhận">
          <div className="space-y-3.5 p-4">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="type-body mb-1.5 flex justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums">
                    {row.value}/{row.total}
                  </span>
                </div>
                <Progress
                  value={row.value}
                  total={row.total}
                  tone={row.total > 0 && row.value === row.total ? "ok" : "gold"}
                />
              </div>
            ))}
            {!totals && <p className="type-meta">Đang đếm các ván đã ghi…</p>}
          </div>
        </Panel>
      </aside>
    </div>
  )
}
