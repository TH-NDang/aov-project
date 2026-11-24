import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { CircleCheck, CircleDashed, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { formatClock } from "@/lib/clock"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { missingFieldLabel } from "@/features/tournaments/model/tournament-model"
import type { TeamView } from "../model/game-view"
import { publishGames, type PublishResult } from "../data/match-publishing"
import { publishRows, type PublishRow } from "../model/match-publishing"
import type { ProgressTarget } from "../model/recording-progress"
import { STATE_LABELS } from "../components/game/progress-badge"
import { RelativeDate } from "../components/relative-date"
import { TeamLogo } from "../components/primitives"

const winnerOf = (row: PublishRow) => {
  const { sides, winner } = row.entry.content
  return winner ? sides.find((side) => side.side === winner)?.teamId : undefined
}

/** How many problems of one game are listed before the rest is only counted. */
const SHOWN_ISSUES = 4

/**
 * Every game of the match with what still keeps it from being published, and one action that publishes all that are
 * ready, one after another. A step opens the panel that records it, in its game.
 */
export function MatchPublishPanel({
  games,
  team,
  canPublish,
  beforePublish,
  onOpenStep,
}: {
  games: DocumentView<GameContent>[]
  team: (id: string) => TeamView
  canPublish: boolean
  /** Waits for edits of the open game that are still being saved, so the published copy has them. */
  beforePublish: () => Promise<void>
  onOpenStep: (gameId: string, target: ProgressTarget) => void
}) {
  const client = useQueryClient()
  const rows = publishRows(games)
  const ready = rows.filter((row) => row.state === "ready")
  const [results, setResults] = useState<Record<number, PublishResult>>({})
  const publish = useMutation({
    mutationFn: async (ids: string[]) => {
      await beforePublish()
      // Saving may have moved a game to a newer version since the question; what is published is what is saved now.
      const latest = await Promise.all(ids.map((id) => tournamentApi.read("games", id)))
      return publishGames(tournamentApi, latest, (result) => {
        setResults((current) => ({ ...current, [result.number]: result }))
        if (result.ok)
          client.setQueriesData<DocumentView<GameContent>[]>({ queryKey: tournamentKeys.kind("games") }, (cached) =>
            cached?.map((row) => (row.id === result.entry.id ? result.entry : row)),
          )
      })
    },
    onSettled: () => client.invalidateQueries({ queryKey: tournamentKeys.kind("games") }),
  })
  const confirm = async () => {
    const accepted = await confirmAction({
      title: `Xuất bản ${ready.length} ván?`,
      description: "Mỗi ván được chốt và thay bản đang hiện ở trang công khai.",
      details: (
        <ul className="space-y-1.5">
          {ready.map((row) => (
            <li key={row.entry.id} className="flex items-center gap-2">
              <TeamLogo team={team(winnerOf(row) ?? "")} size={20} />
              <span>Ván {row.number}</span>
              <span className="text-muted-foreground">
                {team(winnerOf(row) ?? "").name} thắng · {formatClock(row.entry.content.durationSeconds)}
                {row.progress.state === "changed" && " · thay bản đã xuất bản"}
              </span>
            </li>
          ))}
        </ul>
      ),
      confirmLabel: `Xuất bản ${ready.length} ván`,
      cancelLabel: "Kiểm tra lại",
      tone: "publish",
    })
    if (!accepted) return
    setResults({})
    publish.mutate(ready.map((row) => row.entry.id))
  }

  return (
    <div className="space-y-3 p-4">
      <ul className="divide-y rounded-xl border" aria-label="Các ván của trận">
        {rows.map((row) => (
          <PublishLine
            key={row.entry.id}
            row={row}
            winner={winnerOf(row) ? team(winnerOf(row)!) : null}
            result={results[row.number]}
            onOpen={(target) => onOpenStep(row.entry.id, target)}
          />
        ))}
      </ul>
      {canPublish ? (
        <Button className="w-full" disabled={!ready.length || publish.isPending} onClick={() => void confirm()}>
          {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          {ready.length ? `Xuất bản ${ready.length} ván đủ dữ liệu` : "Chưa có ván nào chờ xuất bản"}
        </Button>
      ) : (
        <p className="type-meta">Tài khoản chưa có quyền xuất bản ván.</p>
      )}
    </div>
  )
}

function PublishLine({
  row,
  winner,
  result,
  onOpen,
}: {
  row: PublishRow
  winner: TeamView | null
  result?: PublishResult
  onOpen: (target: ProgressTarget) => void
}) {
  const refused = result && !result.ok ? result : null
  const issues = refused?.fields.length ? refused.fields : row.state === "published" ? [] : row.issues
  const Icon = row.state === "blocked" ? CircleDashed : CircleCheck
  return (
    <li className="space-y-1.5 px-3 py-2" data-publish={row.state}>
      <div className="flex items-center gap-2">
        <Icon
          size={16}
          aria-hidden
          className={cn(
            "shrink-0",
            row.state === "published" && "text-(--aov-success)",
            row.state === "ready" && "text-[var(--esp-gold-text)]",
            row.state === "blocked" && "text-muted-foreground",
          )}
        />
        <span className="type-body">Ván {row.number}</span>
        {winner && <TeamLogo team={winner} size={18} />}
        <span className="type-meta ml-auto">
          {row.state === "published" ? (
            <>
              Đã xuất bản <RelativeDate value={row.entry.publishedAt} withTime />
            </>
          ) : row.state === "ready" ? (
            STATE_LABELS[row.progress.state]
          ) : (
            `${row.progress.done}/${row.progress.total} mục bắt buộc`
          )}
        </span>
      </div>
      {row.state !== "published" && row.steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-6">
          {row.steps.map((step) => (
            <Button key={step.id} size="xs" variant="outline" onClick={() => onOpen(step.target)}>
              {step.label} <span className="esp-num text-muted-foreground">{step.detail}</span>
            </Button>
          ))}
        </div>
      )}
      {refused && !refused.fields.length && (
        <p className="type-meta pl-6 text-destructive" role="alert">
          Chưa xuất bản được: {refused.message}
        </p>
      )}
      {issues.length > 0 && (
        <ul
          className={cn("type-meta list-disc space-y-0.5 pl-10", refused && "text-destructive")}
          role={refused ? "alert" : undefined}
        >
          {issues.slice(0, SHOWN_ISSUES).map((field, index) => (
            <li key={`${field}-${index}`}>{missingFieldLabel(field)}</li>
          ))}
          {issues.length > SHOWN_ISSUES && <li>và {issues.length - SHOWN_ISSUES} mục khác</li>}
        </ul>
      )}
    </li>
  )
}
