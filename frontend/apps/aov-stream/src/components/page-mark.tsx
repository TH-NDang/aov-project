import type { CSSProperties } from "react"
import { isIndividualProfile, type CommunityProfile, type ProfileKind } from "@aov/community-contracts"
import { hueOf } from "./community-ui"
import { PlayerMark } from "./player-mark"
import { ThemedLogo } from "./themed-logo"
import "./page-mark.css"

/**
 * A page's picture at any size: a team's or a circuit's logo on its plate, an organization's picture, a person's mark.
 * A page without a picture has its initials. The name beside it says whose it is.
 */
export function PageMark({
  kind,
  name,
  url,
  size,
}: {
  kind: ProfileKind
  name: string
  url?: string | null
  size: number
}) {
  if (!url && isIndividualProfile(kind)) return <PlayerMark name={name} size={size} round={kind === "PERSON"} />
  const style = { "--pm-size": `${size}px`, "--pm-hue": hueOf(name) } as CSSProperties
  if (url && (kind === "TEAM" || kind === "CIRCUIT"))
    return (
      <span className="pm" data-logo="" style={style}>
        <ThemedLogo src={url} />
      </span>
    )
  return (
    <span className="pm" data-initials={!url || undefined} style={style} aria-hidden={!url || undefined}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : name.slice(0, 2).toLocaleUpperCase("vi-VN")}
    </span>
  )
}

export function ProfileMark({ profile, size }: { profile: CommunityProfile; size: number }) {
  return (
    <PageMark
      kind={profile.kind}
      name={profile.content?.name || profile.code}
      url={profile.content?.avatarUrl}
      size={size}
    />
  )
}
