import { useState } from "react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { confirmAction } from "@/components/confirm-dialog"
import { Segmented } from "@/components/segmented"
import { youtubeVideoId } from "../../model/vod"
import "./game-tool.css"

export type VideoScope = "match" | "game"

const SCOPES = [
  ["match", "Cho cả trận"],
  ["game", "Chỉ ván này"],
] as const

/** The broadcast the game points to, and whether the other games of the match point to it too. */
export function GameVideoRow({
  url,
  shared,
  open,
  onOpen,
  onVideo,
}: {
  url: string
  /** Null while the other games are not known. */
  shared: boolean | null
  open: boolean
  onOpen: (open: boolean) => void
  onVideo: (url: string, scope: VideoScope) => void
}) {
  const id = youtubeVideoId(url)
  const of = shared === null ? "" : shared ? ", cả trận dùng" : ", chỉ ván này"
  return (
    <div className="esp-gt-row" role="group" aria-label="Video">
      <span>Video</span>
      <span className="esp-gt-value">
        {id ? `${id}${of}` : <span className="esp-gt-none">{url ? url : "Chưa có video"}</span>}
      </span>
      <span className="esp-gt-acts">
        {!open && (
          <Button type="button" size="xs" variant="secondary" onClick={() => onOpen(true)}>
            {url ? "Đổi" : "Gắn"}
          </Button>
        )}
      </span>
      {open && (
        <VideoForm
          url={url}
          shared={shared}
          onCancel={() => onOpen(false)}
          onSave={(link, scope) => {
            onOpen(false)
            onVideo(link, scope)
          }}
        />
      )}
    </div>
  )
}

/**
 * Asks before links are thrown away: an empty one, or one written over the videos of other games. A link of the whole
 * match has no way back, so the video it replaces is named while it can still be kept.
 */
function linkQuestion(typed: string, url: string, scope: VideoScope, shared: boolean | null) {
  if (!typed)
    return confirmAction({
      title: scope === "match" ? "Bỏ video của cả trận?" : "Bỏ video của ván này?",
      description:
        scope === "match" ? "Mọi ván của trận không còn liên kết video." : "Ván này không còn liên kết video.",
      confirmLabel: "Bỏ video",
    })
  if (scope === "game") return Promise.resolve(true)
  const before = youtubeVideoId(url)
  if (shared === false || (before && before !== youtubeVideoId(typed)))
    return confirmAction({
      title: "Đổi video của cả trận?",
      description:
        shared === false
          ? "Các ván đang có video riêng cũng dùng liên kết này."
          : `Mọi ván của trận sẽ dùng liên kết này thay cho video ${before}.`,
      confirmLabel: "Đổi video của cả trận",
    })
  return Promise.resolve(true)
}

function VideoForm({
  url,
  shared,
  onCancel,
  onSave,
}: {
  url: string
  shared: boolean | null
  onCancel: () => void
  onSave: (url: string, scope: VideoScope) => void
}) {
  const [link, setLink] = useState(url)
  // A game whose video is its own is changed alone, unless the editor says the whole match.
  const [scope, setScope] = useState<VideoScope>(shared === false ? "game" : "match")
  const typed = link.trim()
  const valid = !typed || !!youtubeVideoId(typed)
  const save = async () => {
    if (valid && (await linkQuestion(typed, url, scope, shared))) onSave(typed, scope)
  }
  return (
    <form
      className="esp-gt-under"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        onCancel()
      }}
    >
      <Input
        autoFocus
        value={link}
        onChange={(event) => setLink(event.target.value)}
        className="h-8"
        placeholder="https://www.youtube.com/watch?v=…"
        aria-label="Liên kết video YouTube"
        aria-invalid={!valid}
      />
      {!valid && (
        <p className="text-xs text-destructive" role="alert">
          Chỉ nhận liên kết YouTube (watch, youtu.be, live).
        </p>
      )}
      <div className="esp-gt-line">
        <Segmented label="Ván dùng video này" value={scope} options={SCOPES} onChange={setScope} />
        <span className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" size="sm" variant="outline" disabled={!valid || (typed === url && scope === "game")}>
            Lưu
          </Button>
        </span>
      </div>
    </form>
  )
}
