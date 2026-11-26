/** Fields a person types or chooses in; a slider, a tick and a button drawn as an input are controls, not fields. */
const FIELDS = [
  "textarea",
  "select",
  "[contenteditable=true]",
  "input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit])",
].join(", ")

/** True while a key belongs to a field being typed in, so page shortcuts stay out of the way. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (!!target.closest(FIELDS) || target.isContentEditable)

/** Parts of the page that take every key while the focus is inside them. */
export const OWN_KEYS = "[role=menu], [role=listbox], [role=dialog], [role=alertdialog]"

const CONTROLS = [
  "a[href]",
  "button",
  "input",
  "summary",
  "[role=button]",
  "[role=slider]",
  "[role=tab]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ")

/** Keys a button, a slider or a tab works with once the keyboard reached it. */
const CONTROL_KEYS = new Set([
  " ",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])

/** Keys that keep driving the video from a field with nothing in it. */
const VIDEO_KEYS = new Set([" ", "ArrowLeft", "ArrowRight", ",", "."])

/** The search field of the ban/pick tool: the video and the undo stay in reach while heroes are typed there. */
const HERO_SEARCH = "[data-hero-search]"

type Key = Pick<KeyboardEvent, "key" | "target" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">

/** Whether a field leaves this key to the desk; only fields of the dock do. */
function leftByField(event: Key, target: HTMLElement) {
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement>("input, textarea")
  if (!field?.closest(".esp-body")) return false
  // Nothing in a field needs Esc, so it closes what the field stands in.
  if (event.key === "Escape") return true
  const search = field.matches(HERO_SEARCH)
  if (!field.value) {
    const command = (event.ctrlKey || event.metaKey) && !event.altKey
    return command ? search && event.key.toLowerCase() === "z" : VIDEO_KEYS.has(event.key)
  }
  // Matching ignores spaces; Shift + Space types one for a name written by hand.
  return search && event.key === " " && !event.shiftKey
}

/**
 * Whether a key belongs to what has the focus: a menu, a list or a dialog, a field, or a control the keyboard reached.
 * A control the mouse pressed keeps the focus but not the keys, so Space still plays the video after a click.
 */
export function belongsToControl(event: Key, reachedByKeyboard: boolean): boolean {
  const { target } = event
  if (!(target instanceof HTMLElement)) return false
  if (target.closest(OWN_KEYS)) return true
  if (isTyping(target)) return !leftByField(event, target)
  return reachedByKeyboard && CONTROL_KEYS.has(event.key) && !!target.closest(CONTROLS)
}

/** Remembers whether what has the focus was reached with the keyboard or pressed with a pointer. */
export function watchFocusOrigin() {
  let byKeyboard = true
  let origin = true
  const onPointer = (event: Event) => {
    byKeyboard = false
    // Pressing what already has the focus moves no focus, but takes the keys back.
    if (event.target instanceof Node && document.activeElement?.contains(event.target)) origin = false
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Tab") byKeyboard = true
  }
  const onFocus = () => {
    origin = byKeyboard
  }
  window.addEventListener("pointerdown", onPointer, true)
  window.addEventListener("keydown", onKey, true)
  window.addEventListener("focusin", onFocus, true)
  return {
    reachedByKeyboard: () => origin,
    stop: () => {
      window.removeEventListener("pointerdown", onPointer, true)
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("focusin", onFocus, true)
    },
  }
}
