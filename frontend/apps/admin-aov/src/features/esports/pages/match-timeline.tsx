import type { GameContent, Selection } from "@aov/community-contracts"
import { Undo2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { ItemLookups } from "../components/game/cluster-card"
import { BroadcastTimeline } from "../components/series/broadcast-timeline"
import type { TimelineRow } from "../components/series/timeline-rows"
import type { BroadcastChapter, RetimeTarget } from "../model/broadcast-timeline"
import type { GameView } from "../model/game-view"
import { markerMove, type ContentChange } from "../model/marker-move"
import { chapterAt, sourceOf, type GameChapter } from "../model/series-vod"
import type { TimelineEvent } from "../model/timeline"
import type { DetailRequest, Panel } from "./focused-game"

/**
 * The broadcast timeline of the match page. While recording, a row records a moment in the game the position belongs
 * to, and a marker of the focused game moved on the bar is saved at once with an undo shown in the hint line.
 */
export function MatchTimeline({
  duration,
  at,
  chapters,
  flags,
  events,
  views,
  lookups,
  heroIcon,
  videoId,
  focused,
  activeId,
  editable,
  undo,
  onUndone,
  onSave,
  onUndoable,
  onPanel,
  onNote,
  seek,
  onActive,
  onSelect,
  onDetail,
}: {
  duration: number
  at: number
  chapters: GameChapter[]
  flags: BroadcastChapter[]
  events: TimelineEvent[]
  views: Record<string, GameView>
  lookups: ItemLookups
  heroIcon: (hero: Selection) => string | null | undefined
  videoId: string | null
  focused: GameChapter | undefined
  /** Stored id of the selected moment of the focused game. */
  activeId: string | null
  editable: boolean
  undo: { id: number; text: string; revert: () => void } | null
  onUndone: () => void
  /** Saves a change of the focused game. */
  onSave: (change: (content: GameContent) => GameContent) => void
  onUndoable: (undo: { gameId: string; text: string; revert: () => void }) => void
  onPanel: (panel: Panel) => void
  /** Says why the bar recorded nothing. */
  onNote: (text: string) => void
  seek: (second: number) => void
  onActive: (id: string | null) => void
  onSelect: (event: TimelineEvent) => void
  onDetail: (detail: DetailRequest) => void
}) {
  // Recording on the bar. A moment is recorded in the game the position belongs to; seeking there first makes that
  // game the focused one, so the composer opens in it.
  const createAt = (row: TimelineRow, second?: number) => {
    const target = second ?? at
    const chapter = chapterAt(chapters, target)
    if (!chapter?.live || target < chapter.start) {
      onNote("Vị trí này chưa nằm trong ván nào đã vào trận")
      return
    }
    if (second !== undefined) seek(second)
    onPanel({
      kind: "composer",
      eventKind: row === "MID" ? "OBJECTIVE" : "KILL",
      at: target,
      side: row === "MID" ? undefined : row,
    })
  }
  const retime = (target: RetimeTarget, second: number) => {
    const chapter = chapters.find((candidate) => candidate.gameId === target.gameId)
    if (!chapter || target.gameId !== focused?.gameId) return
    const move = markerMove(target, second, chapter, views[target.gameId])
    if (!move) return
    const save = (change: ContentChange) => onSave((content) => change(content) ?? content)
    save(move.apply)
    onUndoable({ gameId: target.gameId, text: move.text, revert: () => save(move.revert) })
  }

  return (
    <BroadcastTimeline
      duration={duration}
      current={at}
      chapters={chapters}
      flags={flags}
      events={events}
      views={views}
      chapterTitle={(chapter) => {
        const winner = chapter.winner ? views[chapter.gameId]?.sides[chapter.winner].team.shortName : null
        return winner ? `${winner} thắng` : ""
      }}
      focusedGameId={focused?.gameId ?? null}
      activeId={activeId && focused ? `${focused.gameId}|${activeId}` : null}
      isDimmed={() => false}
      lookups={lookups}
      label={videoId ? "Dòng thời gian video" : "Dòng thời gian trận"}
      heroIcon={heroIcon}
      notice={
        undo && (
          <span
            key={undo.id}
            role="status"
            className="esp-num flex items-center gap-2 text-foreground animate-in fade-in"
          >
            {undo.text}
            <Button
              size="sm"
              variant="secondary"
              className="h-6 rounded-full px-2.5 text-xs"
              onClick={() => {
                undo.revert()
                onUndone()
              }}
            >
              <Undo2 size={12} /> Hoàn tác
            </Button>
          </span>
        )
      }
      editing={
        editable && focused
          ? { gameId: focused.gameId, canCreate: focused.live, onCreate: createAt, onRetime: retime }
          : undefined
      }
      onSeek={(second) => {
        onActive(null)
        seek(second)
      }}
      onSelect={onSelect}
      onOpen={(cluster) => {
        const { gameId } = sourceOf(cluster.id)
        seek(cluster.start)
        onDetail({ gameId, ids: cluster.events.map((event) => sourceOf(event.id).id) })
      }}
    />
  )
}
