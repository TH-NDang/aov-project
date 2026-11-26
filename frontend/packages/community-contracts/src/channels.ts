/**
 * The YouTube channel behind one of a page's links (03, ADR-034). Name, handle, pictures and counts come from the
 * YouTube Data API and are absent without it; `more` says whether older uploads can be asked for.
 */
export type YouTubeChannel = {
  id: string
  title: string
  handle: string | null
  description: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
  url: string
  videos: YouTubeVideo[]
  more: boolean
}
/** A stream that is on, or one announced for later. */
export type YouTubeBroadcast = "LIVE" | "UPCOMING"
/** Length, views and broadcast come from the Data API; `shortForm` only from the channel's feed. */
export type YouTubeVideo = {
  id: string
  title: string
  publishedAt: string
  durationSeconds: number | null
  viewCount: number | null
  broadcast: YouTubeBroadcast | null
  shortForm: boolean
}
/** Older uploads, newest first; `nextPageToken` asks for the ones after them. */
export type YouTubeVideoPage = { videos: YouTubeVideo[]; nextPageToken: string | null }
