import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { ArrowRight, Replace, Trophy, Wand2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { FinalTableEditButton } from "@/features/tournaments/components/tournament-final-table-editor"
import { FinalNotes } from "./final-notes"
import { FinalPlacesTable, placeLabel } from "./final-places-table"
import { FinalScore } from "./final-score"
import { blocksFilling, filledPlacements, type FinalOutcome, type FinalRow, type ResultIssue } from "./final-state"
import { Notice, Panel, type Workspace } from "./parts"

/** What is recorded against what is found, and what to do about it. */
function issueText({ kind, source, recorded, found }: ResultIssue) {
  const where = source === "TABLE" ? "Bảng thứ hạng ghi" : "Kết quả đã ghi là"
  const check = "Kiểm tra các trận cuối trong lịch trước khi điền theo gợi ý."
  switch (kind) {
    case "CHAMPION":
      return `${where} ${recorded} vô địch, còn các trận cho thấy ${found}. ${check}`
    case "RUNNER_UP":
      return `${where} ${recorded} á quân, còn các trận cho thấy ${found}. ${check}`
    case "SCORE":
      return `Kết quả đã ghi tỷ số chung kết ${recorded}, còn trận chung kết trong lịch là ${found}.`
    case "OLD_RESULT":
      return `Kết quả nhập trước đây ghi ${recorded} vô địch, còn bảng thứ hạng ghi ${found}. Trang công khai lấy theo bảng thứ hạng.`
  }
}

/** The places that would change, each from the recorded one to the one the matches tell. */
function PlaceChanges({ rows }: { rows: FinalRow[] }) {
  return (
    <ul className="max-h-60 space-y-1 overflow-y-auto">
      {rows.map(({ key, teamName, recorded, suggested }) => (
        <li key={key} className="flex flex-wrap items-center gap-x-1.5">
          {teamName}: <span className="text-muted-foreground">hạng {placeLabel(recorded!.place)}</span>
          <ArrowRight aria-label="thành" className="size-3.5 shrink-0" />
          <span>hạng {placeLabel(suggested!.place)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The final table beside what the matches tell about it. Places only the matches know are added at once, places they
 * contradict are replaced after a question, and neither touches a prize. Nothing is filled in while the matches name
 * other finalists than those recorded.
 */
export function FinalPlaces({
  ws,
  tournament,
  content,
  outcome,
}: {
  ws: Workspace
  /** The record to write to; absent while it loads. */
  tournament?: DocumentView<TournamentContent>
  content: TournamentContent
  outcome: FinalOutcome
}) {
  const client = useQueryClient()
  const { rows, issue, over } = outcome
  const placed = rows.filter((row) => row.state !== "OPEN")
  const missing = rows.filter((row) => row.state === "MISSING")
  const differing = rows.filter((row) => row.state === "DIFFERS")
  const fillable = ws.canEdit && !!tournament && !blocksFilling(issue)
  const save = useMutation({
    mutationFn: (which: "MISSING" | "DIFFERS") =>
      tournamentApi.save("tournaments", tournament!, {
        ...tournament!.content,
        placements: filledPlacements(tournament!.content.placements ?? [], rows, which),
      }),
    meta: { silent: true, successMessage: "Đã ghi thứ hạng theo kết quả các trận." },
    onSuccess: () => client.invalidateQueries({ queryKey: tournamentKeys.all }),
  })
  const replace = async () => {
    const confirmed = await confirmAction({
      title: `Thay ${differing.length} hạng đã ghi?`,
      description: "Thứ hạng đổi theo kết quả các trận. Tiền thưởng đi theo đội, giải thưởng giữ nguyên.",
      details: <PlaceChanges rows={differing} />,
      confirmLabel: `Thay ${differing.length} hạng`,
    })
    if (confirmed) save.mutate("DIFFERS")
  }

  return (
    <Panel
      title="Kết quả chung cuộc"
      icon={Trophy}
      className="@container"
      action={
        ws.canEdit &&
        tournament && (
          <div className="flex flex-wrap gap-2">
            {fillable && missing.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant={over ? "default" : "outline"}
                disabled={save.isPending}
                onClick={() => save.mutate("MISSING")}
              >
                <Wand2 aria-hidden /> Điền {missing.length} thứ hạng
              </Button>
            )}
            {fillable && differing.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={save.isPending}
                onClick={() => void replace()}
              >
                <Replace aria-hidden /> Thay {differing.length} hạng lệch
              </Button>
            )}
            <FinalTableEditButton
              tournament={tournament}
              teamOfPlayer={(playerId) => {
                const row = ws.rosters.find((entry) => entry.content.playerId === playerId)
                return row && { id: row.content.teamId, name: ws.team(row.content.teamId).name }
              }}
            />
          </div>
        )
      }
    >
      <FinalScore ws={ws} tournament={content} outcome={outcome} />
      {issue && (
        <div className="border-b p-3">
          <Notice tone="warn">{issueText(issue)}</Notice>
        </div>
      )}
      {save.error && (
        <p className="type-body border-b px-4 py-3 text-destructive" role="alert">
          {tournamentError(save.error)}
        </p>
      )}
      {placed.length ? (
        <FinalPlacesTable rows={placed} content={content} team={(id) => ws.team(id)} />
      ) : (
        <p className="type-meta p-4">Chưa có thứ hạng, và các trận chưa cho biết đội nào đứng thứ mấy.</p>
      )}
      <FinalNotes ws={ws} outcome={outcome} />
    </Panel>
  )
}
