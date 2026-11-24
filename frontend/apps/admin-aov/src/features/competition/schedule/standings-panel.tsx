import type { CompetitionStage } from "@aov/community-contracts"
import { ListOrdered } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { TeamLogo } from "@/features/esports/components/primitives"
import { stageProgress } from "../workspace/model"
import { Chip, Panel, type Workspace } from "../workspace/parts"

export function StandingsPanel({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const table = ws.entry.content.standings.find((entry) => entry.stageCode === stage.code)
  const progress = stageProgress(stage.code, ws.plan, ws.resolved)
  if (!table) return null
  const tiedAtCut = stage.advance > 0 && table.rows[stage.advance - 1]?.tied && table.rows[stage.advance]?.tied
  return (
    <Panel
      title="Bảng xếp hạng"
      icon={ListOrdered}
      className="xl:sticky xl:top-24"
      action={
        <Chip tone={table.complete ? "ok" : "warn"}>
          {table.complete ? `Đủ ${progress.total} trận` : `Tạm tính · ${progress.scored}/${progress.total}`}
        </Chip>
      }
    >
      <table className="w-full">
        <thead>
          <tr className="type-label border-b text-muted-foreground">
            <th className="w-12 py-2 pl-4 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Đội</th>
            <th className="px-2 py-2 text-right font-semibold" title="Thắng – thua (trận)">
              T–B
            </th>
            <th className="px-2 py-2 text-right font-semibold" title="Thắng – thua (ván)">
              Ván
            </th>
            <th className="py-2 pr-4 text-right font-semibold" title="Hiệu số ván">
              HS
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => {
            const cut = stage.advance > 0 && index === stage.advance - 1
            const out = stage.advance > 0 && index >= stage.advance
            const diff = row.gameWins - row.gameLosses
            return (
              <tr
                key={row.teamId}
                className={cn(
                  "type-body border-b last:border-b-0",
                  cut && "border-b-2 border-b-primary",
                  out && "text-muted-foreground",
                )}
              >
                <td className="py-1.5 pr-2 pl-4 whitespace-nowrap tabular-nums">
                  {row.rank}
                  {row.tied ? "=" : ""}
                </td>
                <td className="w-full max-w-0 py-1.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TeamLogo team={ws.team(row.teamId)} size={24} />
                    <span className={cn("truncate", !out && "font-semibold")}>{ws.team(row.teamId).name}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {row.won}–{row.lost}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {row.gameWins}–{row.gameLosses}
                </td>
                <td className="py-1.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {diff > 0 ? `+${diff}` : diff}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {stage.advance > 0 && (
        <p className="type-meta border-t px-4 py-2.5">
          {stage.advance} đội trên vạch đi tiếp{table.complete ? "" : " (tạm tính, chưa xác nhận suất)"}.
          {tiedAtCut && " Có đội bằng hạng ngay tại vạch: kiểm tra tiêu chí phụ ở bước Thể thức."}
        </p>
      )}
    </Panel>
  )
}
