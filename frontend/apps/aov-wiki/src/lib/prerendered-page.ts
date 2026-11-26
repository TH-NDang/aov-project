/**
 * What the static page the server sent says about itself (static-pages.ts), read once before the app replaces it.
 * A hero page names its hero, so the page can ask for the hero's details while the hero list still loads.
 */
let captured: { path: string; heroId?: string } | undefined

export function capturePrerenderedPage() {
  const element = document.querySelector<HTMLElement>("[data-prerendered]")
  captured = { path: window.location.pathname, heroId: element?.dataset.heroId || undefined }
}

/** The hero the static page at `path` was written for, while the reader is still on the page it was served for. */
export function prerenderedHeroId(path: string) {
  return captured?.path === path ? captured.heroId : undefined
}
