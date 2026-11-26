import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { Check, Loader2, Save, TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { formatClock, parseClock } from "@/lib/clock"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { QuickGamesError, writeQuickGames } from "../data/quick-games"
import type { TeamView } from "../model/game-view"
import {
  openQuickNumbers,
  presetWinners,
  quickRows,
  quickTally,
  type MatchTeam,
  type QuickRow,
  type QuickWinners,
} from "../model/series-score"
import { TeamLogo } from "../components/primitives"

/**
 * The games of a match whose score is known, recorded by their winner alone: one click on a team per game, the length
 * when the source says it, and every missing game is made at once. Games that already name a winner are only shown.
 */
export function QuickGamesPanel({
  series,
  games,
  team,
  region,
  onDone,
}: {
  series: DocumentView<SeriesContent>
  games: DocumentView<GameContent>[]
  team: (id: string) => TeamView
  region?: string
  onDone: () => void
}) {
  const client = useQueryClient()
  const rows = quickRows(series.content, games)
  const open = openQuickNumbers(rows)
  const [picked, setPicked] = useState<QuickWinners>(() => presetWinners(series.content, games, open))
  const [lengths, setLengths] = useState<Record<number, string>>({})
  const length = (number: number) => (lengths[number]?.trim() ? parseClock(lengths[number]!) : null)
  const badLength = open.some((number) => lengths[number]?.trim() && !length(number))
  const missing = rows.filter((row) => !row.entry)
  const closing = rows.filter((row) => row.entry && !row.winner && picked[row.number])
  const tally = quickTally(rows, picked)
  const result = series.content.result
  const differs = !!result && tally.open === 0 && (tally.scoreA !== result.scoreA || tally.scoreB !== result.scoreB)
  const save = useMutation({
    mutationFn: () =>
      writeQuickGames(
        tournamentApi,
        series,
        [...missing, ...closing].map((row) => ({
          row,
          winner: picked[row.number] ?? null,
          durationSeconds: length(row.number),
        })),
        region,
      ),
    meta: { silent: true, successMessage: "Đã ghi các ván theo tỷ số." },
    onSuccess: onDone,
    onSettled: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  const pick = (number: number, winner: MatchTeam) =>
    setPicked((current) => ({ ...current, [number]: current[number] === winner ? null : winner }))

  const teamButton = (row: QuickRow, which: MatchTeam) => {
    const view = team(which === "A" ? series.content.teamAId : series.content.teamBId)
    const won = (row.winner ?? picked[row.number]) === which
    return (
      <button
        type="button"
        aria-pressed={won}
        aria-label={`Ván ${row.number}: ${view.name} thắng`}
        disabled={!!row.winner || save.isPending}
        onClick={() => pick(row.number, which)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-left disabled:opacity-60",
          won ? "border-foreground bg-foreground/10 font-semibold" : "hover:bg-muted",
        )}
      >
        <TeamLogo team={view} size={24} />
        <span className="type-body min-w-0 flex-1 truncate">{view.shortName}</span>
        {won && <Check size={14} className="shrink-0" aria-hidden />}
      </button>
    )
  }

  return (
    <div className="space-y-3 p-4">
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.number} className="flex items-center gap-2">
            <span className="type-label w-12 shrink-0">Ván {row.number}</span>
            {teamButton(row, "A")}
            {teamButton(row, "B")}
            <Input
              aria-label={`Thời lượng ván ${row.number}`}
              placeholder="phút:giây"
              inputMode="numeric"
              className="esp-num h-9 w-20 shrink-0 px-1 text-center placeholder:text-sm"
              disabled={!!row.winner || save.isPending}
              aria-invalid={!!lengths[row.number]?.trim() && !length(row.number)}
              value={
                lengths[row.number] ??
                (row.entry?.content.durationSeconds != null ? formatClock(row.entry.content.durationSeconds) : "")
              }
              onChange={(event) => setLengths((current) => ({ ...current, [row.number]: event.target.value }))}
            />
          </li>
        ))}
      </ul>
      {differs && (
        <p className="type-body flex items-start gap-2 rounded-lg bg-(--aov-warning-soft) px-3 py-2">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-(--aov-warning)" aria-hidden />
          Các ván cho tỷ số {tally.scoreA} – {tally.scoreB}, trận đang ghi {result.scoreA} – {result.scoreB}. Trang trận
          sẽ đề nghị đặt lại tỷ số sau khi lưu.
        </p>
      )}
      {save.isError && (
        <p className="type-body text-destructive" role="alert">
          {save.error instanceof QuickGamesError ? save.error.message : String(save.error)}
        </p>
      )}
      <div className="flex items-center gap-2 border-t pt-3">
        <span className="type-meta esp-num flex-1">
          Đã chọn {tally.scoreA} – {tally.scoreB}
          {result && `, tỷ số ${result.scoreA} – ${result.scoreB}`}
        </span>
        <Button
          type="button"
          disabled={save.isPending || badLength || (!missing.length && !closing.length)}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {missing.length ? `Tạo ${missing.length} ván` : "Lưu đội thắng"}
        </Button>
      </div>
    </div>
  )
}
