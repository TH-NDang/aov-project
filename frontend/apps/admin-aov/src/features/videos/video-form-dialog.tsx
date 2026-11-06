import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Link2, Loader2, Play } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { Switch } from "@aov/ui/components/switch"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { usePublicationOverview } from "../publishing/publication-overview"
import { SubjectPicker } from "./subject-picker"
import { VideoPlayerDialog } from "./video-player-dialog"
import { lookupYoutubeVideo, videoApi, videoKeys } from "./video-api"
import {
  capabilityFor,
  formatClock,
  isWebLink,
  parseClock,
  previewLink,
  PURPOSE_LABELS,
  purposesFor,
  saveBody,
  subjectId,
  videoSubjectId,
  type AdminVideo,
  type SaveVideo,
  type VideoPurpose,
  type VideoSubject,
} from "./video-model"

const NO_PATCH = "none"

export function VideoFormDialog({
  open,
  video,
  subjects,
  initialSubject,
  onClose,
  showHero = false,
}: {
  open: boolean
  video: AdminVideo | null
  subjects: readonly VideoSubject[]
  initialSubject: VideoSubject | null
  onClose: () => void
  showHero?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {/* The dialog unmounts this once it has finished closing, which also resets the form. */}
        <VideoForm
          video={video}
          subjects={subjects}
          initialSubject={initialSubject}
          onClose={onClose}
          showHero={showHero}
        />
      </DialogContent>
    </Dialog>
  )
}

