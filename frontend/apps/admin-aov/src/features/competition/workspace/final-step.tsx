import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { ListOrdered, Wand2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { TeamLogo } from "@/features/esports/components/primitives"
import { TournamentFinalTable } from "@/features/esports/components/tournament-final-table"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/tournament-api"
import { FinalTableEditButton } from "@/features/tournaments/tournament-final-table-editor"
import { CompetitionStatistics } from "../competition-statistics"
import { suggestedPlacements } from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"

/** Final places, prizes and awards of the tournament, with a ranking read from the bracket to check them against. */
export function FinalStep({ ws, tournament }: { ws: Workspace; tournament?: DocumentView<TournamentContent> }) {
  const client = useQueryClient()
  const { entry, plan } = ws
  const suggested = suggestedPlacements(plan, entry.content.resolved, entry.content.standings, ws.teams)
  const known = suggested.filter((line) => line.teamId)
  const current = tournament?.content.placements ?? []
  const apply = useMutation({
    mutationFn: () =>
      tournamentApi.save("tournaments", tournament!, {
        ...tournament!.content,
        placements: known.map((line) => {
          const kept = current.find((row) => row.teamId === line.teamId)
          return {
            place: line.place,
            teamId: line.teamId,
            teamName: line.teamName,
            prizeUsd: kept?.prizeUsd ?? null,
            prizeLocal: kept?.prizeLocal ?? null,
            // The bracket knows the last match of each team; a line it cannot read keeps what was typed.
            lastOpponent: line.lastOpponent ?? kept?.lastOpponent ?? null,
            lastScore: line.lastScore ?? kept?.lastScore ?? null,
          }
        }),
      }),
    meta: { silent: true, successMessage: "Đã điền thứ hạng theo nhánh đấu." },
    onSuccess: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  const fill = async () => {
    if (current.length) {
      const confirmed = await confirmAction({
        title: "Thay thứ hạng đã nhập?",
        description: `${current.length} dòng hiện có → ${known.length} dòng theo nhánh đấu. Tiền thưởng của đội vẫn có mặt được giữ lại.`,
        confirmLabel: "Thay thứ hạng",
      })
      if (!confirmed) return
    }
    apply.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          {tournament ? (
            <TournamentFinalTable
              content={tournament.content}
              team={(id) => ws.team(id)}
              action={
                ws.canEdit && (
                  <FinalTableEditButton
                    tournament={tournament}
                    teamNames={plan.entrants.map((row) => ({ id: row.teamId, name: ws.team(row.teamId).name }))}
                  />
                )
              }
            />
          ) : (
            <p className="type-meta">Đang tải kết quả chung cuộc…</p>
          )}
        </div>
        <Panel
          title="Gợi ý từ nhánh đấu"
          icon={ListOrdered}
          action={
            ws.canEdit &&
            tournament &&
            known.length > 0 && (
              <Button type="button" variant="outline" disabled={apply.isPending} onClick={() => void fill()}>
                <Wand2 aria-hidden /> Điền thứ hạng
              </Button>
            )
          }
        >
          {suggested.length ? (
            <ul>
              {suggested.map((line, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 border-b px-4 py-2 last:border-b-0"
                >
                  <span className="type-body font-bold tabular-nums">{line.place}</span>
                  <span className="min-w-0">
                    {line.teamId ? (
                      <span className="flex items-center gap-2.5">
                        <TeamLogo team={ws.team(line.teamId)} size={24} />
                        <span className="type-body truncate font-semibold">{line.teamName}</span>
                      </span>
                    ) : (
                      <Chip tone="warn">Chưa xác định</Chip>
                    )}
                    <span className="type-meta mt-0.5 block">{line.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-meta p-4">
              Chưa có gợi ý: cần một giai đoạn loại trực tiếp có các trận nối suất thắng/thua với nhau.
            </p>
          )}
          {apply.error && (
            <p className="type-body border-t px-4 py-3 text-destructive" role="alert">
              {tournamentError(apply.error)}
            </p>
          )}
        </Panel>
      </div>
      <Notice>
        Gợi ý chỉ đọc từ nhánh đấu và bảng xếp hạng. Tiền thưởng và giải thưởng cá nhân nhập theo nguồn chính thức.
      </Notice>
      <CompetitionStatistics
        tournamentId={entry.id}
        seriesIds={plan.matches.flatMap((match) => (match.seriesId ? [match.seriesId] : []))}
      />
    </div>
  )
}
