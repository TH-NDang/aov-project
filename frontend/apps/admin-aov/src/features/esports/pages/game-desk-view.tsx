import { useEffect, useMemo } from "react"
import type { DocumentView, GameContent, Reference, Side } from "@aov/community-contracts"
import { useSaverState } from "../data/use-game-saver"
import { previousGame } from "../model/carry-over"
import { endChange, timeChange, winnerChange } from "../model/game-times"
import type { StepAction } from "../model/next-step"
import { seriesLocks } from "../model/series-rules"
import { chapterVideo, type GameChapter } from "../model/series-vod"
import { useDeskChanges } from "./desk-changes"
import type { GameDesk } from "./game-desk"
import { PanelBody } from "./match-panel"
import type { Studio } from "./match-studio"
import { BodyAndFoot, DeskFoot, runWithoutGame } from "./studio-dock"
import { DraftTool } from "./tools/draft-tool"
import { GameTool } from "./tools/game-tool"
import { LineupTool } from "./tools/lineup-tool"
import { MomentsTool } from "./tools/moments-tool"

const NONE: Reference[] = []

/**
 * The game on the desk: its tool or a panel, and its foot. Its writes go through the saver the studio keeps for the
 * game, which outlives this view, so a write still under way when another game comes on the desk is still answered.
 */
export function GameDeskView({
  studio,
  entry,
  chapter,
}: {
  studio: Studio
  entry: DocumentView<GameContent>
  chapter: GameChapter
}) {
  const { recording, games, series, access, editable, panel, target, momentForm } = studio
  const saver = studio.savers.of(entry)
  const state = useSaverState(saver)
  useEffect(() => saver.seen(entry), [saver, entry])
  const changes = useDeskChanges(studio, entry.id, saver)
  const { record, undo } = changes

  const view = studio.views[entry.id]!
  const progress = studio.progressOf[entry.id]!
  const locks = useMemo(
    () => seriesLocks(games, entry.content.number, series.content.bestOf, series.content.repeatPicksAllowed),
    [games, entry.content.number, series.content.bestOf, series.content.repeatPicksAllowed],
  )
  const desk: GameDesk = {
    entry,
    view,
    chapter,
    progress,
    catalog: studio.catalog,
    catalogError: studio.catalogError,
    reloadCatalog: studio.reloadCatalog,
    heroes: studio.catalog?.heroes ?? NONE,
    spells: studio.catalog?.spells ?? NONE,
    items: studio.items,
    lookups: studio.lookups,
    roster: studio.roster,
    locks,
    previous: previousGame(games, entry.content.number),
    tournamentId: series.content.tournamentId,
    tournamentRegion: studio.tournament.content.region,
    editable,
    canPublish: access.canPublish,
    compact: studio.compact,
    videoId: recording.videoId,
    playhead: recording.playhead,
    playing: recording.playing,
    markNow: recording.markNow,
    record,
    save: changes.saveQuietly,
    saveError: state.error,
    publish: saver.publish,
    withdraw: saver.withdraw,
    seekVideo: recording.seek,
    // A game without its 0:00 has no second of the video to go to.
    seekGame: (second, play) => {
      if (chapter.live) recording.seek(chapterVideo(chapter, second), play)
    },
    shareLink: studio.shareLink,
    openTool: studio.openTool,
    openPanel: studio.openPanel,
    say: studio.say,
    activeId: studio.activeId,
    onActive: studio.onActive,
    form: momentForm,
    // A form that comes back after a refusal comes back to this game, wherever the desk is by then.
    onForm: (form) => studio.onForm(form, entry.id),
    onDeleted: () => studio.openPanel(null),
  }
  useEffect(() => {
    studio.desk.current = desk
    // Publishing the match waits for the writes of every game, also of one that left the desk.
    studio.actions.current = {
      record,
      save: changes.saveQuietly,
      publish: saver.publish,
      withdraw: saver.withdraw,
      settled: studio.savers.settled,
    }
    return () => {
      studio.desk.current = null
      studio.actions.current = null
    }
  })

  // The form of a moment waits under a panel with what was typed in it.
  const kept = !!panel && studio.tool === "moments" && !!momentForm
  useEffect(() => {
    if (!kept) return
    // An Enter on the page belongs to what is in sight, never to the form under the panel.
    const guard = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target === document.body) event.preventDefault()
    }
    window.addEventListener("keydown", guard, true)
    return () => window.removeEventListener("keydown", guard, true)
  }, [kept])

  const teamName = (side: Side) => view.sides[side].team.shortName
  const run = async (action: StepAction) => {
    switch (action.kind) {
      case "time": {
        const url = recording.video?.url
        if (await record(timeChange(entry.content, chapter, action.time, action.second, url))) studio.onPhase()
        return
      }
      case "end":
        return record(endChange(entry.content, chapter, action.second, action.winner, teamName))
      case "winner":
        return record(winnerChange(entry.content, action.winner, teamName))
      case "tool":
        return studio.openTool(action.tool, action.target)
      default:
        return runWithoutGame(studio, action)
    }
  }

  return (
    <BodyAndFoot
      studio={studio}
      shown={panel ?? studio.tool}
      foot={
        editable && (
          <DeskFoot
            studio={studio}
            game={{ content: entry.content, chapter, progress, view }}
            undo={undo}
            onRun={run}
            status={{
              error: state.error,
              onReload: state.stale ? () => void saver.reload() : undefined,
              saving: state.saving,
              said: changes.said,
              savedAt: state.savedAt,
              note: view.published ? `Ván ${view.number} đã xuất bản. Sửa ở đây vào bản nháp.` : null,
            }}
          />
        )
      }
    >
      {panel && <PanelBody studio={studio} panel={panel} desk={desk} />}
      {(!panel || kept) && (
        <div hidden={kept} onPointerDownCapture={studio.onTouch} onKeyDownCapture={studio.onTouch}>
          {studio.tool === "draft" && <DraftTool desk={desk} kept={changes.kept} />}
          {studio.tool === "lineup" && <LineupTool desk={desk} target={target} />}
          {studio.tool === "moments" && <MomentsTool desk={desk} />}
          {studio.tool === "game" && (
            <GameTool desk={desk} target={target} issues={studio.issues} onVideo={studio.attachVideo} />
          )}
        </div>
      )}
    </BodyAndFoot>
  )
}
