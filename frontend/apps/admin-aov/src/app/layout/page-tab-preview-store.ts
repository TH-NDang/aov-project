export function createPageTabPreviewStore() {
  const images = new Map<string, string>()
  const listeners = new Set<() => void>()
  return {
    get: (path: string) => images.get(path),
    set(path: string, image: string) {
      images.set(path, image)
      listeners.forEach((listener) => listener())
    },
    retain(paths: string[]) {
      const retained = new Set(paths)
      for (const path of images.keys()) {
        if (!retained.has(path)) images.delete(path)
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type PageTabPreviewStore = ReturnType<typeof createPageTabPreviewStore>
