import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { ProfileHistory } from "@aov/community-contracts"
import type { AchievementRank } from "@aov/community-contracts/achievements"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { RankBadge, medalOf } from "@aov/ui/components/rank-badge"
import { ReferenceText } from "../../../components/reference-text"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { competitionQuery } from "../../../lib/tournament-api"
import { dayRange, formatDay } from "../../../components/community-ui"
import { achievementMark } from "../model/achievement-mark"
import type { AchievementGroup, CompetitionLinks } from "../model/profile-records-model"

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

/** Words of a step that open a page the step records, or that link what they name when it records none. */
function StepWords({ to, words, about }: { to: string | null | undefined; words: string; about?: string }) {
  return to ? <Link to={to}>{words}</Link> : <ReferenceText text={words} about={about ? [about] : undefined} />
}

/**
 * A step's competition, read by its id, opens it once the read shows it is published; until then, or when it is not,
 * the words open `fallback` or what they name. The read is the one the competition's own page makes, so opening it is
 * quick.
 */
function PublishedCompetitionLink({
  id,
  fallback,
  words,
  about,
}: {
  id: string
  fallback: string | null
  words: string
  about?: string
}) {
  const competition = useQuery({ ...competitionQuery(id), retry: false, retryOnMount: false })
  return <StepWords to={competition.data ? `/competitions/${id}` : fallback} words={words} about={about} />
}

/** History rows shown at first and added each time the reader reaches the end of the list. */
const HISTORY_STEP = 20

/**
 * Career steps and milestones as rows, revealed as the reader scrolls. A step names a competition, which opens it when
 * it is published here, and often a team after " · ", which opens the page the step relates to. A step that records
 * its competition's id is matched by that id only; one that does not is matched by name or dates. Words that open
 * nothing so link the records they name; `about` is the page the steps belong to, which they never link.
 */
export function HistoryRows({
  items,
  links,
  about,
}: {
  items: ProfileHistory[]
  links?: CompetitionLinks
  about?: string
}) {
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
          const dates = item.startsOn || item.endsOn ? dayRange(item.startsOn, item.endsOn) : null
          return (
            <li key={index}>
              <div className="pf-row-text">
                <strong>
                  {item.tournamentId && !known ? (
                    <PublishedCompetitionLink
                      id={item.tournamentId}
                      fallback={eventFallback}
                      words={event}
                      about={about}
                    />
                  ) : (
                    <StepWords
                      to={competition ? `/competitions/${competition}` : eventFallback}
                      words={event}
                      about={about}
                    />
                  )}
                  {party && (
                    <>
                      <i> · </i>
                      <StepWords to={related} words={party} about={about} />
                    </>
                  )}
                </strong>
                {item.role && (
                  <span>
                    <StepWords to={party ? null : related} words={item.role} about={about} />
                  </span>
                )}
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
