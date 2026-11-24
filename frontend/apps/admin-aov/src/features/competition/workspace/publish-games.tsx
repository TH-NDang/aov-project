import { useState } from "react"
import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { publishGames } from "@/features/esports/data/match-publishing"
import { publishRows, type PublishRow } from "@/features/esports/model/match-publishing"
import { seriesLabel } from "@/features/esports/model/series-label"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { missingFieldLabel } from "@/features/tournaments/model/tournament-model"
import { Panel, Progress, type Workspace } from "./parts"

type Failure = { game: DocumentView<GameContent>; reason: string }

/** What keeps most games back, counted by the recording step they still miss. */
function blockers(rows: PublishRow[]) {
  const counts = new Map<string, number>()
  for (const row of rows) for (const step of row.steps) counts.set(step.label, (counts.get(step.label) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

/** Every game of the tournament: how many are public, how many could be now, and one action that publishes those. */
export function PublishGames({ ws }: { ws: Workspace }) {
  const client = useQueryClient()
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<Failure[]>([])
  const games = ws.games
  const rows = games ? publishRows(games) : []
  const ready = rows.filter((row) => row.state === "ready")
  const blocked = rows.filter((row) => row.state === "blocked")
  const published = rows.length - ready.length - blocked.length
  const seriesOf = (game: DocumentView<GameContent>) => ws.series.find((row) => row.id === game.content.seriesId)
  const placeOf = (game: DocumentView<GameContent>) => {
    const series = seriesOf(game)
    return `${series ? seriesLabel(series.content) || `${ws.team(series.content.teamAId).name} gặp ${ws.team(series.content.teamBId).name}` : "Trận"} · Ván ${game.content.number}`
  }
  const publish = useMutation({
    mutationFn: async (batch: DocumentView<GameContent>[]) => {
      const refused: Failure[] = []
      setProgress({ done: 0, total: batch.length })
      for (const [at, game] of batch.entries()) {
        const [result] = await publishGames(tournamentApi, [game])
        if (result && !result.ok)
          refused.push({
            game,
            reason: result.fields.length ? result.fields.map(missingFieldLabel).join(", ") : result.message,
          })
        setProgress({ done: at + 1, total: batch.length })
      }
      return refused
    },
    meta: { silent: true },
    onSuccess: setFailures,
    onSettled: async () => {
      setProgress(null)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const start = async () => {
    const bySeries = new Map<string, number>()
    for (const row of ready)
      bySeries.set(row.entry.content.seriesId, (bySeries.get(row.entry.content.seriesId) ?? 0) + 1)
    const replaced = ready.filter((row) => row.progress.state === "changed").length
    const confirmed = await confirmAction({
      title: `Xuất bản ${ready.length} ván của ${bySeries.size} trận?`,
      description: `Mỗi ván được chốt và hiện ở trang công khai.${replaced ? ` ${replaced} ván thay bản đã xuất bản.` : ""}`,
      confirmLabel: `Xuất bản ${ready.length} ván`,
      tone: "publish",
    })
    if (!confirmed) return
    setFailures([])
    publish.mutate(ready.map((row) => row.entry))
  }

  return (
    <Panel title="Ván đấu" meta="Công bố riêng từng ván">
      <div className="space-y-4 p-4">
        {!games ? (
          <p className="type-meta">Đang đếm các ván đã ghi…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="type-body flex justify-between gap-3">
                <span>Ván đã công bố</span>
                <span className="font-semibold tabular-nums">
                  {published}/{rows.length}
                </span>
              </div>
              <Progress value={published} total={rows.length} tone={published === rows.length ? "ok" : "gold"} />
            </div>
            {ws.access.canPublish && ready.length > 0 && (
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={publish.isPending}
                onClick={() => void start()}
              >
                <ShieldCheck aria-hidden />
                {progress
                  ? `Đang xuất bản ${progress.done}/${progress.total}…`
                  : `Xuất bản ${ready.length} ván đủ dữ liệu`}
              </Button>
            )}
            {blocked.length > 0 && (
              <div className="space-y-1.5">
                <p className="type-label text-muted-foreground">{blocked.length} ván còn thiếu</p>
                <ul className="space-y-1">
                  {blockers(blocked)
                    .slice(0, 5)
                    .map(([label, count]) => (
                      <li key={label} className="type-body flex justify-between gap-3">
                        <span>{label}</span>
                        <span className="text-muted-foreground tabular-nums">{count} ván</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
        {publish.error && (
          <p className="type-body text-destructive" role="alert">
            {tournamentError(publish.error)}
          </p>
        )}
        {failures.length > 0 && (
          <div className="space-y-1.5" role="alert">
            <p className="type-label text-destructive">{failures.length} ván chưa xuất bản được</p>
            <ul className="max-h-64 overflow-y-auto">
              {failures.map(({ game, reason }) => (
                <li key={game.id} className="border-b last:border-b-0">
                  <Link
                    to={`${matchPath(ws.entry.id, game.content.seriesId)}?edit=1&game=${game.id}`}
                    className="flex items-center gap-2 py-2 hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="type-body block truncate">{placeOf(game)}</span>
                      <span className="type-meta block truncate" title={reason}>
                        {reason}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className="type-body underline" onClick={() => ws.go("schedule")}>
          Mở lịch để ghi ván
        </button>
      </div>
    </Panel>
  )
}
