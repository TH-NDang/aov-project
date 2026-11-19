import { useState } from "react"
import { Link } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { CommunityProfile, CompetitionView } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import { CompetitionCard } from "./competition-card"
import { matchWinner } from "../lib/competition-model"
import { MatchCard } from "./match-card"
import { competitionMatches, type CompetitionMatch } from "../lib/match-model"
import { communityApi } from "../lib/community-api"
import { communityKeys } from "../lib/community-keys"
import { competitionsFeedQuery, dayRange, profileCompetitionFilter } from "./community-ui"

/**
 * The published competitions of a circuit (its seasons) or of an organizer, loading as the reader scrolls. `title`
 * heads the list where the tab around it does not already name it.
 */
export function CompetitionList({ profile, title }: { profile: CommunityProfile; title?: string }) {
  const { text, languageTag } = useStreamLocale()
  const filter = profileCompetitionFilter(profile)
  const query = useInfiniteQuery({ ...competitionsFeedQuery(filter || {}), enabled: !!filter })
  const competitions = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.totalElements
  const seasons = profile.kind === "CIRCUIT"
  return (
    <section
      aria-label={title ? undefined : text("Giải đấu", "Tournaments")}
      aria-labelledby={title ? "profile-competitions" : undefined}
    >
      {title && (
        <div className="tn-heading">
          <h2 id="profile-competitions">
            {title} {!!total && <small>{total.toLocaleString(languageTag)}</small>}
          </h2>
        </div>
      )}
      {query.isPending ? (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải giải đấu", "Loading tournaments")}
        />
      ) : query.isLoadingError ? (
        <div className="hub-state" role="alert">
          {title ? (
            <h3>{text("Chưa tải được giải đấu", "Tournaments could not be loaded")}</h3>
          ) : (
            <h2>{text("Chưa tải được giải đấu", "Tournaments could not be loaded")}</h2>
          )}
          <p>{query.error.message}</p>
          <button type="button" className="cp-button" onClick={() => void query.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : !competitions.length ? (
        <p className="pf-note">
          {seasons
            ? text(
                "Hệ thống giải này chưa có mùa nào được công bố.",
                "No season of this circuit has been published yet.",
              )
            : text(
                "Chưa có giải đấu nào của tổ chức được công bố.",
                "No tournament of this organization has been published yet.",
              )}
        </p>
      ) : (
        <div className="tn-card-grid">
          {competitions.map((entry) => (
            <CompetitionCard key={entry.id} entry={entry} within={seasons ? profile.content?.name : null} />
          ))}
        </div>
      )}
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm giải đấu", "Loading more tournaments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </section>
  )
}

/** A team's or a player's name, linked to its page once that page is published. */
export function EntityPageLink({ kind, id, name }: { kind: "TEAM" | "PLAYER"; id: string; name: string }) {
  const page = useQuery({
    queryKey: communityKeys.entityPage(kind, id),
    queryFn: () => communityApi.pageByEntity(kind, id),
    retry: false,
    staleTime: 60000,
  })
  return page.data ? <Link to={`/pages/${page.data.code}`}>{name}</Link> : <span>{name}</span>
}

/** The registry teams a page plays as in one competition: the team itself, or the squads that registered a player. */
function profileTeams(profile: CommunityProfile, view: CompetitionView) {
  if (profile.kind === "TEAM") return [profile.entityId]
  if (profile.kind === "PLAYER")
    return view.content.rosters.filter((row) => row.playerId === profile.entityId).map((row) => row.teamId)
  return null
}

const sides = (entry: CompetitionMatch) => ({
  a: entry.result?.teamAId || entry.match.a.teamId,
  b: entry.result?.teamBId || entry.match.b.teamId,
})

/**
 * The matches of the given competitions that concern a page: those its team plays, or for an organizer every match
 * of what it organizes.
 */
export function profileMatches(profile: CommunityProfile, views: CompetitionView[]) {
  return views.flatMap((view) => {
    const teams = profileTeams(profile, view)
    const entries = competitionMatches([view])
    return teams ? entries.filter((entry) => teams.includes(sides(entry).a) || teams.includes(sides(entry).b)) : entries
  })
}

const startOf = (entry: CompetitionMatch) => Date.parse(entry.match.scheduledAt || "") || 0

/**
 * A team's or a player's matches, one block per competition with the newest first. Competitions the page is
 * registered in without a match of its own close the list as cards.
 */
export function ProfileCompetitionSummary({ profile }: { profile: CommunityProfile }) {
  const { text } = useStreamLocale()
  const filter = profileCompetitionFilter(profile)
  const query = useInfiniteQuery({ ...competitionsFeedQuery(filter || {}), enabled: !!filter })
  const views = query.data?.pages.flatMap((page) => page.items) ?? []
  const blocks = views.map((view) => ({
    view,
    entries: profileMatches(profile, [view]).sort((a, b) => startOf(b) - startOf(a)),
  }))
  const played = blocks.filter((block) => block.entries.length)
  const idle = blocks.filter((block) => !block.entries.length)
  if (query.isPending)
    return (
      <div
        className="hub-skeleton-rows"
        role="status"
        aria-label={text("Đang tải lịch và kết quả", "Loading schedule and results")}
      />
    )
  if (query.isLoadingError)
    return (
      <div className="hub-state" role="alert">
        <h2>{text("Chưa tải được lịch và kết quả", "The schedule and results could not be loaded")}</h2>
        <p>{query.error.message}</p>
        <button type="button" className="cp-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    )
  if (!views.length)
    return <p className="pf-note">{text("Trang này chưa có giải đấu nào.", "This page has no tournaments yet.")}</p>
  return (
    <>
      {profile.kind === "PLAYER" && (
        <p className="pf-note">
          {text(
            "Các trận của đội có tuyển thủ trong danh sách đăng ký mùa giải. Danh sách này không khẳng định tuyển thủ đã ra sân từng trận.",
            "Matches of the teams that registered the player for the season. This list does not confirm that the player played in each match.",
          )}
        </p>
      )}
      {played.map(({ view, entries }) => (
        <CompetitionMatches
          key={view.id}
          view={view}
          entries={entries}
          team={profile.kind === "TEAM" ? profile.entityId : null}
        />
      ))}
      {idle.length > 0 && (
        <section aria-labelledby="profile-idle">
          <div className="tn-heading">
            <h2 id="profile-idle">
              {text("Chưa có lịch của đội", "No team schedule yet")}{" "}
              <small>
                {text(`${idle.length} giải`, `${idle.length} ${idle.length === 1 ? "tournament" : "tournaments"}`)}
              </small>
            </h2>
          </div>
          <div className="tn-card-grid">
            {idle.map(({ view }) => (
              <CompetitionCard key={view.id} entry={view} />
            ))}
          </div>
        </section>
      )}
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm giải đấu", "Loading more tournaments")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </>
  )
}

/**
 * One competition's matches of a page, newest first: the latest fill a row (two on a compact layout, where a match
 * takes a row of its own) and the rest unfold. `team` adds that team's record to the heading.
 */
function CompetitionMatches({
  view,
  entries,
  team,
}: {
  view: CompetitionView
  entries: CompetitionMatch[]
  team?: string | null
}) {
  const { text } = useStreamLocale()
  const [open, setOpen] = useState(false)
  const preview = usePageLayout() === "compact" ? 2 : 4
  const { tournament } = view.content
  const record = team ? matchRecord(entries, team) : null
  const shown = open ? entries : entries.slice(0, preview)
  return (
    <section>
      <div className="tn-heading">
        <h2>
          <Link to={`/competitions/${view.id}`}>{tournament.name}</Link>{" "}
          <small>
            {dayRange(tournament.startsOn, tournament.endsOn, text("Chờ lịch", "To be scheduled"))}
            {record && ` · ${record}`}
          </small>
        </h2>
      </div>
      <div className="tn-match-grid">
        {shown.map((entry) => (
          <MatchCard key={entry.match.key} entry={entry} brief />
        ))}
      </div>
      {entries.length > preview && (
        <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open
            ? text("Thu gọn", "Show less")
            : text(
                `Xem thêm ${entries.length - preview} trận`,
                `Show ${entries.length - preview} more ${entries.length - preview === 1 ? "match" : "matches"}`,
              )}
          <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
        </button>
      )}
    </section>
  )
}

/** Wins and losses of one team over decided matches, or null when none is decided yet. */
function matchRecord(entries: CompetitionMatch[], team: string) {
  let won = 0
  let lost = 0
  for (const entry of entries) {
    const winner = matchWinner(entry)
    if (!winner) continue
    if (sides(entry)[winner] === team) won += 1
    else lost += 1
  }
  return won + lost ? `${won} thắng – ${lost} thua` : null
}
