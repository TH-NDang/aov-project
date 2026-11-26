import { Link } from "react-router"
import type { ProfileMember } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { CaptainBadge } from "../../../components/captain-badge"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { dayRange } from "../../../components/community-ui"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { memberWords, STANDING_NAMES, type RosterGroup } from "../model/team-roster-model"
import "./team-roster.css"

/**
 * Members of a team by their standing, a row each: lane, name, role. `titled` gives the list a heading of its own where
 * no lineup stands above it; `roster` is the whole roster, for its sources.
 */
export function TeamRoster({
  groups,
  roster,
  season,
  titled = false,
}: {
  groups: RosterGroup[]
  roster: ProfileMember[]
  season?: string | null
  titled?: boolean
}) {
  const { text } = useStreamLocale()
  const sources = [...new Set(roster.map((member) => member.sourceUrl).filter(Boolean))] as string[]
  const list = (
    <div className="rs">
      {groups.length > 0 && (
        <div className="rs-groups">
          {groups.map(({ standing, rows }) => (
            <section key={standing ?? "members"}>
              <h3>
                {standing ? text(...STANDING_NAMES[standing]) : text("Thành viên", "Members")}
                <small>{rows.length}</small>
              </h3>
              <ul>
                {rows.map(({ member, note, bench }, index) => {
                  const lane = member.lane
                  const dates = member.startsOn || member.endsOn ? dayRange(member.startsOn, member.endsOn) : ""
                  const detail = [note, dates].filter(Boolean).join(" · ")
                  const { role, captain } = memberWords(member, text)
                  return (
                    <li key={index} data-bench={bench || undefined}>
                      <span className="rs-mark">
                        {lane ? (
                          <HeroLaneIcon lane={lane} size={18} label={text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])} />
                        ) : (
                          <StreamIcon name="user" size={16} />
                        )}
                      </span>
                      <span className="rs-name">
                        {member.pageId ? <Link to={`/pages/${member.pageId}`}>{member.name}</Link> : member.name}
                        {captain && <CaptainBadge />}
                        {detail && <small>{detail}</small>}
                      </span>
                      <small title={member.role}>{role}</small>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <p className="rs-sources">
          {sources.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              {text("Nguồn đối chiếu", "Reference source")}
              {sources.length > 1 && ` ${index + 1}`}
              <StreamIcon name="external" size={13} />
            </a>
          ))}
        </p>
      )}
    </div>
  )
  if (!titled) return list
  return (
    <section aria-labelledby="profile-roster">
      <div className="tn-heading">
        <h2 id="profile-roster">
          {text("Đội hình", "Roster")} {season && <small>{season}</small>}
        </h2>
      </div>
      {list}
    </section>
  )
}
