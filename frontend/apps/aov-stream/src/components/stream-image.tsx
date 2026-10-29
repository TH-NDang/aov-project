import { useState } from "react"

export function StreamImage({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState<string>()
  const [loaded, setLoaded] = useState<string>()
  return (
    <span className={`stream-image ${className}`} data-ready={loaded === src || undefined}>
      {src && failed !== src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-label={name}>{name.slice(0, 2).toLocaleUpperCase("vi-VN") || "?"}</span>
      )}
    </span>
  )
}
