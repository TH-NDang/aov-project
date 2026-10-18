import { useRef, useState, type ReactNode } from "react"
import { Maximize2 } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { ImageLightbox } from "./image-lightbox"

interface ImagePreviewProps {
  src: string
  alt: string
  children: ReactNode
  className?: string
}

/** Add a keyboard-accessible preview trigger over a non-interactive image thumbnail. */
export function ImagePreview({ src, alt, children, className }: ImagePreviewProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <div className={cn("group/image-preview relative rounded-xl", className)}>
      {children}
      <button
        ref={trigger}
        type="button"
        aria-label={`Xem lớn ${alt}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="absolute inset-0 cursor-zoom-in rounded-[inherit] transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="absolute right-2 bottom-2 rounded-md bg-black/60 p-2 text-white opacity-0 transition-opacity group-hover/image-preview:opacity-100 group-focus-within/image-preview:opacity-100 [@media(hover:none)]:opacity-100">
          <Maximize2 aria-hidden="true" className="size-4" />
        </span>
      </button>
      <ImageLightbox
        images={[{ path: src, title: alt }]}
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
