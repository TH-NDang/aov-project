import type { ComponentType } from "react"
import { Facebook, Globe, Instagram, Music2, Twitter, Youtube } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>

const platforms: [RegExp, string, Icon][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube", Youtube],
  [/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/, "Facebook", Facebook],
  [/(^|\.)tiktok\.com$/, "TikTok", Music2],
  [/(^|\.)instagram\.com$/, "Instagram", Instagram],
  [/(^|\.)(x\.com|twitter\.com)$/, "X", Twitter],
]

/** The platform a public link points to, from its host; anything else is a website. */
export function platformOf(url: string): { name: string; icon: Icon } {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const match = platforms.find(([pattern]) => pattern.test(host))
    if (match) return { name: match[1], icon: match[2] }
  } catch {
    // An unfinished URL is shown as a website until it parses.
  }
  return { name: "Website", icon: Globe }
}

export function PlatformIcon({ url, className }: { url: string; className?: string }) {
  const { name, icon: Icon } = platformOf(url)
  return (
    <span title={name} className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">{name}</span>
    </span>
  )
}
