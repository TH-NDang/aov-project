import { useState } from "react"
import type { CommunityPost, PageCard, PageRole } from "@aov/community-contracts"
import { formatInZone, useUserTimeZone } from "@aov/ui/lib/time-zone"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { pinnedSummary } from "../model/post-form"
import { PostCard } from "./community-post"
import "./pinned-post.css"

/**
 * The pinned post at the head of a page's journal, folded to one line with its picture and headline, so the newest
 * posts stay on the first screen. Opened, it is the whole post in its place.
 */
export function PinnedPost({ post, role, page }: { post: CommunityPost; role: PageRole | ""; page?: PageCard }) {
  const { text, languageTag } = useStreamLocale()
  const zone = useUserTimeZone()
  const [open, setOpen] = useState(false)
  if (open) return <PostCard post={post} role={role} page={page} journal />
  const { picture, headline } = pinnedSummary(post)
  return (
    <article className="ps-post">
      <header className="ps-margin">
        <span className="ps-pinned">
          <StreamIcon name="pin" size={14} />
          {text("Đã ghim", "Pinned")}
        </span>
      </header>
      <div className="ps-main">
        <button type="button" className="ps-pin-row" aria-expanded={false} onClick={() => setOpen(true)}>
          {picture ? (
            <img src={picture} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="ps-pin-mark" aria-hidden="true">
              <StreamIcon name="pin" size={20} />
            </span>
          )}
          <span className="ps-pin-words">
            <strong>{headline}</strong>
            <small>
              {formatInZone(post.createdAt, zone, { day: "numeric", month: "numeric", year: "numeric" }, languageTag)}
              {" · "}
              {text("Xem bài", "Read the post")}
            </small>
          </span>
          <StreamIcon name="chevronDown" size={18} />
        </button>
      </div>
    </article>
  )
}
