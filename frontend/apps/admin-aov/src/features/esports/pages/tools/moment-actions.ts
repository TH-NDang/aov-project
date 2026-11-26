import type { GameContent, ObjectiveKind, Side } from "@aov/community-contracts"
import { formatClock } from "@/lib/clock"
import type { Playhead } from "../../model/playhead"
import { momentName, outsideRefusal, pressedSecond, replaceMoment } from "../../model/quick-moment"
import { newEventId, type TimelineEvent } from "../../model/timeline"
import { moveEvent, readTimeline } from "../../model/timeline-io"
import type { GameDesk } from "../game-desk"

/** A key pressed twice this fast was pressed once: a finger bounces, a held key repeats. */
const ONE_PRESS_MS = 800

/** The last press of each key, for as long as the match is on screen. */
const presses = new WeakMap<Playhead, Map<string, number>>()

/** The video second a press records at, or the game's own when the video can not be read. */
const videoSecond = (desk: GameDesk) => desk.markNow() ?? desk.playhead.get()

/** Why no moment can be recorded where the video is; null when one can. */
export function momentRefusal(desk: GameDesk): string | null {
  if (!desk.videoId) return `Ván ${desk.view.number} không có video: ghi ở “Diễn biến khác”.`
  return outsideRefusal(desk.chapter, videoSecond(desk))
}

/** Records one objective of a team at the second on screen. */
export function recordObjective(desk: GameDesk, side: Side, objective: ObjectiveKind): void {
  const refusal = momentRefusal(desk)
  if (refusal) return desk.say(refusal)

  const pressed = presses.get(desk.playhead) ?? new Map<string, number>()
  presses.set(desk.playhead, pressed)
  const key = `${desk.entry.id}:${side}:${objective}`
  const now = Date.now()
  if (now - (pressed.get(key) ?? -Infinity) < ONE_PRESS_MS) return
  pressed.set(key, now)

  const at = pressedSecond(desk.chapter, videoSecond(desk))
  const event: TimelineEvent = { id: newEventId(), kind: "OBJECTIVE", at, side, objective }
  desk.onActive(event.id)
  void desk.record({
    text: `Đã ghi ${momentName(event, desk.view)} lúc ${formatClock(at)}`,
    apply: (content) => replaceMoment(content, null, event),
    revert: (content) => replaceMoment(content, event, null),
  })
}

export function deleteMoment(desk: GameDesk, event: TimelineEvent): void {
  if (desk.activeId === event.id) desk.onActive(null)
  void desk.record({
    text: `Đã xóa ${momentName(event, desk.view)} lúc ${formatClock(event.at)}`,
    apply: (content) => replaceMoment(content, event, null),
    revert: (content) => replaceMoment(content, null, event),
  })
}

/**
 * Moves a moment along the game clock; an item is moved in its form, where what the slots held is in sight. It is a step
 * from where the moment then is, so several presses add up before the first of them is saved.
 */
export function moveMoment(desk: GameDesk, event: TimelineEvent, gameSecond: number): void {
  if (event.kind === "ITEM") return desk.say("Giờ của trang bị đổi ở “Sửa”.")
  const before = Math.round(event.at)
  const last = desk.entry.content.durationSeconds ?? Infinity
  const after = Math.max(0, Math.min(last, Math.round(gameSecond)))
  if (after === before) return
  const step = (seconds: number) => (content: GameContent) => {
    const at = readTimeline(content).find((candidate) => candidate.id === event.id)?.at
    if (at === undefined) return content
    return moveEvent(content, event.id, Math.max(0, Math.min(last, Math.round(at) + seconds))) ?? content
  }
  void desk.record({
    text: `Đã dời ${momentName(event, desk.view)}: ${formatClock(before)} → ${formatClock(after)}`,
    apply: step(after - before),
    revert: step(before - after),
  })
}

/**
 * Saves what the form holds and closes it. A refused save brings the form back with what was typed, on the game it was
 * typed for. What it replaces is read from the game: a moment whose save was refused before is still a new one, and an
 * edit refused before still takes the stored moment back on undo.
 */
export function saveMoment(desk: GameDesk, event: TimelineEvent, editing: TimelineEvent | null): void {
  const stored = editing
    ? (readTimeline(desk.entry.content).find((candidate) => candidate.id === editing.id) ?? null)
    : null
  desk.onForm(null)
  desk.onActive(event.id)
  const name = momentName(event, desk.view)
  void desk
    .record({
      text: `${stored ? "Đã sửa" : "Đã ghi"} ${name} lúc ${formatClock(event.at)}`,
      apply: (content) => replaceMoment(content, stored, event),
      revert: (content) => replaceMoment(content, event, stored),
    })
    .then((saved) => {
      if (!saved) desk.onForm(stored ? { editing: stored, refused: event } : { refused: event })
    })
}
