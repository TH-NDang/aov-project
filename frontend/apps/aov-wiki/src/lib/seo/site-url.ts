// Imports nothing, so the prerender job can read its address even when the renderer cannot load (ADR-022, addendum of
// 19/11/2026).

/** Accepts only an http(s) origin, because every canonical and preview URL is built by appending a root path to it. */
export function parseSiteUrl(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const isOrigin = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
    return isOrigin && (url.protocol === "https:" || url.protocol === "http:") ? url.origin : null
  } catch {
    return null
  }
}
