import { useState, type ComponentProps } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { mediaUrl } from "@/lib/media"

interface MediaImageProps extends Omit<ComponentProps<"img">, "src"> {
  path: string | null | undefined
  /** Classes for the fallback box shown when the path is empty or the file cannot be decoded. */
  fallbackClassName?: string
}

/** Image from the media store with lazy loading and a neutral placeholder on failure. */
export function MediaImage({ path, alt = "", className, fallbackClassName, ...props }: MediaImageProps) {
  const [failedPath, setFailedPath] = useState<string | null>(null)
  const src = mediaUrl(path)
  if (!src || failedPath === path) {
    return (
      <span
        role="img"
        aria-label={alt || "Không có ảnh"}
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className, fallbackClassName)}
      >
        <ImageOff className="size-1/3 max-h-6 max-w-6 min-h-3 min-w-3" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedPath(path ?? null)}
      className={className}
      {...props}
    />
  )
}
