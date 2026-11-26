import { useRef, type FocusEvent, type KeyboardEvent } from "react"
import { handToDesk } from "./handed-keys"

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"])

/**
 * A list of the desk opened with the mouse lets go of the keys once it is closed again: a letter or a digit would pick
 * an option by its name, silently, and Space would open it again instead of playing. Reached with the keyboard it keeps
 * every key. `byMouse` tells whether the list is in the hands of the mouse, so that a choice can give the keys back.
 */
export function useMouseList() {
  const pressed = useRef(false)
  return {
    byMouse: () => pressed.current,
    handlers: {
      onPointerDown: () => {
        pressed.current = true
      },
      // An open list moves the focus to its own options; only a focus that leaves the list ends the press.
      onBlur: (event: FocusEvent<HTMLSelectElement>) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)))
          pressed.current = false
      },
      onKeyDown: (event: KeyboardEvent<HTMLSelectElement>) => {
        // While the list is open its options have the keys; closed, the list gives them back.
        const closed = event.target === event.currentTarget
        if (!pressed.current || !closed || event.key === "Tab" || MODIFIER_KEYS.has(event.key)) return
        handToDesk(event.nativeEvent)
        event.currentTarget.blur()
      },
    },
  }
}
