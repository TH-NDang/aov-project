import { Link } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, GameContent, SeriesContent } from "@aov/community-contracts"
import { CalendarCog, Check, TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { isWebLink, resultProblem } from "@/features/competition/workspace/model"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import type { TeamView } from "../model/game-view"
import { scoreFromGames } from "../model/series-score"
import { TeamLogo } from "../components/primitives"
import { schedulePath } from "./edit-match-button"

/** The score changed between the question and the write. */
class ScoreChangedError extends Error {
  constructor() {
    super("Tỷ số của trận vừa được sửa ở nơi khác. Xem lại trước khi đặt.")
    this.name = "ScoreChangedError"
  }
}

/**
 * Says when the winners of the recorded games do not add up to the score of the match, and sets that score from them
 * once the editor agreed to the old and the new one. The score is otherwise edited in the schedule.
 */
export function ScoreCheck({
  record,
  games,
  team,
  fallbackSource,
}: {
  record: DocumentView<SeriesContent>
  games: DocumentView<GameContent>[]
  team: (id: string) => TeamView
  /** Source of a first score when the match has none of its own, such as the tournament's. */
  fallbackSource?: string | null
}) {
  const client = useQueryClient()
  const { content } = record
  const score = scoreFromGames(content, games)
  const source = [content.result?.sourceUrl, content.sourceUrl, fallbackSource].find((url) => url && isWebLink(url))
  const save = useMutation({
    mutationFn: async (next: { scoreA: number; scoreB: number }) => {
      const latest = await tournamentApi.read("series", record.id)
      const now = latest.content.result
      if (now?.scoreA !== content.result?.scoreA || now?.scoreB !== content.result?.scoreB)
        throw new ScoreChangedError()
      return tournamentApi.save("series", latest, {
        ...latest.content,
        result: {
          sourceUrl: source ?? "",
          verification: "UNVERIFIED",
          verifiedOn: null,
          ...now,
          ...next,
        },
      })
    },
    meta: { silent: true, successMessage: "Đã đặt tỷ số của trận." },
    onSettled: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  if (!score) return null

  const [a, b] = [team(content.teamAId), team(content.teamBId)]
  const before = content.result ? `${content.result.scoreA} – ${content.result.scoreB}` : "chưa có tỷ số"
  const after = `${score.scoreA} – ${score.scoreB}`
  const problem = resultProblem(content.bestOf, score.scoreA, score.scoreB, source ?? "")
  const set = async () => {
    const confirmed = await confirmAction({
      title: content.result ? "Đổi tỷ số đã nhập?" : "Đặt tỷ số theo các ván?",
      description: `${a.name} – ${b.name}: ${before} → ${after}. Bảng xếp hạng và nhánh đấu trong bản nháp đổi theo; trang công khai chỉ đổi sau khi công bố lại.`,
      confirmLabel: `Đặt tỷ số ${after}`,
      tone: content.result ? "destructive" : "publish",
    })
    if (confirmed) save.mutate(score)
  }
  return (
    <section
      aria-label="Tỷ số và các ván"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-(--aov-warning)/40 bg-(--aov-warning-soft) px-3 py-2"
    >
      <TriangleAlert size={16} className="shrink-0 text-(--aov-warning)" aria-hidden />
      <p className="type-body flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5">
        <span>Đội thắng các ván:</span>
        <TeamLogo team={a} size={18} />
        <b className="esp-num">{after}</b>
        <TeamLogo team={b} size={18} />
        <span className="text-muted-foreground">
          {content.result ? `· tỷ số đang ghi ${before}` : "· trận chưa có tỷ số"}
        </span>
      </p>
      {(problem || save.isError) && (
        <p className="type-meta text-destructive" role="alert">
          {save.error instanceof ScoreChangedError
            ? save.error.message
            : save.isError
              ? tournamentError(save.error)
              : problem}
        </p>
      )}
      <span className="flex items-center gap-1.5">
        {!problem && (
          <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => void set()}>
            <Check aria-hidden /> Đặt tỷ số {after}
          </Button>
        )}
        {problem && (
          <Button asChild size="sm" variant="outline">
            <Link to={schedulePath(content.tournamentId, record.id)}>
              <CalendarCog aria-hidden /> Mở lịch
            </Link>
          </Button>
        )}
      </span>
    </section>
  )
}
