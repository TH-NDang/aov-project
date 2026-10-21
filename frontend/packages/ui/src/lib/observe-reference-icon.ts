type Watcher = {
  observer: IntersectionObserver
  callbacks: Map<Element, () => void>
}
const watchers = new WeakMap<Element, Watcher>()

/** Share one observer per suggestion list; metadata is requested only near its visible rows. */
export function observeReferenceIcon(element: Element, visible: () => void) {
  const root = element.closest('[role="listbox"], [data-reference-icon-scroll]')
  if (!root || typeof IntersectionObserver === "undefined") {
    visible()
    return () => {}
  }
  let watcher = watchers.get(root)
  if (!watcher) {
    const callbacks = new Map<Element, () => void>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) callbacks.get(entry.target)?.()
      },
      { root, rootMargin: "64px 0px" },
    )
    watcher = { observer, callbacks }
    watchers.set(root, watcher)
  }
  watcher.callbacks.set(element, visible)
  watcher.observer.observe(element)
  return () => {
    watcher.callbacks.delete(element)
    watcher.observer.unobserve(element)
    if (!watcher.callbacks.size) {
      watcher.observer.disconnect()
      watchers.delete(root)
    }
  }
}
