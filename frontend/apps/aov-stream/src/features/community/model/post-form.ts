import type { CommunityPost } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"

/**
 * How a post is laid out. What it carries decides: news stands on the page's own stage, a video and pictures come
 * before their words, and a short message with nothing else is set large.
 */
export type PostForm = "news" | "video" | "photo" | "statement" | "text"

/** A message up to this long, on one line of thought, reads as a statement. */
const STATEMENT = 140

export function postForm(post: Pick<CommunityPost, "kind" | "body" | "videoUrl" | "imageUrls">): PostForm {
  if (post.kind === "NEWS") return "news"
  if (post.videoUrl) return "video"
  if (post.imageUrls?.length) return "photo"
  const body = post.body.trim()
  return body && body.length <= STATEMENT && !body.includes("\n") ? "statement" : "text"
}

/** Whether a post's words fold behind "Show more". */
export const foldsBody = (body: string) => body.length > 420 || body.split("\n").length > 7

/**
 * The posts of one page that open a day of its journal: the first of each day in the reader's zone, and the one after
 * a pinned post, which stands first whatever its day.
 */
export function dayOpenings(posts: Pick<CommunityPost, "id" | "createdAt" | "pinned">[], timeZone: string) {
  const openings = new Set<string>()
  posts.forEach((post, at) => {
    const before = posts[at - 1]
    if (!before || before.pinned || dayKeyInZone(before.createdAt, timeZone) !== dayKeyInZone(post.createdAt, timeZone))
      openings.add(post.id)
  })
  return openings
}
