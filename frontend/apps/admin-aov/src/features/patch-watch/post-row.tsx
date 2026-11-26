import { Check, ExternalLink, RotateCcw, X } from "lucide-react"
import type { ComponentType } from "react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import type { PatchNotePost } from "./patch-watch-api"
import {
  CHANNEL_LABELS,
  nextStates,
  postTitle,
  REGION_CODES,
  REGION_LABELS,
  SOURCE_NAMES,
  STATE_LABELS,
  type PatchNotePostState,
} from "./patch-watch-model"
import "./post-row.css"

const DAY: Intl.DateTimeFormatOptions = { dateStyle: "short" }

const MOVES: Record<PatchNotePostState, { label: string; icon: ComponentType<{ className?: string }> }> = {
  DONE: { label: "Xong", icon: Check },
  DISMISSED: { label: "Bỏ qua", icon: X },
  NEW: { label: "Đưa về Mới", icon: RotateCcw },
  EARLIER: { label: STATE_LABELS.EARLIER, icon: RotateCcw },
}

/** One post found on a publisher's page, opened in a new tab and moved along once it has been handled. */
export function PostRow({
  post,
  canWrite,
  busy,
  onMove,
}: {
  post: PatchNotePost
  canWrite: boolean
  busy: boolean
  onMove: (state: PatchNotePostState) => void
}) {
  const title = postTitle(post)
  return (
    <li className="pw-post" data-channel={post.channel.toLowerCase()} data-state={post.state.toLowerCase()}>
      <div className="pw-post-stamp" title={`${REGION_LABELS[post.region]} · ${CHANNEL_LABELS[post.channel]}`}>
        <span className="pw-post-region">{REGION_CODES[post.region]}</span>
        <span className="pw-post-channel">{CHANNEL_LABELS[post.channel]}</span>
      </div>
      <div className="min-w-0">
        <a href={post.url} target="_blank" rel="noreferrer" className="pw-post-title type-body" title={title}>
          {title}
        </a>
        <p className="type-meta mt-0.5 flex flex-wrap items-center gap-x-1.5">
          <span>{SOURCE_NAMES[post.source]}</span>
          <span aria-hidden>·</span>
          {post.publishedAt ? (
            <LocalTime value={post.publishedAt} format={DAY} />
          ) : (
            <span>
              Thấy <LocalTime value={post.firstSeenAt} format={DAY} />
            </span>
          )}
          {post.state !== "NEW" && (
            <Badge variant="outline" className="ml-1">
              {STATE_LABELS[post.state]}
            </Badge>
          )}
        </p>
      </div>
      <div className="pw-post-actions">
        <Button asChild size="sm" variant="outline">
          <a href={post.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Mở bài
          </a>
        </Button>
        {canWrite &&
          nextStates(post.state).map((state) => {
            const move = MOVES[state]
            return (
              <Button
                key={state}
                type="button"
                size="sm"
                variant={state === "DONE" ? "default" : "ghost"}
                disabled={busy}
                onClick={() => onMove(state)}
              >
                <move.icon className="size-4" /> {move.label}
              </Button>
            )
          })}
      </div>
    </li>
  )
}
