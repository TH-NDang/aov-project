/**
 * A media address the browser can load as it is: an absolute URL or a path on this origin. Relative paths of the old
 * `resources/` data set have no server any more (ADR-030), so they give no address and the caller shows its fallback.
 */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return /^(https?:)?\/\//.test(path) || path.startsWith("/") ? path : undefined
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1)
}
