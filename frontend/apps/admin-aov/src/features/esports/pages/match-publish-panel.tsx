import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { CircleCheck, CircleDashed, CircleDot, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { formatClock } from "@/lib/clock"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { gameFieldWords } from "@/features/tournaments/model/game-field-words"
import type { TeamView } from "../model/game-view"
import { publishGames, type PublishResult } from "../data/match-publishing"
import { commonGaps, publishRows, type PublishRow } from "../model/match-publishing"
import type { ProgressStep } from "../model/recording-progress"
import { STATE_LABELS } from "../components/game/progress-badge"
import { RelativeDate } from "../components/relative-date"
import { TeamLogo } from "../components/primitives"

const winnerOf = (row: PublishRow) => {
  const { sides, winner } = row.entry.content
  return winner ? sides.find((side) => side.side === winner)?.teamId : undefined
}

/** How many problems of one game are listed before the rest is only counted. */
const SHOWN_ISSUES = 4

/** The two groups of games one action publishes each: those with every part, and those with parts left unknown. */
type Batch = "ready" | "partial"

/**
 * Every game of the match with what still keeps it from being published, and one action that publishes all that are
 * ready, one after another. A step opens the tool that records it, in its game.
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
  onOpenStep: (gameId: string, step: ProgressStep) => void
}) {
  const client = useQueryClient()
  const rows = publishRows(games)
  const ready = rows.filter((row) => row.state === "ready")
  const partial = rows.filter((row) => row.state === "partial")
  const [results, setResults] = useState<Record<number, PublishResult>>({})
  const publish = useMutation({
    mutationFn: async ({ ids }: { batch: Batch; ids: string[] }) => {
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
  // The group being published; its action alone shows that it runs.
  const running = publish.isPending ? publish.variables?.batch : undefined
  const confirm = async (group: Batch, batch: PublishRow[]) => {
    const gaps = commonGaps(batch)
    const accepted = await confirmAction({
      title: `Xuất bản ${batch.length} ván?`,
      description: `Mỗi ván được chốt và thay bản đang hiện ở trang công khai.${
        gaps.length
          ? ` Phần còn thiếu hiện là chưa rõ: ${gaps.map(({ label }) => label.toLocaleLowerCase("vi")).join(", ")}.`
          : ""
      }`,
      details: (
        <ul className="space-y-1.5">
          {batch.map((row) => (
            <li key={row.entry.id} className="flex items-center gap-2">
              <TeamLogo team={team(winnerOf(row) ?? "")} size={20} />
              <span>Ván {row.number}</span>
              <span className="text-muted-foreground">
                {team(winnerOf(row) ?? "").name} thắng, {formatClock(row.entry.content.durationSeconds)}
                {row.progress.state === "changed" && ", thay bản đã xuất bản"}
              </span>
            </li>
          ))}
        </ul>
      ),
      confirmLabel: `Xuất bản ${batch.length} ván`,
      cancelLabel: "Kiểm tra lại",
      tone: "publish",
    })
    if (!accepted) return
    setResults({})
    publish.mutate({ batch: group, ids: batch.map((row) => row.entry.id) })
  }

  return (
    <div className="space-y-3 p-3">
      <ul className="divide-y border-b" aria-label="Các ván của trận">
        {rows.map((row) => (
          <PublishLine
            key={row.entry.id}
            row={row}
            winner={winnerOf(row) ? team(winnerOf(row)!) : null}
            result={results[row.number]}
            onOpen={(step) => onOpenStep(row.entry.id, step)}
          />
        ))}
      </ul>
      {canPublish ? (
        <div className="space-y-2">
          {(ready.length > 0 || !partial.length) && (
            <Button
              variant={ready.length ? "default" : "outline"}
              className="w-full"
              disabled={!ready.length || publish.isPending}
              onClick={() => void confirm("ready", ready)}
            >
              {running === "ready" ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
              {ready.length ? `Xuất bản ${ready.length} ván đủ dữ liệu` : "Chưa có ván nào chờ xuất bản"}
            </Button>
          )}
          {partial.length > 0 && (
            <Button
              variant="outline"
              className="w-full"
              disabled={publish.isPending}
              onClick={() => void confirm("partial", partial)}
            >
              {running === "partial" && <Loader2 className="animate-spin" aria-hidden />}
              {`Xuất bản ${partial.length} ván còn thiếu`}
            </Button>
          )}
        </div>
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
  onOpen: (step: ProgressStep) => void
}) {
  const refused = result && !result.ok ? result : null
  const issues = refused?.fields.length ? refused.fields : row.state === "published" ? [] : row.issues
  const Icon = row.state === "blocked" ? CircleDashed : row.state === "partial" ? CircleDot : CircleCheck
  return (
    <li className="space-y-1.5 py-2" data-publish={row.state}>
      <div className="flex items-center gap-2">
        <Icon
          size={16}
          aria-hidden
          className={cn(
            "shrink-0",
            row.state === "published" && "text-(--aov-success)",
            (row.state === "ready" || row.state === "partial") && "text-foreground",
            row.state === "blocked" && "text-muted-foreground",
          )}
        />
        <span className="type-body">Ván {row.number}</span>
        {winner && <TeamLogo team={winner} size={18} />}
        <span className="type-meta ml-auto">
          {row.state === "published" ? (
            <>
              Đã xuất bản <RelativeDate value={row.entry.publishedAt} withTime inSentence />
            </>
          ) : row.state === "ready" ? (
            STATE_LABELS[row.progress.state]
          ) : row.state === "partial" ? (
            "Xuất bản được, còn thiếu"
          ) : (
            `${row.progress.done}/${row.progress.total} mục cần ghi`
          )}
        </span>
      </div>
      {row.state !== "published" && row.steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-6">
          {row.steps.map((step) => (
            <Button key={step.id} size="xs" variant="outline" onClick={() => onOpen(step)}>
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
            <li key={`${field}-${index}`}>{gameFieldWords(field, row.entry.content)}</li>
          ))}
          {issues.length > SHOWN_ISSUES && <li>và {issues.length - SHOWN_ISSUES} mục khác</li>}
        </ul>
      )}
    </li>
  )
}
