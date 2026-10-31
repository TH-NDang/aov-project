import { cn } from "@aov/ui/lib/utils"
import type { StandingRow } from "../model/competition"
import type { TeamView } from "../model/game-view"
import { TeamLogo } from "./primitives"

export function StandingsTable({
  rows,
  team,
  compact = false,
  onTeam,
}: {
  rows: StandingRow[]
  team: (id: string) => TeamView
  compact?: boolean
  onTeam?: (teamId: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="esp-num w-full min-w-[420px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Đội</th>
            <th className="px-2 py-2 text-center font-medium" title="Thắng – thua (trận)">
              Trận
            </th>
            {!compact && (
              <th className="px-2 py-2 text-center font-medium" title="Thắng – thua (ván)">
                Ván
              </th>
            )}
            <th className="px-2 py-2 text-center font-medium" title="Hiệu số ván">
              +/-
            </th>
            {!compact && <th className="hidden px-3 py-2 text-left font-medium @2xl:table-cell">Phong độ</th>}
            <th className="px-3 py-2 text-right font-medium">Điểm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const view = team(row.teamId)
            return (
              <tr
                key={row.teamId}
                className={cn(
                  "border-t",
                  row.advanced && "bg-[color-mix(in_oklch,var(--esp-win)_7%,transparent)]",
                  onTeam && "cursor-pointer hover:bg-muted/50",
                )}
                onClick={onTeam ? () => onTeam(row.teamId) : undefined}
              >
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-grid size-6 place-items-center rounded-md text-xs font-bold",
                      row.rank === 1
                        ? "esp-win-score shadow-[0_0_10px_-2px_var(--esp-gold)]"
                        : row.advanced
                          ? "bg-[var(--esp-gold-soft)] text-[var(--esp-gold-text)]"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamLogo team={view} size={24} />
                    <span className="truncate font-medium">{compact ? view.shortName : view.name}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  {row.wins}–{row.losses}
                </td>
                {!compact && (
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {row.gameWins}–{row.gameLosses}
                  </td>
                )}
                <td
                  className={cn(
                    "px-2 py-2 text-center font-medium",
                    row.gameDiff > 0 ? "text-[var(--esp-gold-text)]" : row.gameDiff < 0 ? "text-muted-foreground" : "",
                  )}
                >
                  {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                </td>
                {!compact && (
                  <td className="hidden px-3 py-2 @2xl:table-cell">
                    <span className="flex gap-1">
                      {row.form.map((result, index) => (
                        <span
                          key={index}
                          className={cn(
                            "grid size-5 place-items-center rounded text-xs font-bold",
                            result === "W" ? "esp-win-score" : "bg-muted text-muted-foreground",
                          )}
                          title={result === "W" ? "Victory" : "Defeat"}
                        >
                          {result}
                        </span>
                      ))}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 text-right font-bold">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
