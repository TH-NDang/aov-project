/**
 * A logo in the version drawn for the background it stands on. Both images are in the page and stream.css shows the
 * one that suits the theme, or the dark one on a stage, so prerendered pages and a theme switch need no script. A
 * logo with a single version brings the background it was drawn for along, where it stands on the other one.
 */
export function ThemedLogo({
  src,
  darkSrc,
  alt = "",
  className = "",
  onLoad,
  onError,
}: {
  src?: string | null
  darkSrc?: string | null
  alt?: string
  className?: string
  onLoad?: (url: string) => void
  onError?: (url: string) => void
}) {
  const image = (url: string, version: string) => (
    <img
      key={url}
      className={`${version} ${className}`.trim() || undefined}
      data-single={version === "logo-only" || version === "logo-dark-only" || undefined}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={onLoad && (() => onLoad(url))}
      onError={onError && (() => onError(url))}
    />
  )
  // The same image in both places suits both backgrounds, so it stands on either as it is.
  if (src && src === darkSrc) return image(src, "")
  if (src && darkSrc)
    return (
      <>
        {image(src, "logo-light")}
        {image(darkSrc, "logo-dark")}
      </>
    )
  if (src) return image(src, "logo-only")
  return darkSrc ? image(darkSrc, "logo-dark-only") : null
}
