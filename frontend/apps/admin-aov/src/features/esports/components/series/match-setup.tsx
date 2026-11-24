import { useState } from "react"
import { Link2, PenLine, Youtube } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { youtubeVideoId } from "../../model/vod"

/** The match video typed before any game exists; once a game is recorded the games carry it. */
export function useDraftVideo(seriesId: string) {
  const key = `esports:match-video:${seriesId}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? ""
    } catch {
      return ""
    }
  })
  const update = (next: string) => {
    setValue(next)
    try {
      if (next) localStorage.setItem(key, next)
      else localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable; the link then lasts until the page closes.
    }
  }
  return [value, update] as const
}

/** Step one of recording a match: the YouTube video the whole match is played in. */
export function VideoLinkCard({
  editable,
  canWrite,
  compact = false,
  onEnableEditing,
  onUse,
}: {
  editable: boolean
  canWrite: boolean
  /** Games are already recorded without a video, so the place for one no longer takes a whole screen. */
  compact?: boolean
  onEnableEditing: () => void
  onUse: (url: string) => void
}) {
  const [link, setLink] = useState("")
  const valid = !!youtubeVideoId(link)
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground",
        compact ? "h-full" : "aspect-video",
      )}
    >
      <Youtube size={compact ? 24 : 32} />
      {editable ? (
        <>
          <p>Gắn video YouTube của cả trận để có dòng thời gian và ghi theo mốc video.</p>
          <form
            className="flex w-full max-w-lg gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (valid) onUse(link.trim())
            }}
          >
            <Input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              aria-label="Link YouTube của cả trận"
              aria-invalid={!!link.trim() && !valid}
              className="h-9"
            />
            <Button type="submit" disabled={!valid}>
              <Link2 size={14} /> Gắn video
            </Button>
          </form>
          {!!link.trim() && !valid && (
            <p className="text-xs text-destructive">Chỉ nhận link YouTube (watch, youtu.be, live).</p>
          )}
        </>
      ) : (
        <>
          <p>Trận chưa có video YouTube.</p>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={onEnableEditing}>
              <PenLine size={14} /> Bật chế độ ghi để gắn video
            </Button>
          )}
        </>
      )}
    </div>
  )
}

/** What to do next while the match has no recorded game yet. */
export function MatchSetupGuide({
  hasVideo,
  editable,
  canWrite,
  resultNote,
  nextNumber,
  onEnableEditing,
}: {
  hasVideo: boolean
  editable: boolean
  canWrite: boolean
  resultNote: string | null
  nextNumber: number | null
  onEnableEditing: () => void
}) {
  const steps = [
    { done: hasVideo, text: "Gắn video YouTube của cả trận. Không có video vẫn thêm ván được." },
    {
      done: false,
      text: hasVideo
        ? `Tua tới màn cấm chọn rồi bấm “Cấm chọn ván ${nextNumber ?? 1}”.`
        : `Bấm “Thêm ván ${nextNumber ?? 1}”.`,
    },
    { done: false, text: "Ghi cấm chọn, tuyển thủ, phụ trợ của hai đội." },
    { done: false, text: "Ghi đội thắng và thời lượng, rồi xuất bản." },
  ]
  return (
    <section className="esp-area-side min-w-0 space-y-3 admin-section py-4 text-sm">
      {resultNote && <p className="text-muted-foreground">{resultNote}</p>}
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-2">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold",
                step.done ? "bg-[var(--esp-live)] text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <span className={cn(step.done && "text-muted-foreground line-through")}>{step.text}</span>
          </li>
        ))}
      </ol>
      {!editable && canWrite && (
        <Button size="sm" onClick={onEnableEditing}>
          <PenLine size={14} /> Bật chế độ ghi
        </Button>
      )}
      {nextNumber === null && <p className="text-xs text-muted-foreground">Trận đã đủ số ván của BO.</p>}
    </section>
  )
}
