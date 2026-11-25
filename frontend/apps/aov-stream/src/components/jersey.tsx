import type { CSSProperties } from "react"
import type { Lane } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { hueOf } from "./community-ui"
import "./jersey.css"

/**
 * A player's jersey from the back, in the colours of the team's logo, with the lane where the number would be. Nobody
 * has a photo here, so a lineup is its jerseys. A player without a lane wears the first letter of the nickname, and one
 * without a team a hue of it. The name beside it says whose it is.
 */
export function Jersey({
  name,
  lane,
  logoUrl,
  logoDarkUrl,
  size,
}: {
  name: string
  lane?: Lane | null
  logoUrl?: string | null
  logoDarkUrl?: string | null
  /** Its width in pixels, or any CSS length. */
  size: number | string
}) {
  const dye = logoDarkUrl || logoUrl
  const letter = [...name.replace(/[^\p{L}\p{N}]/gu, "")][0] ?? "?"
  return (
    <span
      className="jersey"
      data-dyed={!!dye || undefined}
      style={
        { "--jersey": typeof size === "number" ? `${size}px` : size, "--jersey-hue": hueOf(name) } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="jersey-cloth">{dye && <img src={dye} alt="" decoding="async" loading="lazy" />}</span>
      <svg viewBox="0 0 100 100" fill="none" strokeLinecap="round">
        <path className="jersey-seam" d="M38 5 22 36M62 5l16 31M22 92q28 5 56 0" />
        <path className="jersey-trim" d="M35.5 3.4Q50 9.6 64.5 3.4M15.8 39.6 3.6 26.4M84.2 39.6l12.2-13.2" />
      </svg>
      <span className="jersey-number">{lane ? <HeroLaneIcon lane={lane} /> : letter.toLocaleUpperCase("vi-VN")}</span>
    </span>
  )
}
