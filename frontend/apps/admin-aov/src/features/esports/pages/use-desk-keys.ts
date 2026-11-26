import { useEffect, useEffectEvent } from "react"
import type { ObjectiveKind, Side } from "@aov/community-contracts"
import { useHotkeys } from "@/app/hotkeys"
import { handedToDesk } from "../components/series/handed-keys"
import { belongsToControl, watchFocusOrigin } from "../components/series/key-owner"
import { knownEnd } from "../model/series-vod"
import type { TimelineEvent, TimelineKind } from "../model/timeline"
import type { GameDesk } from "./game-desk"
import type { Studio } from "./match-studio"
import { deleteMoment, moveMoment, recordObjective } from "./tools/moment-actions"
import { newMomentRefusal } from "./tools/new-moment"

/** What the keys of the desk do; a handler that is absent leaves its key to the browser. */
type DeskKeys = {
  play: () => void
  /** Goes a number of seconds back or forward in the video. */
  jump: (seconds: number) => void
  /** The start or the last second of the game on screen. */
  edge: (edge: "start" | "end") => void
  /** The mark before or after the playhead. */
  mark: (direction: 1 | -1) => void
  /** The game before or after the one on screen. */
  game: (direction: 1 | -1) => void
  mute: () => void
  fullscreen?: () => void
  help: () => void
  /** Closes the innermost thing that is open; `depth` is what was open when the key went down. */
  close: (depth: "form" | "panel" | "selection") => void
  next?: () => void
  objective?: (side: Side, objective: ObjectiveKind) => void
  form?: (kind?: TimelineKind) => void
  /** Moves the selected moment a number of seconds. */
  nudge?: (seconds: number) => void
  remove?: () => void
  undo?: () => void
}

const OBJECTIVE_KEYS: Record<string, [Side, ObjectiveKind]> = {
  "1": ["BLUE", "TURRET"],
  "2": ["BLUE", "ABYSSAL_DRAGON"],
  "3": ["BLUE", "DARK_SLAYER"],
  "7": ["RED", "TURRET"],
  "8": ["RED", "ABYSSAL_DRAGON"],
  "9": ["RED", "DARK_SLAYER"],
}
const FORM_KEYS: Record<string, TimelineKind | undefined> = {
  e: undefined,
  k: "KILL",
  o: "OBJECTIVE",
  i: "ITEM",
  n: "NOTE",
}

/** The keys that may be held down; every other key does one thing a press. */
const HELD = new Set(["arrowleft", "arrowright", ",", ".", "j", "l", "[", "]"])

/**
 * The field a typed letter belongs to though the focus is elsewhere: the search of the draft, which keeps the focus
 * against every press but one on a mark of the track, so that Alt and the arrows still move that mark.
 */
function letterField(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || !/\p{L}/u.test(event.key)) return null
  return document.querySelector<HTMLElement>("[data-keeps-focus]")
}

/** The change of a key press, or nothing when the key is not one of the desk. */
function actionOf(event: KeyboardEvent, keys: DeskKeys): (() => void) | undefined {
  const key = event.key.toLowerCase()
  const command = event.ctrlKey || event.metaKey
  if (command) return key === "z" && !event.altKey && !event.shiftKey ? keys.undo : undefined
  if (event.altKey) {
    const seconds = event.shiftKey ? 5 : 1
    const { nudge } = keys
    if (!nudge || (key !== "arrowleft" && key !== "arrowright")) return undefined
    return () => nudge(key === "arrowleft" ? -seconds : seconds)
  }
  switch (key) {
    case " ":
      return keys.play
    case "arrowleft":
      return () => keys.jump(event.shiftKey ? -1 : -5)
    case "arrowright":
      return () => keys.jump(event.shiftKey ? 1 : 5)
    case ",":
      return () => keys.jump(-1)
    case ".":
      return () => keys.jump(1)
    case "j":
      return () => keys.jump(event.shiftKey ? -30 : -10)
    case "l":
      return () => keys.jump(event.shiftKey ? 30 : 10)
    case "home":
      return () => keys.edge("start")
    case "end":
      return () => keys.edge("end")
    case "[":
      return () => keys.mark(-1)
    case "]":
      return () => keys.mark(1)
    case "pageup":
      return () => keys.game(-1)
    case "pagedown":
      return () => keys.game(1)
    case "?":
      return keys.help
  }
  // Shift + N and Shift + P belong to the match switcher.
  if (event.shiftKey) return key === "/" ? keys.help : undefined
  switch (key) {
    case "m":
      return keys.mute
    case "f":
      return keys.fullscreen
    case "g":
      return keys.next
    case "delete":
      return keys.remove
  }
  const { objective, form } = keys
  const pad = OBJECTIVE_KEYS[key]
  if (pad) return objective && (() => objective(...pad))
  return form && key in FORM_KEYS ? () => form(FORM_KEYS[key]) : undefined
}

