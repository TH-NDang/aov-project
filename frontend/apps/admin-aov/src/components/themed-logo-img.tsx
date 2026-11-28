import type { ReactNode } from "react"
import { AvatarImage } from "@aov/ui/components/avatar"
import { useThemedLogo } from "@/lib/themed-logo"

/**
 * A logo image that follows the Admin theme; `fallback` stands in when the record has no logo at all. A page keeps one
 * logo only, passed as `url`: the dark theme shows it on its light plate.
 */
export function ThemedLogoImg({
  url,
  darkUrl,
  alt = "",
  className,
  fallback = null,
}: {
  url?: string | null
  darkUrl?: string | null
  alt?: string
  className?: string
  fallback?: ReactNode
}) {
  const logo = useThemedLogo(url, darkUrl)
  if (!logo.url) return fallback
  return <img src={logo.url} alt={alt} className={className} data-logo-plate={logo.plate} />
}

/** The image of an Avatar that shows a logo following the Admin theme; the Avatar's fallback covers a missing one. */
export function ThemedAvatarImage({ url, darkUrl }: { url?: string | null; darkUrl?: string | null }) {
  const logo = useThemedLogo(url, darkUrl)
  return <AvatarImage src={logo.url} alt="" className="object-contain" data-logo-plate={logo.plate} />
}
