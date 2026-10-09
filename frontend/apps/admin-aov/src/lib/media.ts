/** Mount point of the dev/preview middleware that serves `resources/Lien-Quan-v3` (see vite.config.ts). */
export const RESOURCES_BASE = "/__resources/"

/** Resolves a package-relative media path such as `assets/hero/head/airi-head.jpg`. */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:)?\/\//.test(path) || path.startsWith("/")) return path
  return RESOURCES_BASE + path.split("/").map(encodeURIComponent).join("/")
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1)
}
