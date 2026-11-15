import type { ReactNode } from "react"
import { Link } from "react-router"
import type { CompetitionView, Lane, ProfileAchievement, ProfileHistory, ProfileMember } from "@aov/community-contracts"
import { HeroLaneIcon } from "@aov/ui/components/hero-lane-icon"
import { StreamIcon } from "../../components/stream-icon"
import { LANES } from "../tournaments/tournament-model"
import { dayRange, formatDay } from "./community-ui"

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim()

/**
 * Finds the published competition a record of a page speaks of, so its name can open it. Records carry a competition's
 * id only sometimes; a career step names it, and is matched by that name or by sharing both its dates with exactly
 * one competition the page took part in.
 */
export function competitionLinks(views: CompetitionView[]) {
  const names = new Map(views.map((view) => [view.id, view.content.tournament.name]))
  const byName = new Map(views.map((view) => [fold(view.content.tournament.name), view.id]))
  const byDates = new Map<string, string | null>()
  for (const view of views) {
    const { startsOn, endsOn } = view.content.tournament
    if (!startsOn || !endsOn) continue
    const key = `${startsOn.slice(0, 10)}|${endsOn.slice(0, 10)}`
    byDates.set(key, byDates.has(key) ? null : view.id)
  }
  return {
    /** The published name of a competition, when it is one of these. */
    name: (id?: string | null) => (id ? names.get(id) : undefined),
    find: (title: string, startsOn?: string | null, endsOn?: string | null) =>
      byName.get(fold(title)) ??
      (startsOn && endsOn ? (byDates.get(`${startsOn.slice(0, 10)}|${endsOn.slice(0, 10)}`) ?? undefined) : undefined),
  }
}

export type CompetitionLinks = ReturnType<typeof competitionLinks>

function SourceLink({ url }: { url: string }) {
  return (
    <a
      className="pf-row-source"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Nguồn đối chiếu"
      title="Nguồn đối chiếu"
    >
      <StreamIcon name="external" size={14} />
    </a>
  )
}

// ---------- Achievements ----------

export type AchievementGroup = {
  key: string
  title: string
  competitionId?: string
  date?: string | null
  placements: string[]
  sourceUrl?: string | null
}

/**
 * A page's placements and awards, one entry per competition and newest first. Sources often list the same result
 * twice, under the competition's English and Vietnamese names; an id shared by both makes them one.
 */
