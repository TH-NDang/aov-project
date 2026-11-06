import { ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { videoPlayback, videoProviderName, videoWatchUrl, type VideoSource } from "@aov/ui/lib/video-playback"
import { cn } from "@aov/ui/lib/utils"

/** Watches a video without leaving the admin; the player is only created while the dialog is open. */
export function VideoPlayerDialog({
  video,
  title,
  onClose,
}: {
  video: VideoSource | null
  title: string
  onClose: () => void
}) {
  const playback = video ? videoPlayback(video, window.location.hostname) : null
  const provider = video ? videoProviderName(video) : ""

  return (
    <Dialog open={!!playback} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-2 pr-6">{title || "Xem thử video"}</DialogTitle>
          <DialogDescription className="sr-only">Trình phát video</DialogDescription>
        </DialogHeader>
        {playback?.kind === "file" && (
          <video src={playback.src} controls autoPlay playsInline className="aspect-video w-full rounded-lg bg-black" />
        )}
        {playback?.kind === "frame" && (
          <iframe
            src={playback.src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className={cn(
              "rounded-lg border-0 bg-black",
              playback.portrait ? "mx-auto aspect-[9/16] h-[70dvh] max-w-full" : "aspect-video w-full",
            )}
          />
        )}
        {video && (
          <a
            href={videoWatchUrl(video)}
            target="_blank"
            rel="noreferrer"
            className="type-meta inline-flex w-fit items-center gap-1 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            {provider ? `Mở trên ${provider}` : "Mở liên kết gốc"}
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}
