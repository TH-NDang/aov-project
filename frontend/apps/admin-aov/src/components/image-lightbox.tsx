import { useEffect, useRef, type ReactNode } from "react"
import { useHotkeys } from "@/app/hotkeys"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Kbd } from "@aov/ui/components/kbd"
import { CopyButton } from "@/components/copy-button"
import { MediaImage } from "@/components/media-image"
import { mediaUrl } from "@/lib/media"

export interface LightboxImage {
  path: string
  title: string
  subtitle?: string
  meta?: ReactNode
}

interface ImageLightboxProps {
  images: LightboxImage[]
  index: number | null
  onIndexChange: (index: number | null) => void
  onCloseAutoFocus?: (event: Event) => void
}

/** Large preview with keyboard navigation through `images`. */
export function ImageLightbox({ images, index, onIndexChange, onCloseAutoFocus }: ImageLightboxProps) {
  const { enabled } = useHotkeys()
  const title = useRef<HTMLHeadingElement>(null)
  const image = index === null ? undefined : images[index]
  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < images.length - 1

  useEffect(() => {
    if (index === null || !enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1)
      if (event.key === "ArrowRight" && index < images.length - 1) onIndexChange(index + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, images.length, onIndexChange, enabled])

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] min-w-0 max-w-[calc(100vw-1.5rem)] gap-3 overflow-x-hidden overflow-y-auto p-3 sm:w-full sm:max-w-6xl sm:gap-4 sm:p-6"
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          title.current?.focus({ preventScroll: true })
        }}
      >
        {image && (
          <>
            <DialogHeader className="min-w-0 pr-7">
              <DialogTitle ref={title} tabIndex={-1} className="min-w-0 [overflow-wrap:anywhere] outline-none">
                {image.title}
              </DialogTitle>
              <DialogDescription className="min-w-0 break-words">
                {image.subtitle ?? `${index! + 1}/${images.length}`}
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex min-w-0 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60 p-2 sm:p-4">
              <MediaImage
                path={image.path}
                alt={image.title}
                className="block max-h-[65dvh] w-auto min-w-0 max-w-full object-contain"
                fallbackClassName="h-64 w-full"
              />
              {hasPrev && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-2 rounded-full"
                  onClick={() => onIndexChange(index! - 1)}
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft />
                </Button>
              )}
              {hasNext && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 rounded-full"
                  onClick={() => onIndexChange(index! + 1)}
                  aria-label="Ảnh sau"
                >
                  <ChevronRight />
                </Button>
              )}
            </div>
            {image.meta && <div className="min-w-0 [overflow-wrap:anywhere]">{image.meta}</div>}
            <div className="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border bg-muted/40 px-2 py-2 text-xs sm:px-3">
              <code className="min-w-0 flex-1 truncate font-mono" title={image.path}>
                {image.path}
              </code>
              <CopyButton value={image.path} label="Sao chép đường dẫn" />
              <Button variant="ghost" size="icon-xs" asChild>
                <a href={mediaUrl(image.path)} target="_blank" rel="noreferrer" aria-label="Mở ảnh gốc">
                  <ExternalLink />
                </a>
              </Button>
            </div>
            {images.length > 1 && (
              <p className="text-center text-xs text-muted-foreground">
                Dùng <Kbd>←</Kbd> <Kbd>→</Kbd> để chuyển ảnh
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
