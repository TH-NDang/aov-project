import type { ReactNode } from "react"
import { isCommunityProfile, isIndividualProfile, type CommunityProfile } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { Avatar } from "./community-ui"
import "./community.css"
import "./community-profile.css"

/**
 * Who a page is, straight on the page: logo or photo, the kind and region line, the name with its marks, one quiet
 * line of facts and the page's buttons. A cover picture shows above only when the page really has one.
 */
export function ProfileHead({
  profile,
  kicker,
  lines,
  facts,
  actions,
  channels,
}: {
  profile: CommunityProfile
  /** What the page is and where it is from. */
  kicker: ReactNode
  /** Rows between the name and the facts, such as a player's team. */
  lines?: ReactNode
  /** Short facts, already without the ones the page does not have. */
  facts: ReactNode[]
  actions?: ReactNode
  /** The page's channels as icons, where the reference column is not on screen. */
  channels?: ReactNode
}) {
  const content = profile.content!
  return (
    <header className="pf-head">
      {content.coverUrl && <img className="pf-cover" src={content.coverUrl} alt="" />}
      <div
        className="pf-identity"
        data-person={isIndividualProfile(profile.kind) || undefined}
        data-live={profile.live ? "" : undefined}
      >
        <Avatar profile={profile} />
        <div className="pf-title">
          <span className="hub-kicker">
            <span>{kicker}</span>
            {profile.live && <span className="tn-live">Trực tiếp</span>}
          </span>
          <h1>
            {content.name}
            {profile.represented && isCommunityProfile(profile.kind) && <OfficialBadge label="Đại diện đã xác minh" />}
          </h1>
          {lines}
          {facts.length > 0 && (
            <p className="pf-facts">
              <span>
                {facts.map((fact, index) => (
                  <span key={index}>{fact}</span>
                ))}
              </span>
            </p>
          )}
        </div>
        {actions && <div className="pf-actions">{actions}</div>}
      </div>
      {channels}
    </header>
  )
}
