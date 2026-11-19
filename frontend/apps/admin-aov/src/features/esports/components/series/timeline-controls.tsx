import type { ReactNode } from "react"
import { Crosshair, Flag, Lock, Minimize2, MousePointerClick, Shield, ZoomIn, ZoomOut } from "lucide-react"
import { spanLabel } from "../../model/broadcast-timeline"
import { chapterClock, type GameChapter } from "../../model/series-vod"
import { TimeTag } from "../primitives"
import type { TimelineEditing } from "./timeline-rows"

/** The line above the track: where the playhead is, fitting the focused game or the whole video, and the zoom. */
export function TimelineToolbar({
  current,
  here,
  focused,
  duration,
  spans,
  shown,
  following,
  onFit,
  onSpan,
}: {
  current: number
  /** The game the playhead is in. */
  here: GameChapter | null
  focused: GameChapter | null | undefined
  duration: number
  spans: number[]
  shown: number
  /** True while the span is the one chosen for the focused game. */
  following: boolean
  onFit: (chapter: GameChapter) => void
  onSpan: (span: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="mr-auto hidden items-center gap-2 text-muted-foreground @2xl:flex">
        <TimeTag kind="video" seconds={current} className="font-semibold text-foreground" />
        {here ? (
          <span>
            Ván {here.number} <TimeTag kind="game" seconds={chapterClock(here, current)} />
          </span>
        ) : (
          <span>Ngoài ván đấu</span>
        )}
      </span>
      {focused && (
        <button type="button" className="esp-bt-button" onClick={() => onFit(focused)}>
          <Crosshair size={13} /> Vừa ván {focused.number}
        </button>
      )}
      <button type="button" className="esp-bt-button" onClick={() => onSpan(duration)}>
        <Minimize2 size={13} /> Toàn video
      </button>
      <span className="flex items-center rounded-md border">
        <button
          type="button"
          className="p-1.5 hover:bg-muted disabled:opacity-40"
          aria-label="Thu nhỏ timeline"
          title="Xem khoảng dài hơn"
          disabled={shown >= duration}
          onClick={() => onSpan(spans.find((value) => value > shown) ?? duration)}
        >
          <ZoomOut size={14} />
        </button>
        <span
          className="esp-num min-w-16 px-1 text-center"
          aria-label="Phạm vi đang xem"
          title={
            following
              ? "Khoảng video thanh đang hiện, tự chọn vừa với ván đang xem. Ctrl + lăn chuột hoặc chụm hai ngón để phóng"
              : "Khoảng video thanh đang hiện. Ctrl + lăn chuột hoặc chụm hai ngón để phóng; “Vừa ván” đưa về khoảng tự chọn"
          }
        >
          {spanLabel(shown, duration)}
        </span>
        <button
          type="button"
          className="p-1.5 hover:bg-muted disabled:opacity-40"
          aria-label="Phóng to timeline"
          title="Xem khoảng ngắn hơn"
          disabled={shown <= spans[0]!}
          onClick={() => onSpan([...spans].reverse().find((value) => value < shown) ?? spans[0]!)}
        >
          <ZoomIn size={14} />
        </button>
      </span>
    </div>
  )
}

/** What a click, a drag or a gesture does on the track, or a notice in its place, and the key of the marks. */
export function TimelineHint({
  editing,
  focusedNumber,
  notice,
}: {
  editing: TimelineEditing | undefined
  focusedNumber: number | undefined
  notice: ReactNode
}) {
  const hint = !editing
    ? "Bấm vào thanh để tua · bấm một mốc để xem chi tiết"
    : editing.canCreate
      ? `Bấm để tua · bấm đúp vào một dải hoặc nút + để ghi tại đó · kéo mốc hoặc mép vùng cấm chọn của ván ${focusedNumber ?? ""} để đổi giây, video tua theo`
      : "Bấm để tua · kéo lượt hoặc mép vùng cấm chọn để đổi giây, video tua theo · vào trận rồi mới ghi được sự kiện"
  return (
    <div
      className="flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
      data-timeline-hint
    >
      {notice ?? (
        <>
          <span className="hidden items-center gap-1.5 @2xl:flex">
            <MousePointerClick size={13} aria-hidden="true" className="shrink-0" /> {hint}
          </span>
          {/* A narrow screen is a touch screen: fewer words, and the gestures that work there. */}
          <span className="flex items-center gap-1.5 @2xl:hidden">
            <MousePointerClick size={13} aria-hidden="true" className="shrink-0" />
            {editing ? "Chạm để tua · chụm để phóng · kéo mốc để đổi giây" : "Chạm để tua · chụm hai ngón để phóng"}
          </span>
        </>
      )}
      <span className="ml-auto hidden items-center gap-3 @2xl:flex" aria-hidden="true">
        <span className="flex items-center gap-1">
          <span className="esp-bt-key" data-key="turn" /> lượt cấm, chọn
        </span>
        <span className="flex items-center gap-1">
          <span className="esp-bt-key" data-key="lock">
            <Lock size={8} strokeWidth={2.6} />
          </span>
          chốt đội hình
        </span>
        <span className="flex items-center gap-1">
          <span className="esp-bt-key" data-key="flag">
            <Flag size={8} strokeWidth={2.6} />
          </span>
          vào trận
        </span>
        <span className="flex items-center gap-1">
          <span className="esp-bt-key" data-key="mark">
            <Shield size={8} strokeWidth={2.6} />
          </span>
          video hiện phù hiệu, ngọc, trang bị
        </span>
        <span className="flex items-center gap-1">
          <span className="esp-bt-key" data-key="pill" /> sự kiện
        </span>
      </span>
    </div>
  )
}
