import { createApiRequest } from "./api-client"
import { watchOnYouTube } from "./music-links"

/** What YouTube tells any site about a video it lets others play. */
export type VideoFacts = { title: string; author_name: string }

/**
 * YouTube's oEmbed answer, read for a link the reader pastes: it names the video and says whether YouTube lets other
 * sites play it (401 when the owner does not, 400 or 404 when there is no such video).
 */
const youtube = createApiRequest({
  root: "https://www.youtube.com",
  token: () => null,
  describe: (status) => `YouTube answered ${status}`,
})

export const musicApi = {
  facts: (video: string, signal?: AbortSignal) =>
    youtube<VideoFacts>(`/oembed?format=json&url=${encodeURIComponent(watchOnYouTube(video))}`, { signal }),
}
