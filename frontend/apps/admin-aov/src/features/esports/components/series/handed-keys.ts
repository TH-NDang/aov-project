const handed = new WeakSet<Event>()

/**
 * A control that has the focus but should not keep a key gives it to the desk: what the control itself would do with
 * the key is cancelled, and the keys of the desk still read it, though it went down on the control.
 */
export function handToDesk(event: KeyboardEvent) {
  handed.add(event)
  event.preventDefault()
}

export const handedToDesk = (event: Event) => handed.has(event)
