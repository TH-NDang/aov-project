import type { DocumentView, GameContent } from "@aov/community-contracts"
import { ChevronRight } from "lucide-react"
import type { TeamView } from "../../model/game-view"
import type { ProgressStep } from "../../model/recording-progress"
import type { GameDesk } from "../game-desk"
import { MatchPublishPanel } from "../match-publish-panel"
import { ProgressPanel } from "../progress-panel"

/** Publishing the games of the match, and folded under it the game on screen step by step. */
export function PublishTool({
  games,
  team,
  canPublish,
  beforePublish,
  desk,
  onOpenStep,
}: {
  games: DocumentView<GameContent>[]
  team: (id: string) => TeamView
  canPublish: boolean
  /** Waits for the edits still being saved, so the games are published at their latest version. */
  beforePublish: () => Promise<void>
  /** The game on screen; null while none is. */
  desk: GameDesk | null
  onOpenStep: (gameId: string, step: ProgressStep) => void
}) {
  return (
    <>
      <MatchPublishPanel
        games={games}
        team={team}
        canPublish={canPublish}
        beforePublish={beforePublish}
        onOpenStep={onOpenStep}
      />
      {desk && (
        <details className="group border-t">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-muted-foreground group-open:rotate-90" aria-hidden />
            Ván {desk.view.number}, từng mục
          </summary>
          <ProgressPanel
            progress={desk.progress}
            game={desk.view}
            content={desk.entry.content}
            publishedAt={desk.entry.publishedAt}
            canPublish={canPublish}
            onOpen={(step) => onOpenStep(desk.entry.id, step)}
            onConfirm={desk.publish}
          />
          {/* Viewing has no foot, so a refusal of this game is told under the button that asked for it. */}
          {!desk.editable && desk.saveError && (
            <p role="alert" className="type-body px-3 pb-3 text-destructive">
              {desk.saveError}
            </p>
          )}
        </details>
      )}
    </>
  )
}
