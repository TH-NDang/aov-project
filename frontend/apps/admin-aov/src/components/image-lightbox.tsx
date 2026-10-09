import { useEffect, type ReactNode } from "react"
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
}

/** Large preview with keyboard navigation through `images`. */
export function ImageLightbox({ images, index, onIndexChange }: ImageLightboxProps) {
  const image = index === null ? undefined : images[index]
  const hasPrev = index !== null && index > 0
  const hasNext = index !== null && index < images.length - 1

  useEffect(() => {
    if (index === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1)
      if (event.key === "ArrowRight" && index < images.length - 1) onIndexChange(index + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [index, images.length, onIndexChange])

  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="sm:max-w-3xl">
        {image && (
          <>
            <DialogHeader>
              <DialogTitle>{image.title}</DialogTitle>
              <DialogDescription>{image.subtitle ?? `${index! + 1}/${images.length}`}</DialogDescription>
            </DialogHeader>
            <div className="relative flex items-center justify-center rounded-lg bg-muted/60 p-4">
              <MediaImage
                path={image.path}
                alt={image.title}
                className="max-h-[60vh] w-auto max-w-full object-contain"
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
            {image.meta}
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <code className="min-w-0 flex-1 truncate font-mono">{image.path}</code>
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
