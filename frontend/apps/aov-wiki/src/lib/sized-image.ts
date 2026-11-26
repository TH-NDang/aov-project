/**
 * Pictures from Media are stored at full size. When the image service is on (`VITE_IMAGE_RESIZE=cloudflare`), each
 * picture is asked for at the width it is drawn, through Cloudflare's image transformations on the same host.
 */

/**
 * The widths the service is asked for. Each width is a separate copy in the image cache, so a short list lets most
 * readers share one already made instead of waiting for a new one. Frames are sized to these widths (768 for the large
 * artwork, its sharp copy 1536).
 */
const WIDTHS = [64, 128, 256, 384, 768, 1536]

const SERVICE_ON = import.meta.env?.VITE_IMAGE_RESIZE === "cloudflare"

/** The address of a Media picture resized to at least `width` pixels, or the address unchanged. */
export function resizedImageUrl(url: string, width: number, enabled = SERVICE_ON): string {
  if (!enabled) return url
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.pathname.startsWith("/assets/")) return url
  const size = WIDTHS.find((candidate) => candidate >= width) ?? WIDTHS[WIDTHS.length - 1]
  return `${parsed.origin}/cdn-cgi/image/width=${size},fit=scale-down,format=auto,quality=82${parsed.pathname}`
}

export interface SizedImageSources {
  src: string
  srcSet?: string
  /** The full-size picture, for when the resized one cannot be had. */
  original?: string
}

/** The sources of a picture drawn `cssWidth` pixels wide: one copy for ordinary screens and one for sharp ones. */
export function sizedImageSources(url: string, cssWidth: number, enabled = SERVICE_ON): SizedImageSources {
  const single = resizedImageUrl(url, cssWidth, enabled)
  if (single === url) return { src: url }
  const double = resizedImageUrl(url, cssWidth * 2, enabled)
  return { src: single, srcSet: single === double ? undefined : `${single} 1x, ${double} 2x`, original: url }
}

/** Starts loading a picture that is about to be drawn `cssWidth` pixels wide, at the size it will be drawn. */
export function preloadPicture(url: string, cssWidth: number) {
  const sources = sizedImageSources(url, cssWidth)
  const image = new Image()
  if (sources.srcSet) image.srcset = sources.srcSet
  image.src = sources.src
}
