import { useState } from "react"

/**
 * A picture on its plate, with a monogram while it is missing. The plate is dark in both themes, so a logo drawn for
 * dark backgrounds (`darkSrc`) is preferred; when it fails to load the other version takes its place.
 */
export function StreamImage({
  src,
  darkSrc,
  name,
  className = "",
}: {
  src?: string | null
  darkSrc?: string | null
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string>()
  const shown = [darkSrc, src].find((url): url is string => !!url && !failed.includes(url))
  return (
    <span className={`stream-image ${className}`} data-ready={(!!shown && loaded === shown) || undefined}>
      {shown ? (
        <img
          key={shown}
          src={shown}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(shown)}
          onError={() => setFailed((current) => [...current, shown])}
        />
      ) : (
        <span aria-label={name}>{name.slice(0, 2).toLocaleUpperCase("vi-VN") || "?"}</span>
      )}
    </span>
  )
}