function VideoForm({
  video,
  subjects,
  initialSubject,
  onClose,
  showHero,
}: {
  video: AdminVideo | null
  subjects: readonly VideoSubject[]
  initialSubject: VideoSubject | null
  onClose: () => void
  showHero: boolean
}) {
  const cache = useQueryClient()
  const actor = useSession().actor
  const overview = usePublicationOverview()
  const [subject, setSubject] = useState<VideoSubject | null>(
    () => (video && subjects.find((candidate) => subjectId(candidate) === videoSubjectId(video))) || initialSubject,
  )
  const [url, setUrl] = useState(video?.url ?? "")
  const [title, setTitle] = useState(video?.title ?? "")
  const [titleEdited, setTitleEdited] = useState(!!video)
  const [channelName, setChannelName] = useState(video?.channelName ?? "")
  const [note, setNote] = useState(video?.note ?? "")
  const [start, setStart] = useState(video?.startSeconds ? formatClock(video.startSeconds) : "")
  const [purpose, setPurpose] = useState<VideoPurpose | null>(video?.purpose ?? null)
  const [patchVariantId, setPatchVariantId] = useState(video?.patchVariantId ?? NO_PATCH)
  const [publish, setPublish] = useState(video ? video.status === "PUBLISHED" : true)
  const [lookingUp, setLookingUp] = useState(false)

  const preview = useMemo(() => previewLink(url, window.location.hostname), [url])
  const [trying, setTrying] = useState(false)
  const purposes = useMemo(() => (subject ? purposesFor(subject.kind, purpose ?? undefined) : []), [purpose, subject])
  const selectedPurpose = purpose && purposes.includes(purpose) ? purpose : (purposes[0] ?? null)
  const canPublish = !!subject && !!actor?.capabilities.includes(capabilityFor(subject.kind, "publish"))
  const startSeconds = start.trim() ? parseClock(start) : 0
  const variants = useMemo(
    () => [...(overview.data?.variants ?? [])].sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal),
    [overview.data],
  )

  // A pasted YouTube link fills the title and channel unless the editor has already written their own.
  useEffect(() => {
    if (!preview.videoId) return
    const controller = new AbortController()
    setLookingUp(true)
    void lookupYoutubeVideo(`https://www.youtube.com/watch?v=${preview.videoId}`, controller.signal).then((found) => {
      if (controller.signal.aborted) return
      setLookingUp(false)
      if (!found) return
      setTitle((current) => (titleEdited ? current : found.title.slice(0, 300)))
      setChannelName((current) => current || found.channelName.slice(0, 120))
    })
    return () => controller.abort()
  }, [preview.videoId, titleEdited])

  useEffect(() => {
    if (preview.startSeconds) setStart(formatClock(preview.startSeconds))
  }, [preview.startSeconds])

  const save = useMutation({
    mutationFn: () => {
      const changes: SaveVideo = {
        subjectKind: subject!.kind,
        subjectId: subject!.id,
        subjectKey: subject!.key,
        purpose: selectedPurpose!,
        title: title.trim(),
        note: note.trim() || null,
        url: url.trim(),
        startSeconds,
        durationSeconds: video?.durationSeconds ?? null,
        channelName: channelName.trim() || null,
        publishedOn: video?.publishedOn ?? null,
        patchVariantId: patchVariantId === NO_PATCH ? null : patchVariantId,
        displayOrder: video?.displayOrder ?? null,
        status: publish && canPublish ? "PUBLISHED" : video?.status === "HIDDEN" ? "HIDDEN" : "DRAFT",
        expectedVersion: video?.version ?? null,
      }
      return video ? videoApi.update(video.id, saveBody(video, changes)) : videoApi.create(changes)
    },
    meta: { successMessage: video ? "Đã lưu video." : "Đã thêm video." },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: videoKeys.lists })
      onClose()
    },
  })

  const validLink = isWebLink(url)
  const ready = !!subject && !!selectedPurpose && validLink && !!title.trim() && startSeconds !== null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (ready && !save.isPending) save.mutate()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{video ? "Sửa video" : "Thêm video"}</DialogTitle>
        <DialogDescription>
          Dán liên kết YouTube, Facebook, TikTok, Twitch hoặc tệp video để phát ngay trên wiki. Trang khác sẽ mở ở tab
          mới.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <label className="grid content-start gap-1.5 text-sm">
          <span>Liên kết video</span>
          <Input
            autoFocus={!video}
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={!!url.trim() && !validLink}
          />
          {!!url.trim() && !validLink && (
            <span role="alert" className="type-meta text-destructive">
              Cần một liên kết bắt đầu bằng http:// hoặc https://.
            </span>
          )}
          {validLink && !preview.playable && (
            <span className="type-meta flex items-center gap-1">
              <ExternalLink className="size-3.5" />
              {preview.source?.provider === "TIKTOK"
                ? "Link rút gọn không phát trên trang được. Hãy dán link đầy đủ dạng tiktok.com/@kenh/video/…"
                : "Trang này không phát được trên wiki, người đọc sẽ mở liên kết ở tab mới."}
            </span>
          )}
          {lookingUp && (
            <span className="type-meta flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" /> Đang lấy tiêu đề từ YouTube…
            </span>
          )}
        </label>
        <div className="grid content-start gap-1.5">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {preview.thumbnail ? (
              <img src={preview.thumbnail} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            ) : (
              <Link2 className="size-5 text-muted-foreground" />
            )}
          </div>
          {preview.playable && (
            <Button type="button" size="sm" variant="outline" onClick={() => setTrying(true)}>
              <Play className="size-4" /> Xem thử
            </Button>
          )}
        </div>
      </div>

      <SubjectPicker
        label="Gắn vào"
        subjects={subjects}
        value={subject}
        onChange={(next) => {
          setSubject(next)
          setPurpose(null)
        }}
        showHero={showHero}
      />

      {subject && (
        <div className="grid gap-1.5">
          <span className="text-sm" id="video-purpose-label">
            Loại video
          </span>
          <div role="radiogroup" aria-labelledby="video-purpose-label" className="flex flex-wrap gap-1.5">
            {purposes.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selectedPurpose === option}
                onClick={() => setPurpose(option)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
                  selectedPurpose === option
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {PURPOSE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="grid gap-1.5 text-sm">
        <span>Tiêu đề</span>
        <Input
          maxLength={300}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            setTitleEdited(true)
          }}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid content-start gap-1.5 text-sm">
          <span>Áp dụng từ bản</span>
          <Select value={patchVariantId} onValueChange={setPatchVariantId}>
            <SelectTrigger className="w-full" aria-label="Áp dụng từ bản">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PATCH}>Mọi phiên bản</SelectItem>
              {variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.patchCode}
                  {variant.status !== "PUBLISHED" && " (chưa công bố)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="type-meta">Wiki ẩn video này khi người đọc xem phiên bản cũ hơn.</span>
        </label>
        <label className="grid content-start gap-1.5 text-sm">
          <span>Bắt đầu từ</span>
          <Input
            inputMode="numeric"
            placeholder="0:00"
            value={start}
            disabled={!preview.seekable}
            onChange={(event) => setStart(event.target.value)}
            aria-invalid={startSeconds === null}
          />
          <span className={cn("type-meta", startSeconds === null && "text-destructive")}>
            {startSeconds === null
              ? "Viết theo dạng 90, 1:30 hoặc 1:02:03."
              : "Hữu ích khi một video dài có nhiều phần."}
          </span>
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span>Kênh (không bắt buộc)</span>
        <Input maxLength={120} value={channelName} onChange={(event) => setChannelName(event.target.value)} />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span>Ghi chú cho người đọc (không bắt buộc)</span>
        <Textarea maxLength={1000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <label className="flex items-start justify-between gap-4 rounded-lg border p-3 text-sm">
        <span className="grid gap-0.5">
          <span>Hiện trên wiki</span>
          <span className="type-meta">
            {subject && !canPublish
              ? "Tài khoản này chưa có quyền công bố, video sẽ nằm ở mục Chờ duyệt."
              : "Tắt để lưu vào mục Chờ duyệt."}
          </span>
        </span>
        <Switch checked={publish && canPublish} disabled={!canPublish} onCheckedChange={setPublish} />
      </label>

      {save.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {errorMessage(save.error)}
        </p>
      )}

      <VideoPlayerDialog video={trying ? preview.source : null} title={title.trim()} onClose={() => setTrying(false)} />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
          Hủy
        </Button>
        <Button type="submit" disabled={!ready || save.isPending}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />}
          {video ? "Lưu thay đổi" : "Thêm video"}
        </Button>
      </DialogFooter>
    </form>
  )
}
