export type WatchCommand =
  | "TOGGLE"
  | "BACK_10"
  | "ON_10"
  | "BACK_5"
  | "ON_5"
  | "STEP_BACK"
  | "STEP_ON"
  | "GAME_BACK"
  | "GAME_ON"
  | "SKIP"
  | "MUTE"
  | "SIZE"
  | "HELP"

const SIGNS: Record<string, WatchCommand> = {
  k: "TOGGLE",
  j: "BACK_10",
  l: "ON_10",
  "[": "STEP_BACK",
  "]": "STEP_ON",
  p: "GAME_BACK",
  n: "GAME_ON",
  s: "SKIP",
  m: "MUTE",
  t: "SIZE",
  "?": "HELP",
}
const BRACKETS: Record<string, string> = { BracketLeft: "[", BracketRight: "]" }

/** What still answers beside the small player, where a page of its own is being read. */
const ELSEWHERE: readonly WatchCommand[] = ["TOGGLE", "SKIP", "MUTE", "SIZE"]

/** The sign a key types, or on a keyboard of other letters the one that stands in its place. */
function signOf({ key, code }: { key: string; code: string }) {
  if (/^[!-~]$/.test(key)) return key.toLowerCase()
  return BRACKETS[code] ?? /^Key([A-Z])$/.exec(code)?.[1]?.toLowerCase()
}

/**
 * What a key asks of the video, or null where it is none of the video's: while something is typed, with a modifier,
 * or when it belongs to the control that has the focus.
 */
export function watchCommand(
  key: { key: string; code: string; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  on: {
    /** In a field, or with a dialog open. */
    typing: boolean
    /** On a button or a link, which Space presses. */
    control: boolean
    /** On a range, a tab or a radio, which the arrows move. */
    slider: boolean
    /** On the page of the match, with its room. */
    here: boolean
    /** In a room that has nothing beside the video: no place where the shortcuts could be read. */
    bare: boolean
  },
): WatchCommand | null {
  if (on.typing || key.ctrlKey || key.altKey || key.metaKey) return null
  if (key.code === "Space" || key.key === " ") return on.here && !on.control ? "TOGGLE" : null
  if (key.key === "ArrowLeft" || key.key === "ArrowRight") {
    if (!on.here || on.slider) return null
    return key.key === "ArrowLeft" ? "BACK_5" : "ON_5"
  }
  const command = SIGNS[signOf(key) ?? ""] ?? null
  if (command === "HELP" && on.bare) return null
  return command && (on.here || ELSEWHERE.includes(command)) ? command : null
}
