import { useEffect, useRef, useState, type ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { ImageLightbox } from "./image-lightbox"

/** Smaller images are too small for corner controls; they stay clickable and show their hover title. */
const roomyWidth = 96
const roomyHeight = 64

interface ImagePreviewProps {
  src: string
  alt: string
  children: ReactNode
  className?: string
  showHint?: boolean
  /** Bottom-right control such as the image credit button. */
  overlay?: ReactNode
  /** Shown under the large image, e.g. who owns it. */
  meta?: ReactNode
  /** Hover text for the whole image, e.g. who owns it. */
  title?: string
}

/** Add a keyboard-accessible preview trigger over a non-interactive image thumbnail. */
export function ImagePreview({
  src,
  alt,
  children,
  className,
  showHint = true,
  overlay,
  meta,
  title,
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false)
  const [roomy, setRoomy] = useState(true)
  const frame = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  // Corner controls follow the rendered image size, so a small icon never gets covered by them.
  useEffect(() => {
    const node = frame.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(([entry]) =>
      setRoomy(entry.contentRect.width >= roomyWidth && entry.contentRect.height >= roomyHeight),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={frame} className={cn("group/image-preview relative rounded-xl", className)}>
      {children}
      <button
        ref={trigger}
        type="button"
        aria-label={`Xem lớn ${alt}`}
        aria-haspopup="dialog"
        title={title}
        onClick={() => setOpen(true)}
        className="absolute inset-0 cursor-zoom-in rounded-[inherit] transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {showHint && roomy && (
          // Top-right, so it never sits on the bottom-right credit button.
          <span className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover/image-preview:opacity-100 group-focus-within/image-preview:opacity-100 [@media(hover:none)]:opacity-100">
            <Maximize2 aria-hidden="true" className="size-3.5" />
          </span>
        )}
      </button>
      {roomy && overlay}
      <ImageLightbox
        images={[{ path: src, title: alt, meta }]}
        index={open ? 0 : null}
        onIndexChange={(index) => setOpen(index !== null)}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          trigger.current?.focus({ preventScroll: true })
        }}
      />
    </div>
  )
}
