import type { CompetitionStage } from "@aov/community-contracts"
import { ArrowLeft, ArrowRight, GitBranch, ListOrdered } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { FORMAT_NAMES, isLeagueStage, stageProgress } from "./model"
import { Chip, type Workspace } from "./parts"

/** One stage in the row of stages: what it is, how far it is, and its place in the order. */
export function StageCard({
  ws,
  stage,
  index,
  active,
  onOpen,
  onMove,
}: {
  ws: Workspace
  stage: CompetitionStage
  index: number
  active: boolean
  onOpen: () => void
  onMove?: (offset: -1 | 1) => void
}) {
  const progress = stageProgress(stage.code, ws.plan, ws.resolved)
  const league = isLeagueStage(stage)
  return (
    <div className={cn("admin-panel group relative min-w-64 flex-1", active && "border-primary")}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onOpen}
        className="size-full rounded-[inherit] p-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="type-label flex items-center gap-1.5 text-muted-foreground">
            {league ? <ListOrdered className="size-4" aria-hidden /> : <GitBranch className="size-4" aria-hidden />}
            Giai đoạn {index + 1}
          </span>
          <Chip
            tone={progress.total && progress.scored === progress.total ? "ok" : progress.total ? "warn" : "neutral"}
          >
            {progress.total ? `${progress.scored}/${progress.total} trận` : "Chưa có lịch"}
          </Chip>
        </span>
        <span className="type-section-title mt-1.5 block">{stage.name}</span>
        <span className="mt-2.5 flex flex-wrap gap-1.5 pr-18">
          <Chip>
            {FORMAT_NAMES[stage.format] ?? stage.format}
            {league && stage.legs > 1 ? ` ${stage.legs} lượt` : ""}
          </Chip>
          <Chip>BO{stage.bestOf}</Chip>
          {!!stage.teamIds?.length && <Chip>{stage.teamIds.length} đội</Chip>}
          {league && stage.advance > 0 && <Chip tone="gold">{stage.advance} đội đi tiếp</Chip>}
        </span>
      </button>
      {onMove && (
        <span className="absolute right-3 bottom-3 flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Đưa ${stage.name} lên trước`}
            title="Đưa lên trước"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Đưa ${stage.name} ra sau`}
            title="Đưa ra sau"
            disabled={index === ws.plan.stages.length - 1}
            onClick={() => onMove(1)}
          >
            <ArrowRight aria-hidden />
          </Button>
        </span>
      )}
    </div>
  )
}
