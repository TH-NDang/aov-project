import type { FocusEvent } from "react"

/**
 * Whether the focus went to a link in the folded part of a text, below its last visible line. Nobody sees a link there,
 * and the browser scrolls the fold to it; the text unfolds instead.
 */
export function focusesFoldedLink({ currentTarget, target }: FocusEvent<HTMLElement>) {
  return target instanceof HTMLElement && target.offsetTop - currentTarget.offsetTop >= currentTarget.clientHeight
}
