import { Globe } from "lucide-react"
import { socialLogoPaths } from "../assets/social/paths"

type SocialBrand = { id: keyof typeof socialLogoPaths; color: string; hosts: RegExp }

const socialBrands: SocialBrand[] = [
  { id: "facebook", color: "#0866ff", hosts: /(^|\.)(facebook\.com|fb\.com|fb\.watch)$/ },
  { id: "youtube", color: "#ff0033", hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { id: "tiktok", color: "currentColor", hosts: /(^|\.)tiktok\.com$/ },
  { id: "instagram", color: "#e4405f", hosts: /(^|\.)instagram\.com$/ },
  { id: "x", color: "currentColor", hosts: /(^|\.)(x\.com|twitter\.com)$/ },
  { id: "discord", color: "#5865f2", hosts: /(^|\.)(discord\.com|discord\.gg)$/ },
  { id: "telegram", color: "#26a5e4", hosts: /(^|\.)(telegram\.org|t\.me)$/ },
  { id: "twitch", color: "#9146ff", hosts: /(^|\.)twitch\.tv$/ },
  { id: "zalo", color: "#0068ff", hosts: /(^|\.)(zalo\.me|zalo\.com)$/ },
]

/** Match the hostname, so arbitrary URL text cannot impersonate a social brand. */
function brandOf(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return socialBrands.find((brand) => brand.hosts.test(host))
  } catch {
    return undefined
  }
}

const platformNames: Record<SocialBrand["id"], string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  discord: "Discord",
  telegram: "Telegram",
  twitch: "Twitch",
  zalo: "Zalo",
}

export const SOCIAL_PLATFORM_NAMES = [...Object.values(platformNames), "Website"]

/** The platform a link belongs to, recognized by its hostname. */
export function socialPlatformName(url: string) {
  const brand = brandOf(url)
  return brand && platformNames[brand.id]
}

export function SocialPlatformIcon({ url, size = 20 }: { url: string; size?: number }) {
  const brand = brandOf(url)
  if (!brand) return <Globe aria-hidden="true" size={size} />

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} style={{ overflow: "visible" }}>
      {brand.id === "tiktok" && (
        <>
          <path d={socialLogoPaths.tiktok} fill="#25f4ee" transform="translate(-0.6,-0.4)" />
          <path d={socialLogoPaths.tiktok} fill="#fe2c55" transform="translate(0.6,0.4)" />
        </>
      )}
      <path d={socialLogoPaths[brand.id]} fill={brand.color} />
    </svg>
  )
}
