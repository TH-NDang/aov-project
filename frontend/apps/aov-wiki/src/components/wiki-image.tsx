import { useCallback, useRef, useState, type ComponentPropsWithoutRef } from "react"
import "./wiki-image.css"
import { WikiImageCredit as ImageCredit } from "./wiki-image-credit"
import type { HeroMedia } from "../lib/hero-api"
import { focalPosition, type FocalPoint } from "@aov/ui/lib/focal-point"
import { sizedImageSources } from "../lib/sized-image"

type WikiImageProps = ComponentPropsWithoutRef<"img"> & {
  media?: HeroMedia
  /** The point of the picture to keep in view when the frame crops it. */
  focus?: FocalPoint | null
  /** False leaves out the shimmer shown while the picture loads, for a mark drawn over another picture. */
  placeholder?: boolean
  /**
   * The widest the frame is drawn, in CSS pixels: the picture is then fetched at that size instead of at full size.
   * Without it, a numeric `width` stands for the drawn size.
   */
  frameWidth?: number
}
type ImageState = "loading" | "ready" | "error"

type ImageFrameProps = Omit<WikiImageProps, "frameWidth"> & {
  /** The full-size picture, tried once when the resized copy fails. */
  original?: string
}

function ImageFrame({
  className,
  style,
  loading = "lazy",
  decoding = "async",
  onLoad,
  onError,
  alt,
  media,
  focus,
  placeholder = true,
  original,
  ...imageProps
}: ImageFrameProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const requestRef = useRef(0)
  const [state, setState] = useState<ImageState>("loading")
  const [fullSize, setFullSize] = useState(false)
  const sources = fullSize && original ? { src: original, srcSet: undefined } : {}

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
      {placeholder && <span className="wiki-image-placeholder" aria-hidden="true" />}
      <img
        {...imageProps}
        {...sources}
        ref={attachImage}
        alt={alt}
        className="wiki-image-content"
        style={focus ? { objectPosition: focalPosition(focus) } : undefined}
        loading={loading}
        decoding={decoding}
        onLoad={(event) => {
          void revealImage(event.currentTarget)
          onLoad?.(event)
        }}
        onError={(event) => {
          requestRef.current++
          if (original && !fullSize) {
            setFullSize(true)
            return
          }
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
export function WikiImage({ frameWidth, ...props }: WikiImageProps) {
  const sourceKey = [props.src, props.srcSet, props.sizes, frameWidth].join("\u0000")
  // A picture given a width but no frame width is drawn about that wide.
  const drawn = frameWidth ?? (Number(props.width) || undefined)
  const sized = drawn && props.src && !props.srcSet ? sizedImageSources(props.src, drawn) : undefined

  return <ImageFrame key={sourceKey} {...props} {...sized} />
}