/**
 * Keys of the recording screen, off with the Admin switch for shortcuts and on a phone, where the page itself scrolls
 * with them. A key that belongs to what has the focus stays there; Esc closes the innermost thing that is open always.
 */
function useDeskKeys({
  active,
  open,
  keys,
}: {
  /** False on a compact screen. */
  active: boolean
  open: "form" | "panel" | "selection" | null
  keys: DeskKeys
}) {
  const { enabled } = useHotkeys()
  const run = useEffectEvent((event: KeyboardEvent, depth: typeof open, reachedByKeyboard: boolean) => {
    const handed = handedToDesk(event)
    if (event.isComposing || (!handed && (event.defaultPrevented || belongsToControl(event, reachedByKeyboard)))) return
    // A question on screen is answered first.
    if (document.querySelector('[role="alertdialog"]')) return
    // The letter is a name being typed: with the focus moved before the key is done, the browser types it there. A
    // control the keyboard went to keeps the keys of the desk.
    const nowhere = !document.activeElement || document.activeElement === document.body
    const field = reachedByKeyboard && !nowhere ? null : letterField(event)
    field?.focus({ preventScroll: true })
    if (field && document.activeElement === field) return
    if (event.key === "Escape") {
      if (!depth) return
      event.preventDefault()
      keys.close(depth)
      return
    }
    if (!enabled || !active) return
    const action = actionOf(event, keys)
    if (!action) return
    event.preventDefault()
    // Alt and an arrow write the moment again at every repeat of a held key; once a press is enough.
    if (!event.repeat || (HELD.has(event.key.toLowerCase()) && !event.altKey)) action()
  })
  const depthNow = useEffectEvent(() => open)

  useEffect(() => {
    const origin = watchFocusOrigin()
    // What is open is read before the key reaches the page: a form that closes itself on Esc must not take the panel
    // or the selection behind it along.
    let depth: typeof open = null
    const onCapture = () => {
      depth = depthNow()
    }
    const onKey = (event: KeyboardEvent) => run(event, depth, origin.reachedByKeyboard())
    window.addEventListener("keydown", onCapture, true)
    window.addEventListener("keydown", onKey)
    return () => {
      origin.stop()
      window.removeEventListener("keydown", onCapture, true)
      window.removeEventListener("keydown", onKey)
    }
  }, [])
}

/** The keys of the recording screen, as far as what is on the desk has a use for them. */
export function useStudioKeys(studio: Studio) {
  const { recording, settings, editable, panel, form, activeId } = studio
  const { chapters, focused, playhead, seek } = recording
  const order = [...chapters].sort((a, b) => a.number - b.number)
  // What a key records belongs to a tool in sight, not to a form or a panel over it.
  const records = editable && !!focused && !panel && !form
  const selected = records ? focused.events.find((event) => event.id === activeId) : undefined
  const onSelected = (act: (desk: GameDesk, event: TimelineEvent) => void) => {
    if (studio.desk.current && selected) act(studio.desk.current, selected)
  }
  useDeskKeys({
    active: !studio.compact,
    open: form ? "form" : panel ? "panel" : activeId ? "selection" : null,
    keys: {
      play: recording.toggle,
      jump: (seconds) => seek(playhead.get() + seconds),
      edge: (edge) => {
        if (focused?.synced) seek(edge === "start" ? focused.from : knownEnd(focused))
      },
      mark: studio.step,
      game: (direction) => {
        const at = order.findIndex((chapter) => chapter.gameId === focused?.gameId)
        const next = at < 0 ? undefined : order[at + direction]
        if (next) studio.chooseGame(next.gameId)
      },
      mute: () => settings.setSound({ ...settings.sound, muted: !settings.sound.muted }),
      fullscreen: studio.onFullscreen ?? undefined,
      help: () => studio.openPanel(panel === "match" ? null : "match"),
      close: (depth) => {
        if (depth === "form") studio.onForm(null)
        else if (depth === "panel") studio.openPanel(null)
        else studio.onActive(null)
      },
      next: editable ? () => studio.foot.current?.next() : undefined,
      undo: editable ? () => studio.foot.current?.undo() : undefined,
      objective: records
        ? (side, objective) => {
            if (studio.desk.current) recordObjective(studio.desk.current, side, objective)
          }
        : undefined,
      form: records
        ? (kind) => {
            const desk = studio.desk.current
            const refusal = desk && newMomentRefusal(desk)
            if (desk && refusal) desk.say(refusal)
            else studio.onForm({ kind })
          }
        : undefined,
      nudge: selected
        ? (seconds) => onSelected((desk, event) => moveMoment(desk, event, event.at + seconds))
        : undefined,
      remove: selected ? () => onSelected(deleteMoment) : undefined,
    },
  })
}
