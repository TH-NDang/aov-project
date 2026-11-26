import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { ChevronRight, ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { publishGames } from "@/features/esports/data/match-publishing"
import { commonBlocks, commonGaps, publishRows, type PublishRow } from "@/features/esports/model/match-publishing"
import { seriesLabel } from "@/features/esports/model/series-label"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { gameFieldWords } from "@/features/tournaments/model/game-field-words"
import { Panel, Progress, type Workspace } from "./parts"
import { publishRunOf, updatePublishRun, usePublishRun, type PublishBatch, type PublishFailure } from "./publish-run"

/** How many gaps of a list of games are named. */
const SHOWN_GAPS = 5

/** A bulk publication: the tournament it belongs to, its group and its games in the order they go out. */
type PublishOrder = { owner: string; batch: PublishBatch; entries: DocumentView<GameContent>[] }

/** What a list of games misses, the gap of most games first. */
function Gaps({ gaps, title }: { gaps: ReturnType<typeof commonGaps>; title: string }) {
  return (
    <div className="space-y-1.5">
      <p className="type-label text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {gaps.slice(0, SHOWN_GAPS).map(({ label, games }) => (
          <li key={label} className="type-body flex justify-between gap-3">
            <span>{label}</span>
            <span className="text-muted-foreground tabular-nums">{games} ván</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Every game of the tournament: how many are public, how many could be now, and the actions that publish those. A game
 * that lacks what nobody saw is published by its own action, which says what readers will find unknown. A run goes on
 * while another step is open; its progress stands on the action that started it.
 */
export function PublishGames({ ws }: { ws: Workspace }) {
  const client = useQueryClient()
  const tournamentId = ws.entry.id
  const run = usePublishRun(tournamentId)
  const games = ws.games
  const rows = games ? publishRows(games) : []
  const ready = rows.filter((row) => row.state === "ready")
  const partial = rows.filter((row) => row.state === "partial")
  const blocked = rows.filter((row) => row.state === "blocked")
  const published = rows.length - ready.length - partial.length - blocked.length
  // A game published since it was refused, here or on its match, is no failure any more.
  const failures = run.failures.filter(
    ({ game }) => rows.find((row) => row.entry.id === game.id)?.state !== "published",
  )
  const seriesOf = (game: DocumentView<GameContent>) => ws.series.find((row) => row.id === game.content.seriesId)
  const placeOf = (game: DocumentView<GameContent>) => {
    const series = seriesOf(game)
    return `${series ? seriesLabel(series.content) || `${ws.team(series.content.teamAId).name} gặp ${ws.team(series.content.teamBId).name}` : "Trận"} · Ván ${game.content.number}`
  }
  const publish = useMutation({
    mutationFn: async ({ owner, batch, entries }: PublishOrder) => {
      const refused: PublishFailure[] = []
      for (const [at, game] of entries.entries()) {
        const [result] = await publishGames(tournamentApi, [game])
        if (result && !result.ok)
          refused.push({
            game,
            reason: result.fields.length
              ? result.fields.map((field) => gameFieldWords(field, game.content)).join("; ")
              : result.message,
          })
        updatePublishRun(owner, () => ({
          running: { batch, done: at + 1, total: entries.length },
          failures: [...refused],
        }))
      }
      return refused
    },
    meta: { silent: true },
    // A pending run takes the callbacks of the latest render, which may show another tournament by then: the run ends
    // for the tournament it was started for.
    onSettled: async (_refused, _error, { owner }) => {
      updatePublishRun(owner, ({ failures: refused }) => ({ failures: refused }))
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const busy = !!run.running || publish.isPending
  const start = async (batch: PublishBatch, chosen: PublishRow[]) => {
    const matches = new Set(chosen.map((row) => row.entry.content.seriesId)).size
    const replaced = chosen.filter((row) => row.progress.state === "changed").length
    const gaps = commonGaps(chosen)
    const confirmed = await confirmAction({
      title: `Xuất bản ${chosen.length} ván của ${matches} trận?`,
      description: `Mỗi ván được chốt và hiện ở trang công khai.${replaced ? ` ${replaced} ván thay bản đã xuất bản.` : ""}${
        gaps.length
          ? ` Phần còn thiếu hiện là chưa rõ: ${gaps.map(({ label, games: count }) => `${label.toLocaleLowerCase("vi")} (${count} ván)`).join(", ")}. Bổ sung sau thì xuất bản lại.`
          : ""
      }`,
      confirmLabel: `Xuất bản ${chosen.length} ván`,
      tone: "publish",
    })
    // Another run may have started while the question was open.
    if (!confirmed || publishRunOf(tournamentId).running) return
    updatePublishRun(tournamentId, () => ({ running: { batch, done: 0, total: chosen.length }, failures: [] }))
    publish.mutate({ owner: tournamentId, batch, entries: chosen.map((row) => row.entry) })
  }
  /** The words of the action of a group: its progress while it runs. */
  const label = (batch: PublishBatch, idle: string) =>
    run.running?.batch === batch ? `Đang xuất bản ${run.running.done}/${run.running.total}…` : idle

  return (
    <Panel title="Ván đấu" meta="Xuất bản riêng từng ván">
      <div className="space-y-4 p-4">
        {!games ? (
          <p className="type-meta">Đang đếm các ván đã ghi…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="type-body flex justify-between gap-3">
                <span>Ván đã xuất bản</span>
                <span className="font-semibold tabular-nums">
                  {published}/{rows.length}
                </span>
              </div>
              <Progress value={published} total={rows.length} tone={published === rows.length ? "ok" : "gold"} />
            </div>
            {ws.access.canPublish && (ready.length > 0 || run.running?.batch === "ready") && (
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={busy}
                onClick={() => void start("ready", ready)}
              >
                <ShieldCheck aria-hidden />
                {label("ready", `Xuất bản ${ready.length} ván đủ dữ liệu`)}
              </Button>
            )}
            {(partial.length > 0 || run.running?.batch === "partial") && (
              <div className="space-y-2.5">
                {partial.length > 0 && (
                  <Gaps gaps={commonGaps(partial)} title={`${partial.length} ván xuất bản được, còn thiếu`} />
                )}
                {ws.access.canPublish && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full"
                    disabled={busy}
                    onClick={() => void start("partial", partial)}
                  >
                    {label("partial", `Xuất bản ${partial.length} ván còn thiếu`)}
                  </Button>
                )}
              </div>
            )}
            {blocked.length > 0 && (
              <Gaps gaps={commonBlocks(blocked, gameFieldWords)} title={`${blocked.length} ván chưa xuất bản được`} />
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
            <p className="type-label text-destructive">Không xuất bản được {failures.length} ván</p>
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
