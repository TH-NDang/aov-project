import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from "react"
import "./wiki-image.css"
import { ImageCredit } from "@aov/ui/components/image-credit"
import type { HeroMedia } from "../features/hero/hero-api"

type WikiImageProps = ComponentPropsWithoutRef<"img"> & { media?: HeroMedia }
type ImageState = "loading" | "ready" | "error"

function ImageFrame({
  className,
  style,
  loading = "lazy",
  decoding = "async",
  onLoad,
  onError,
  alt,
  media,
  ...imageProps
}: WikiImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const requestRef = useRef(0)
  const [state, setState] = useState<ImageState>("loading")

  const revealImage = useCallback(async (image: HTMLImageElement) => {
    const request = ++requestRef.current

    try {
      await image.decode()
    } catch {
      // Some formats can display successfully even when explicit decoding is unsupported.
    }

    if (imageRef.current !== image || request !== requestRef.current) return
    if (image.complete && image.naturalWidth > 0) setState("ready")
  }, [])

  const attachImage = useCallback(
    (image: HTMLImageElement | null) => {
      imageRef.current = image

      if (!image) requestRef.current++
      else if (image.complete && image.naturalWidth > 0) void revealImage(image)
    },
    [revealImage],
  )

  return (
    <span
      className={["wiki-image", className].filter(Boolean).join(" ")}
      style={style}
      data-state={state}
      aria-busy={state === "loading" || undefined}
    >
      <span className="wiki-image-placeholder" aria-hidden="true" />
      <img
        {...imageProps}
        ref={attachImage}
        alt={alt}
        className="wiki-image-content"
        loading={loading}
        decoding={decoding}
        onLoad={(event) => {
          void revealImage(event.currentTarget)
          onLoad?.(event)
        }}
        onError={(event) => {
          requestRef.current++
          setState("error")
          onError?.(event)
        }}
      />
      {media?.currentVersion && state === "ready" && (
        <ImageCredit
          sources={media.currentVersion.sources}
          contactHref={`/contact?assetId=${encodeURIComponent(media.assetId)}&versionId=${encodeURIComponent(media.currentVersion.versionId)}`}
        />
      )}
    </span>
  )
}

/** The frame owns className/style geometry; all remaining image attributes target the native image. */
export function WikiImage(props: WikiImageProps) {
  const sourceKey = [props.src, props.srcSet, props.sizes].join("\u0000")

  return <ImageFrame key={sourceKey} {...props} />
}