export function achievementGroups(items: ProfileAchievement[], links: CompetitionLinks): AchievementGroup[] {
  const groups = new Map<string, AchievementGroup>()
  for (const item of items) {
    const key = item.tournamentId || `${fold(item.title)}|${item.date || ""}`
    const group = groups.get(key) ?? {
      key,
      title: links.name(item.tournamentId) || item.title,
      competitionId: links.name(item.tournamentId) ? item.tournamentId! : undefined,
      date: item.date,
      placements: [],
      sourceUrl: item.sourceUrl,
    }
    if (!group.placements.includes(item.placement)) group.placements.push(item.placement)
    if ((item.date || "") > (group.date || "")) group.date = item.date
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
}

/** How many distinct results the groups hold, which is what the page counts as its achievements. */
export const achievementCount = (groups: AchievementGroup[]) =>
  groups.reduce((sum, group) => sum + group.placements.length, 0)

/** A final standing reads as a number in the row's mark; anything else is an award. */
function placementRank(placement: string) {
  const text = placement.trim().toLowerCase()
  if (text === "vô địch") return 1
  if (text === "á quân") return 2
  const rank = /^hạng\s*(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(text)
  return rank ? { from: Number(rank[1]), to: rank[2] ? Number(rank[2]) : null } : null
}

function PlacementMark({ placements }: { placements: string[] }) {
  const ranks = placements.map(placementRank).filter((rank) => rank != null)
  const best = ranks.sort((a, b) => (typeof a === "number" ? a : a.from) - (typeof b === "number" ? b : b.from))[0]
  if (best === 1)
    return (
      <span className="pf-row-mark" data-mark="champion">
        <StreamIcon name="trophy" size={15} />
      </span>
    )
  if (best == null)
    return (
      <span className="pf-row-mark" data-mark="award">
        <StreamIcon name="spark" size={14} />
      </span>
    )
  return (
    <span className="pf-row-mark" aria-hidden="true">
      {typeof best === "number" ? best : best.to ? `${best.from}–${best.to}` : best.from}
    </span>
  )
}

/** Achievements as rows: the competition, linked when it is published here, with what was won in it. */
export function AchievementRows({ groups }: { groups: AchievementGroup[] }) {
  return (
    <ol className="pf-rows" data-marked="">
      {groups.map((group) => (
        <li key={group.key}>
          <PlacementMark placements={group.placements} />
          <div className="pf-row-text">
            <strong>
              {group.competitionId ? (
                <Link to={`/competitions/${group.competitionId}`}>{group.title}</Link>
              ) : (
                group.title
              )}
            </strong>
            <span>{group.placements.join(", ")}</span>
          </div>
          {group.date && (
            <time className="pf-row-date" dateTime={group.date.slice(0, 10)}>
              {formatDay(group.date)}
            </time>
          )}
          {group.sourceUrl && <SourceLink url={group.sourceUrl} />}
        </li>
      ))}
    </ol>
  )
}

// ---------- Career and history ----------

/**
 * A page's history without the steps its sources repeat: the same dates and the same role under a competition's
 * English and Vietnamese names are one step, kept in the form that names its page.
 */
export function distinctHistory(items: ProfileHistory[]) {
  const seen = new Map<string, ProfileHistory>()
  const steps: ProfileHistory[] = []
  for (const item of items) {
    const key = item.startsOn && item.endsOn ? `${item.startsOn}|${item.endsOn}|${fold(item.role || "")}` : null
    const earlier = key ? seen.get(key) : undefined
    if (!earlier) {
      if (key) seen.set(key, item)
      steps.push(item)
    } else if (!earlier.relatedPageId && item.relatedPageId) {
      steps[steps.indexOf(earlier)] = item
      seen.set(key!, item)
    }
  }
  return steps
}

/**
 * Career steps and milestones as rows. A step names a competition, which opens it when it is published here, and
 * often a team after " · ", which opens the page the step relates to.
 */
export function HistoryRows({ items, links }: { items: ProfileHistory[]; links?: CompetitionLinks }) {
  return (
    <ol className="pf-rows">
      {items.map((item, index) => {
        const [event = item.title, ...rest] = item.title.split(" · ")
        const party = rest.join(" · ")
        const related = item.relatedPageId ? `/pages/${item.relatedPageId}` : null
        const competition = links?.find(event, item.startsOn, item.endsOn)
        const linked = (to: string | null | undefined, text: ReactNode) => (to ? <Link to={to}>{text}</Link> : text)
        const dates = item.startsOn || item.endsOn ? dayRange(item.startsOn, item.endsOn) : null
        return (
          <li key={index}>
            <div className="pf-row-text">
              <strong>
                {linked(competition ? `/competitions/${competition}` : !party && !item.role ? related : null, event)}
                {party && (
                  <>
                    <i> · </i>
                    {linked(related, party)}
                  </>
                )}
              </strong>
              {item.role && <span>{party ? item.role : linked(related, item.role)}</span>}
            </div>
            {dates && <span className="pf-row-date">{dates}</span>}
            {item.sourceUrl && <SourceLink url={item.sourceUrl} />}
          </li>
        )
      })}
    </ol>
  )
}

// ---------- Roster ----------

const laneWords: [Lane, RegExp][] = [
  ["TOP", /tà thần|caesar/i],
  ["JUNGLE", /rừng/i],
  ["MID", /giữa/i],
  ["DRAGON", /rồng/i],
  ["SUPPORT", /trợ thủ|hỗ trợ/i],
]

/** The lane a written role speaks of, for its icon; coaches and analysts have none. */
const laneOfRole = (role: string) => laneWords.find(([, words]) => words.test(role))?.[0] ?? null

/**
 * A team's members grouped by their standing in the squad. A status reads "standing · note · season"; when every
 * member carries the same season it is returned once instead of on each row.
 */
function rosterGroups(roster: ProfileMember[]) {
  const parts = roster.map((member) => (member.status || "").split(" · ").filter(Boolean))
  const last = parts[0]?.at(-1)
  const season = last && parts.every((entry) => entry.length > 1 && entry.at(-1) === last) ? last : null
  const groups = new Map<string, { member: ProfileMember; note: string }[]>()
  roster.forEach((member, index) => {
    const [standing = "Thành viên", ...rest] = parts[index]!
    const note = (season ? rest.slice(0, -1) : rest).join(" · ")
    groups.set(standing, [...(groups.get(standing) || []), { member, note }])
  })
  return { season, groups: [...groups] }
}

/** The squad in the cards of a competition's team list: lane icon, member, role. */
export function TeamRoster({ roster }: { roster: ProfileMember[] }) {
  const { season, groups } = rosterGroups(roster)
  const sources = [...new Set(roster.map((member) => member.sourceUrl).filter(Boolean))] as string[]
  return (
    <section className="pf-roster" aria-labelledby="profile-roster">
      <div className="tn-heading">
        <h2 id="profile-roster">Đội hình {season && <small>{season}</small>}</h2>
      </div>
      <div className="tn-team-grid">
        {groups.map(([standing, members]) => (
          <section className="tn-team-card" key={standing}>
            <h3>
              {standing} <small>{members.length}</small>
            </h3>
            <ul>
              {members.map(({ member, note }, index) => {
                const lane = laneOfRole(member.role)
                const dates = member.startsOn || member.endsOn ? dayRange(member.startsOn, member.endsOn) : ""
                const detail = [note, dates].filter(Boolean).join(" · ")
                return (
                  <li key={index} data-bench={/dự bị|rời/i.test(standing) || undefined}>
                    <span className="tn-lane">
                      {lane ? (
                        <HeroLaneIcon lane={lane} size={18} label={LANES[lane]} />
                      ) : (
                        <StreamIcon name="user" size={16} />
                      )}
                    </span>
                    <span>
                      {member.pageId ? <Link to={`/pages/${member.pageId}`}>{member.name}</Link> : member.name}
                      {detail && <small>{detail}</small>}
                    </span>
                    <small>{member.role}</small>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {sources.map((url, index) => (
        <a key={url} className="pf-source" href={url} target="_blank" rel="noreferrer">
          Nguồn đối chiếu{sources.length > 1 && ` ${index + 1}`}
          <StreamIcon name="external" size={13} />
        </a>
      ))}
    </section>
  )
}
