import type { Selection } from "@aov/community-contracts"
import { Ban, Lock, ShieldBan } from "lucide-react"
import { formatClock } from "@/lib/clock"
import { markerKey } from "../../model/broadcast-timeline"
import type { GameView } from "../../model/game-view"
import type { GameChapter } from "../../model/series-vod"
import { HeroIcon, VIDEO_MARK } from "../primitives"
import { ROW_TOP } from "./timeline-rows"
import type { MarkerDrag } from "./use-marker-drag"

/**
 * The ban/pick phase of each game on the track: its hatched zone up to the lock, the wait until the game starts, its
 * two edges and a hero picture for every turn. Turns belong to teams, not players: teammates still swap heroes until
 * the lock.
 */
export function DraftMarkers({
  chapters,
  views,
  heroIcon,
  markers,
  pct,
  onSeek,
}: {
  chapters: GameChapter[]
  views: Record<string, GameView>
  heroIcon?: (hero: Selection) => string | null | undefined
  markers: Pick<MarkerDrag, "marker" | "shownAt">
  pct: (second: number) => string
  onSeek: (second: number) => void
}) {
  return (
    <>
      {chapters.map((chapter) => {
        const draft = chapter.draft
        const view = views[chapter.gameId]
        if (!draft) return null
        const start = markers.marker({ kind: "draftStart", gameId: chapter.gameId }, draft.start, () =>
          onSeek(draft.start),
        )
        const lock =
          draft.locked == null
            ? null
            : markers.marker({ kind: "draftLock", gameId: chapter.gameId }, draft.locked, () => onSeek(draft.locked!))
        const zoneStart = markers.shownAt(start.key, draft.start)
        const liveAt = markers.shownAt(markerKey({ kind: "gameStart", gameId: chapter.gameId }), chapter.start)
        // Nothing is banned or picked after the lock: the phase ends there, and the rest is the wait for the game.
        const lockAt = lock ? markers.shownAt(lock.key, draft.locked!) : null
        const zoneEnd = lockAt ?? liveAt
        return (
          <div key={`draft-${chapter.gameId}`} className="contents">
            <div
              className="esp-bt-draft"
              data-live={chapter.live || undefined}
              style={{ left: pct(zoneStart), width: pct(Math.max(0, zoneEnd - zoneStart)) }}
              aria-hidden="true"
            >
              <span className="esp-bt-draft-label">Cấm chọn · V{chapter.number}</span>
            </div>
            {lockAt != null && liveAt > lockAt && (
              <div
                className="esp-bt-draft-wait"
                style={{ left: pct(lockAt), width: pct(liveAt - lockAt) }}
                title="Chờ vào trận"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              {...start.props}
              data-edge="draftStart"
              className="esp-bt-edge"
              style={{ left: pct(zoneStart) }}
              aria-label={`Bắt đầu cấm chọn ván ${chapter.number} · ${formatClock(draft.start)}`}
              title={`Bắt đầu cấm chọn ván ${chapter.number} · ${VIDEO_MARK} ${formatClock(draft.start)}${start.canMove ? " · kéo để đổi giây" : ""}`}
            >
              <ShieldBan size={11} strokeWidth={2.4} />
            </button>
            {draft.turns.map((turn) => {
              if (turn.atSecond == null || !turn.hero) return null
              const at = turn.atSecond
              const turnMarker = markers.marker({ kind: "turn", gameId: chapter.gameId, order: turn.order }, at, () =>
                onSeek(at),
              )
              const team = view?.sides[turn.side].team
              const what = `Lượt ${turn.order} · ${turn.kind === "BAN" ? "Cấm" : "Chọn"} · ${team?.shortName ?? ""} · ${turn.hero.name ?? ""}`
              return (
                <button
                  key={turn.order}
                  type="button"
                  {...turnMarker.props}
                  data-side={turn.side}
                  data-kind={turn.kind}
                  className="esp-bt-turn"
                  style={{ left: pct(markers.shownAt(turnMarker.key, at)), top: ROW_TOP[turn.side] }}
                  aria-label={`Ván ${chapter.number} · lượt ${turn.order} · ${turn.kind === "BAN" ? "cấm" : "chọn"} · ${team?.name ?? ""} · ${turn.hero.name ?? ""} · ${formatClock(at)}`}
                  title={turnMarker.canMove ? `${what} · kéo để đổi giây` : what}
                  // The hero picture would otherwise start the browser's own image drag and cancel the pointer.
                  onDragStart={(event) => event.preventDefault()}
                >
                  <HeroIcon
                    hero={{ id: turn.hero.id, name: turn.hero.name ?? "", iconUrl: heroIcon?.(turn.hero) }}
                    size={22}
                    title=""
                    className="rounded-md"
                  />
                  {turn.kind === "BAN" && (
                    <span className="esp-bt-turn-ban">
                      <Ban size={8} strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
            {lock && (
              <button
                type="button"
                {...lock.props}
                data-edge="draftLock"
                data-chapter={`lock-${chapter.gameId}`}
                className="esp-bt-lock"
                style={{ left: pct(lockAt!) }}
                aria-label={`Chốt đội hình ván ${chapter.number} · ${formatClock(draft.locked!)}`}
                title={`Chốt đội hình ván ${chapter.number} · ${VIDEO_MARK} ${formatClock(draft.locked!)}${lock.canMove ? " · kéo để đổi giây" : ""}`}
              >
                <Lock size={10} strokeWidth={2.6} />
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
