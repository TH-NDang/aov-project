export const MEDIA_TABS = ["portrait", "head", "cover", "badges"] as const
export type MediaTab = (typeof MEDIA_TABS)[number]

export function readMediaTab(search: URLSearchParams): MediaTab {
  const tab = search.get("tab")
  return MEDIA_TABS.find((value) => value === tab) ?? "portrait"
}

/** Keep shared filters while changing the media view inside one page session. */
export function mediaTabLocation(search: URLSearchParams, tab: MediaTab) {
  const next = new URLSearchParams(search)
  if (tab === "portrait") next.delete("tab")
  else next.set("tab", tab)
  return `/hero/media${next.size ? `?${next}` : ""}`
}
