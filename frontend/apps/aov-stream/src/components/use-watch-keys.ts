import { useEffect, useEffectEvent } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import type { VideoForm } from "../lib/video-form"
import { watchCommand, type WatchCommand } from "../lib/watch-keys"
import { useWatch } from "./use-watch"
import { useWayBack } from "./video-mini"
import { placeNow } from "./video-place"
import { watch } from "./watch-session"

/** Where a key is typed, or belongs to what is open over the page. */
const FIELDS =
  'input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"]), textarea, select,' +
  ' [contenteditable=""], [contenteditable="true"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"],' +
  ' [role="listbox"]'
/** What Space presses. */
const CONTROLS =
  'a[href], button, summary, input:not([type="range"]), [role="button"], [role="tab"], [role="radio"],' +
  ' [role="checkbox"], [role="switch"]'
/** What the arrows move. */
const MOVED =
  'input[type="range"], input[type="radio"], [role="slider"], [role="tab"], [role="radio"], [role="tablist"],' +
  ' [role="radiogroup"]'

/** The commands a key that is held down goes on giving. */
const HELD: readonly WatchCommand[] = ["BACK_10", "ON_10", "BACK_5", "ON_5"]

/** The shortcuts of the video where it is seen: in the room of its match, and beside its small player. */
export function useWatchKeys(form: VideoForm) {
  const wide = usePageLayout() === "wide"
  const wanted = useWatch((view) => view.keys)
  const on = wanted && form !== "none"
  const back = useWayBack()

  const run: Record<WatchCommand, () => void> = {
    TOGGLE: () => watch.toggle(),
    BACK_10: () => watch.seekBy(-10),
    ON_10: () => watch.seekBy(10),
    BACK_5: () => watch.seekBy(-5),
    ON_5: () => watch.seekBy(5),
    STEP_BACK: () => watch.step(-1),
    STEP_ON: () => watch.step(1),
    GAME_BACK: () => watch.game(-1),
    GAME_ON: () => watch.game(1),
    SKIP: () => watch.skip(),
    MUTE: () => watch.mute(),
    SIZE: () => (form === "mini" ? back() : watch.shrink()),
    HELP: () => watch.show("KEYS"),
  }
  const press = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return
    const at = event.target instanceof Element ? event.target : document.body
    const { match } = watch.view()
    const place = placeNow()
    const command = watchCommand(event, {
      typing: !!at.closest(FIELDS),
      control: !!at.closest(CONTROLS),
      slider: !!at.closest(MOVED),
      here: place?.seriesId === match?.seriesId,
      bare: place?.room.dataset.shape === "bare",
    })
    // A narrow window has no small player, so there is nothing to change the size to.
    if (!command || (command === "SIZE" && !wide)) return
    event.preventDefault()
    if (!event.repeat || HELD.includes(command)) run[command]()
  })
  useEffect(() => {
    if (!on) return
    document.addEventListener("keydown", press)
    return () => document.removeEventListener("keydown", press)
  }, [on])
}
