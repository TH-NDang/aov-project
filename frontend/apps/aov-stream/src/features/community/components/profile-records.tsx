import type { ReactNode } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { CompetitionView, ProfileAchievement, ProfileHistory, ProfileMember } from "@aov/community-contracts"
import { achievementRank, type AchievementRank } from "@aov/community-contracts/achievements"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionQuery } from "../../../lib/tournament-api"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { dayRange, formatDay } from "../../../components/community-ui"
import { achievementMark } from "../model/achievement-mark"
import { memberWords, rosterGroups, STANDING_NAMES } from "../model/team-roster-model"
import { foldSearchText } from "@aov/ui/lib/search-text"

const fold = (value: string) => foldSearchText(value).trim()

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
  const { text } = useStreamLocale()
  return (
    <a
      className="pf-row-source"
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={text("Nguồn đối chiếu", "Reference source")}
      title={text("Nguồn đối chiếu", "Reference source")}
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
  /** The rank of every result in the group, stored or read from its wording. */
  ranks: AchievementRank[]
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
      ranks: [],
      sourceUrl: item.sourceUrl,
    }
    if (!group.placements.includes(item.placement)) group.placements.push(item.placement)
    group.ranks.push(achievementRank(item))
    if ((item.date || "") > (group.date || "")) group.date = item.date
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
}

/** How many distinct results the groups hold, which is what the page counts as its achievements. */
export const achievementCount = (groups: AchievementGroup[]) =>
  groups.reduce((sum, group) => sum + group.placements.length, 0)

/** The row's mark: a cup for the title, the best place as a number, or the sign of an award. */
function PlacementMark({ ranks }: { ranks: AchievementRank[] }) {
  const mark = achievementMark(ranks)
  if (mark.kind === "champion")
    return (
      <span className="pf-row-mark" data-mark="medal" aria-hidden="true">
        <RankBadge place="1" size={30} />
      </span>
    )
  if (mark.kind === "award")
    return (
      <span className="pf-row-mark" data-mark="award">
        <StreamIcon name="spark" size={14} />
      </span>
    )
  return (
    <span className="pf-row-mark" data-mark={medalOf(mark.text) ? "medal" : undefined} aria-hidden="true">
      <RankBadge place={mark.text} size={30} />
    </span>
  )
}

/** Achievements as rows: the competition, linked when it is published here, with what was won in it. */
export function AchievementRows({ groups }: { groups: AchievementGroup[] }) {
  return (
    <ol className="pf-rows" data-marked="">
      {groups.map((group) => (
        <li key={group.key}>
          <PlacementMark ranks={group.ranks} />
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
 * A step's competition, read by its id, opens it once the read shows it is published; until then, or when it is not,
 * the words open `fallback` or nothing. The read is the one the competition's own page makes, so opening it is quick.
 */
function PublishedCompetitionLink({
  id,
  fallback,
  children,
}: {
  id: string
  fallback: string | null
  children: ReactNode
}) {
  const competition = useQuery({ ...competitionQuery(id), retry: false, retryOnMount: false })
  const to = competition.data ? `/competitions/${id}` : fallback
  return to ? <Link to={to}>{children}</Link> : <>{children}</>
}

/** History rows shown at first and added each time the reader reaches the end of the list. */
const HISTORY_STEP = 20

/**
 * Career steps and milestones as rows, revealed as the reader scrolls. A step names a competition, which opens it when
 * it is published here, and often a team after " · ", which opens the page the step relates to. A step that records
 * its competition's id is matched by that id only; one that does not is matched by name or dates.
 */
export function HistoryRows({ items, links }: { items: ProfileHistory[]; links?: CompetitionLinks }) {
  const { text } = useStreamLocale()
  const revealed = useRevealedRows(items, String(items.length), HISTORY_STEP)
  return (
    <>
      <ol className="pf-rows">
        {revealed.rows.map((item, index) => {
          const [event = item.title, ...rest] = item.title.split(" · ")
          const party = rest.join(" · ")
          const related = item.relatedPageId ? `/pages/${item.relatedPageId}` : null
          // A competition among the page's own published ones needs no read of its own.
          const known = item.tournamentId && links?.name(item.tournamentId) ? item.tournamentId : undefined
          const competition = item.tournamentId ? known : links?.find(event, item.startsOn, item.endsOn)
          const eventFallback = !party && !item.role ? related : null
          const linked = (to: string | null | undefined, words: ReactNode) =>
            to ? <Link to={to}>{words}</Link> : words
          const dates = item.startsOn || item.endsOn ? dayRange(item.startsOn, item.endsOn) : null
          return (
            <li key={index}>
              <div className="pf-row-text">
                <strong>
                  {item.tournamentId && !known ? (
                    <PublishedCompetitionLink id={item.tournamentId} fallback={eventFallback}>
                      {event}
                    </PublishedCompetitionLink>
                  ) : (
                    linked(competition ? `/competitions/${competition}` : eventFallback, event)
                  )}
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
      <InfiniteScroll query={revealed.loader} label={text("Đang hiện thêm mốc", "Showing more milestones")} />
    </>
  )
}

// ---------- Roster ----------

/** The squad in the cards of a competition's team list: lane icon, member, role. */
export function TeamRoster({ roster }: { roster: ProfileMember[] }) {
  const { text } = useStreamLocale()
  const { season, groups } = rosterGroups(roster)
  const sources = [...new Set(roster.map((member) => member.sourceUrl).filter(Boolean))] as string[]
  return (
    <section className="pf-roster" aria-labelledby="profile-roster">
      <div className="tn-heading">
        <h2 id="profile-roster">
          {text("Đội hình", "Roster")} {season && <small>{season}</small>}
        </h2>
      </div>
      <div className="tn-team-grid">
        {groups.map(({ standing, rows }) => (
          <section className="tn-team-card" key={standing ?? "members"}>
            <h3>
              {standing ? text(...STANDING_NAMES[standing]) : text("Thành viên", "Members")}{" "}
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
                    <span className="tn-lane">
                      {lane ? (
                        <HeroLaneIcon lane={lane} size={18} label={text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])} />
                      ) : (
                        <StreamIcon name="user" size={16} />
                      )}
                    </span>
                    <span>
                      {member.pageId ? <Link to={`/pages/${member.pageId}`}>{member.name}</Link> : member.name}
                      {captain && (
                        <abbr className="pf-captain" title={captain} aria-label={captain}>
                          C
                        </abbr>
                      )}
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
      {sources.map((url, index) => (
        <a key={url} className="pf-source" href={url} target="_blank" rel="noreferrer">
          {text("Nguồn đối chiếu", "Reference source")}
          {sources.length > 1 && ` ${index + 1}`}
          <StreamIcon name="external" size={13} />
        </a>
      ))}
    </section>
  )
}
