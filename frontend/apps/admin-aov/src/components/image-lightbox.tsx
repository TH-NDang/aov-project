import { useEffect, useRef, useState, type ReactNode } from "react"
import { useHotkeys } from "@/app/hotkeys"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { Kbd } from "@aov/ui/components/kbd"
import { cn } from "@aov/ui/lib/utils"
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

/**
 * Large preview that steps through `images`: arrow keys, the buttons on the picture, or the strip of small pictures
 * beside it (below it on a narrow screen), which shows where in the set the open picture sits.
 */
export function ImageLightbox({ images, index, onIndexChange, onCloseAutoFocus }: ImageLightboxProps) {
  const { enabled } = useHotkeys()
  const title = useRef<HTMLHeadingElement>(null)
  // Held in state: the dialog mounts its content a render after opening, so the strip appears after `index` is set.
  const [strip, setStrip] = useState<HTMLUListElement | null>(null)
  const image = index === null ? undefined : images[index]
  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < images.length - 1
  const many = images.length > 1

  // Keep the open picture's thumbnail in view when the view opens and as the set is stepped through.
  useEffect(() => {
    strip?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [index, strip])

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
            <div className={cn("grid min-w-0 gap-3", many && "sm:grid-cols-[6rem_minmax(0,1fr)]")}>
              {many && (
                <ul
                  ref={setStrip}
                  aria-label="Chọn ảnh"
                  className="order-last flex min-w-0 gap-2 overflow-x-auto p-1 sm:order-first sm:max-h-[65dvh] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto"
                >
                  {images.map((entry, position) => (
                    <li key={`${position}:${entry.path}`} className="shrink-0">
                      <button
                        type="button"
                        aria-label={`Ảnh ${position + 1}: ${entry.title}`}
                        aria-current={position === index ? "true" : undefined}
                        title={entry.title}
                        onClick={() => onIndexChange(position)}
                        className={cn(
                          "block h-14 w-20 overflow-hidden rounded-md border bg-muted/40 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring",
                          position === index ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100",
                        )}
                      >
                        <MediaImage
                          path={entry.path}
                          alt=""
                          className="size-full object-contain"
                          fallbackClassName="size-full"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {/* With a set, the frame keeps one height, so the arrows and the strip stay put while pictures change. */}
              <div
                className={cn(
                  "relative flex min-w-0 w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60 p-2 sm:p-4",
                  many && "sm:h-[65dvh]",
                )}
              >
                <MediaImage
                  path={image.path}
                  alt={image.title}
                  className={cn(
                    "block w-auto min-w-0 max-w-full object-contain",
                    many ? "max-h-[55dvh] sm:max-h-full" : "max-h-[65dvh]",
                  )}
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
            </div>
            {image.meta && <div className="min-w-0 [overflow-wrap:anywhere]">{image.meta}</div>}
            {/* Plain actions instead of the raw address: few readers need the link itself, and it stays one copy away. */}
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {many && (
                <p className="type-meta mr-auto">
                  Dùng <Kbd>←</Kbd> <Kbd>→</Kbd> hoặc bấm ảnh nhỏ để chuyển ảnh
                </p>
              )}
              <CopyButton value={mediaUrl(image.path) ?? image.path} label="Sao chép liên kết ảnh" />
              <Button variant="outline" size="sm" asChild>
                <a href={mediaUrl(image.path)} target="_blank" rel="noreferrer" title={image.path}>
                  <ExternalLink /> Mở ảnh gốc
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
