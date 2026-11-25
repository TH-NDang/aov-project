import type { ComponentProps } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import {
  isCommunityProfile,
  isIndividualProfile,
  profileKindLabels,
  type CommunityProfile,
} from "@aov/community-contracts"
import { profileKindEnglish } from "../../../components/community-ui"
import { OfficialName } from "../../../components/official-name"
import { PageHead } from "../../../components/page-head"
import { ProfileMark } from "../../../components/page-mark"
import { useSections, type Place } from "../../../components/place-trail"
import type { StageLight } from "../../../components/stage"
import { useStreamLocale } from "../../../components/stream-locale"
import "./community.css"

/**
 * The head of a community page, under its kind in Explore, lit by its cover or its picture. `mark` replaces the picture,
 * for a player's jersey; `lights` names the logos that light a page whose own picture cannot.
 */
export function ProfileHead({
  profile,
  mark,
  lights,
  places,
  ...head
}: {
  profile: CommunityProfile
  mark?: ComponentProps<typeof PageHead>["mark"]
  lights?: StageLight[]
  places?: Place[]
} & Omit<
  ComponentProps<typeof PageHead>,
  "tint" | "lights" | "coverUrl" | "mark" | "smallMark" | "live" | "name" | "title" | "places"
>) {
  const { text } = useStreamLocale()
  const { explore } = useSections()
  const compact = usePageLayout() === "compact"
  const { name, avatarUrl, coverUrl } = profile.content!
  const own: StageLight[] = coverUrl
    ? [{ src: coverUrl, at: "center" }]
    : isIndividualProfile(profile.kind)
      ? []
      : [{ src: avatarUrl, at: "left" }]
  return (
    <PageHead
      {...head}
      places={
        places ?? [
          explore,
          {
            to: `/explore?kind=${profile.kind}`,
            name: text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind]),
          },
        ]
      }
      title={name}
      smallMark={<ProfileMark profile={profile} size={28} />}
      tint={name}
      lights={lights ?? own}
      coverUrl={coverUrl}
      mark={mark || <ProfileMark profile={profile} size={compact ? 72 : 132} />}
      live={!!profile.live}
      name={<OfficialName name={name} official={profile.represented && isCommunityProfile(profile.kind)} />}
    />
  )
}
