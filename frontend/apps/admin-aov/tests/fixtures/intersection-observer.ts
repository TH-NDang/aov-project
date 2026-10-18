export function intersectionHarness() {
  const observers = new Set<MockObserver>()
  class MockObserver {
    readonly targets = new Set<Element>()
    constructor(
      readonly callback: IntersectionObserverCallback,
      readonly options: IntersectionObserverInit = {},
    ) {
      observers.add(this)
    }
    observe(target: Element) {
      this.targets.add(target)
    }
    unobserve(target: Element) {
      this.targets.delete(target)
    }
    disconnect() {
      this.targets.clear()
      observers.delete(this)
    }
  }
  return {
    Observer: MockObserver,
    root: (target: Element) => [...observers].find((observer) => observer.targets.has(target))?.options.root,
    observing: (target: Element) => [...observers].some((observer) => observer.targets.has(target)),
    intersect(target: Element, isIntersecting = true) {
      for (const observer of [...observers]) {
        if (observer.targets.has(target))
          observer.callback(
            [{ target, isIntersecting } as IntersectionObserverEntry],
            observer as unknown as IntersectionObserver,
          )
      }
    },
  }
}
