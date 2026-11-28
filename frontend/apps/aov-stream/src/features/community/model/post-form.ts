import type { CommunityPost } from "@aov/community-contracts"
import { dayKeyInZone } from "@aov/ui/lib/time-zone"
import { firstLine } from "../../../lib/reference-model.ts"
import { videoEmbed, videoPoster } from "./post-media-model.ts"

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

/**
 * What a folded pinned post shows: its first picture, or its video's, and its headline, or the first line of its words
 * without the markup of names.
 */
export function pinnedSummary(post: Pick<CommunityPost, "title" | "body" | "videoUrl" | "imageUrls">) {
  const embed = post.videoUrl ? videoEmbed(post.videoUrl) : null
  return {
    picture: post.imageUrls?.[0] ?? (embed ? videoPoster(embed, "mqdefault") : null),
    headline: post.title?.trim() || firstLine(post.body) || "",
  }
}

/** A post saved again as it is, with its words as `words` say, to be posted or kept as a draft. */
export function postChange(
  post: Pick<CommunityPost, "version" | "kind" | "title" | "body" | "videoUrl" | "imageUrls" | "asPage">,
  publish: boolean,
  words: { title?: string | null; body?: string } = {},
) {
  return {
    version: post.version,
    kind: post.kind,
    title: words.title ?? post.title,
    body: words.body ?? post.body,
    videoUrl: post.videoUrl,
    imageUrls: post.imageUrls,
    asPage: post.asPage,
    publish,
  }
}
