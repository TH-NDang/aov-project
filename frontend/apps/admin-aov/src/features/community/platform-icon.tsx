import { Globe } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { socialLogoPaths } from "./social-logos/paths"

export type SocialPlatformId = keyof typeof socialLogoPaths | "website"
type SocialPlatform = { id: SocialPlatformId; name: string; url: string; color: string; hosts: RegExp }

export const socialPlatforms: SocialPlatform[] = [
  {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/",
    color: "#0866FF",
    hosts: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/,
  },
  {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/",
    color: "#FF0033",
    hosts: /(^|\.)(youtube\.com|youtu\.be)$/,
  },
  { id: "tiktok", name: "TikTok", url: "https://www.tiktok.com/", color: "currentColor", hosts: /(^|\.)tiktok\.com$/ },
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/",
    color: "#E4405F",
    hosts: /(^|\.)instagram\.com$/,
  },
  { id: "x", name: "X", url: "https://x.com/", color: "currentColor", hosts: /(^|\.)(x\.com|twitter\.com)$/ },
  {
    id: "discord",
    name: "Discord",
    url: "https://discord.gg/",
    color: "#5865F2",
    hosts: /(^|\.)(discord\.com|discord\.gg)$/,
  },
  { id: "telegram", name: "Telegram", url: "https://t.me/", color: "#26A5E4", hosts: /(^|\.)(telegram\.org|t\.me)$/ },
  { id: "twitch", name: "Twitch", url: "https://www.twitch.tv/", color: "#9146FF", hosts: /(^|\.)twitch\.tv$/ },
  { id: "zalo", name: "Zalo", url: "https://zalo.me/", color: "#0068FF", hosts: /(^|\.)(zalo\.me|zalo\.com)$/ },
]
export const popularSocialPlatforms = socialPlatforms.slice(0, 4)
export const customSocialPlatform: SocialPlatform = {
  id: "website",
  name: "Tùy chỉnh",
  url: "",
  color: "currentColor",
  hosts: /$^/,
}

/** Infer a brand only from the hostname, never from arbitrary text in a URL. */
export function platformOf(url: string): SocialPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return socialPlatforms.find((platform) => platform.hosts.test(host)) || customSocialPlatform
  } catch {
    return customSocialPlatform
  }
}

export function PlatformIcon({ url, className }: { url: string; className?: string }) {
  const platform = platformOf(url)
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center text-foreground", className)}>
      {platform.id === "website" ? (
        <Globe aria-hidden className="size-4 text-sky-600 dark:text-sky-400" />
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-[18px] overflow-visible">
          {platform.id === "tiktok" && (
            <>
              <path d={socialLogoPaths.tiktok} fill="#25F4EE" transform="translate(-0.6,-0.4)" />
              <path d={socialLogoPaths.tiktok} fill="#FE2C55" transform="translate(0.6,0.4)" />
            </>
          )}
          <path d={socialLogoPaths[platform.id]} fill={platform.color} />
        </svg>
      )}
      <span className="sr-only">{platform.id === "website" ? "Website" : platform.name}</span>
    </span>
  )
}
