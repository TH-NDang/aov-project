import { useState } from "react"
import { ThemedLogo } from "./themed-logo"

/**
 * A picture on its plate, with a monogram while it is missing. The plate follows the theme, and a logo shows the
 * version drawn for it; when that one fails to load the other takes its place.
 */
export function StreamImage({
  src,
  darkSrc,
  name,
  logo = false,
  className = "",
}: {
  src?: string | null
  darkSrc?: string | null
  name: string
  /** A logo is drawn whole and inset from the plate's edge; a photo fills the plate. */
  logo?: boolean
  className?: string
}) {
  const [failed, setFailed] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string>()
  const usable = (url: string | null | undefined) => (url && !failed.includes(url) ? url : null)
  const light = usable(src)
  const dark = usable(darkSrc)
  const shown = light || dark
  const fail = (url: string) => setFailed((current) => (current.includes(url) ? current : [...current, url]))
  return (
    <span
      className={`stream-image ${className}`}
      data-logo={logo || undefined}
      data-ready={(!!shown && loaded === shown) || undefined}
    >
      {shown && logo ? (
        <ThemedLogo src={light} darkSrc={dark} alt={name} onLoad={() => setLoaded(shown)} onError={fail} />
      ) : shown ? (
        <img
          key={shown}
          src={shown}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(shown)}
          onError={() => fail(shown)}
        />
      ) : (
        <span aria-label={name}>{name.slice(0, 2).toLocaleUpperCase("vi-VN") || "?"}</span>
      )}
    </span>
  )
}
