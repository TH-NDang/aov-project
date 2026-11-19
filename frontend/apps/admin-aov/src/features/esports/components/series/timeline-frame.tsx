import { Plus, Target } from "lucide-react"
import type { GameView } from "../../model/game-view"
import type { GameChapter } from "../../model/series-vod"
import { eventSide, type TimelineEvent } from "../../model/timeline"
import { TeamLogo } from "../primitives"
import type { TimelineEditing, TimelineRow } from "./timeline-rows"

/** The whole video above the detail track: games as chapters, their kills and objectives, the zoomed window and the playhead. */
export function TimelineOverview({
  duration,
  current,
  chapters,
  events,
  focusedGameId,
  zoom,
  scroll,
  pct,
  onSeek,
}: {
  duration: number
  current: number
  chapters: GameChapter[]
  events: TimelineEvent[]
  focusedGameId: string | undefined
  zoom: number
  /** The part of the track scrolled into view, as fractions of its width. */
  scroll: { left: number; visible: number }
  pct: (second: number) => string
  onSeek: (second: number) => void
}) {
  return (
    <div
      className="esp-bt-overview"
      aria-hidden="true"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onSeek(Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * duration))
      }}
    >
      {chapters.map((chapter) =>
        chapter.draft ? (
          <span
            key={`draft-${chapter.gameId}`}
            className="esp-bt-overview-draft"
            style={{
              left: pct(chapter.draft.start),
              width: pct((chapter.draft.locked ?? chapter.start) - chapter.draft.start),
            }}
          />
        ) : null,
      )}
      {chapters.map((chapter) => (
        <span
          key={chapter.gameId}
          className="esp-bt-overview-chapter"
          data-focused={chapter.gameId === focusedGameId || undefined}
          data-synced={chapter.synced || undefined}
          style={{ left: pct(chapter.start), width: `calc(${pct(chapter.end - chapter.start)} + 1px)` }}
        >
          {/* On a narrow overview a game is a few pixels wide and the name would be cut to one letter. */}
          <span className="hidden @2xl:inline">V{chapter.number}</span>
        </span>
      ))}
      {events.map((event) =>
        event.kind === "KILL" || event.kind === "OBJECTIVE" ? (
          <span
            key={event.id}
            className="esp-bt-overview-tick"
            data-side={eventSide(event) ?? undefined}
            data-kind={event.kind}
            style={{ left: pct(event.at) }}
          />
        ) : null,
      )}
      {zoom > 1 && (
        <span
          className="esp-bt-overview-window"
          style={{ left: `${scroll.left * 100}%`, width: `${scroll.visible * 100}%` }}
        />
      )}
      <span className="esp-bt-overview-playhead" style={{ left: pct(current) }} />
    </div>
  )
}

/** What each row of the track holds; while recording, the plus records a moment of that row at the playhead. */
export function TimelineLanes({
  sides,
  editing,
}: {
  /** The teams of the focused game. */
  sides: GameView["sides"] | undefined
  editing: TimelineEditing | undefined
}) {
  const lanes: { row: TimelineRow; name: string; add: string }[] = [
    {
      row: "BLUE",
      name: sides?.BLUE.team.shortName ?? "Đội xanh",
      add: `Ghi hạ gục của ${sides?.BLUE.team.name ?? "đội xanh"} tại vị trí video hiện tại`,
    },
    { row: "MID", name: "Mục tiêu", add: "Ghi mục tiêu hoặc khoảnh khắc tại vị trí video hiện tại" },
    {
      row: "RED",
      name: sides?.RED.team.shortName ?? "Đội đỏ",
      add: `Ghi hạ gục của ${sides?.RED.team.name ?? "đội đỏ"} tại vị trí video hiện tại`,
    },
  ]
  return (
    <div className="esp-bt-lanes" data-timeline-lanes>
      {lanes.map((lane) => (
        <div
          key={lane.row}
          className="esp-bt-lane"
          data-side={lane.row === "MID" ? undefined : lane.row}
          data-row={lane.row}
          title={lane.row === "MID" ? "Mục tiêu lớn và khoảnh khắc" : `Hạ gục và trang bị · ${lane.name}`}
        >
          {lane.row === "MID" ? (
            <Target size={15} className="shrink-0 text-[var(--esp-gold-text)]" aria-hidden="true" />
          ) : (
            sides && <TeamLogo team={sides[lane.row].team} size={18} />
          )}
          <span className="hidden min-w-0 flex-1 truncate @2xl:block">{lane.name}</span>
          {editing && (
            <button
              type="button"
              className="esp-bt-add"
              data-add={lane.row}
              disabled={!editing.canCreate}
              aria-label={lane.add}
              title={editing.canCreate ? lane.add : "Vào trận rồi mới ghi được sự kiện"}
              onClick={() => editing.onCreate(lane.row)}
            >
              <Plus size={13} strokeWidth={2.6} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
