import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { Lane, RosterMembershipContent } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { regionName } from "../../../components/community-ui"
import { MatchCard } from "../../../components/match-card"
import { PlayerMark } from "../../../components/player-mark"
import { EntityPageLink } from "../../../components/go-link"
import { RegionMark } from "../../../components/region-mark"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { matchStrip } from "../../../lib/competition-model"
import { teamProfile, type TeamProfile } from "../../../lib/participant-model"
import { competitionQuery, teamCompetitionsQuery } from "../../../lib/tournament-api"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { useNow } from "../../../lib/use-now"
import { TeamStaff } from "../components/competition-people"
import { FormMarks } from "../components/form-marks"
import { ParticipantMissing, Part, SeasonLine } from "../components/participant-parts"
import "../../../components/participant-list.css"
import { teamForm } from "../../../lib/standings-model"

/** Seasons shown before the rest unfold. */
const SEASONS = 12
const LANES: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]

/**
 * A team as the published competitions show it: its squad, its matches and what it has won. A team with a published
 * page of its own opens there instead.
 */
export function TeamPage() {
  const { id = "" } = useParams()
  const { text } = useStreamLocale()
  const page = useQuery({
    queryKey: communityKeys.entityPage("TEAM", id),
    queryFn: () => communityApi.pageByEntity("TEAM", id),
    retry: false,
    staleTime: 60_000,
  })
  const competitions = useQuery(teamCompetitionsQuery(id))
  if (page.data) return <Navigate to={`/pages/${page.data.code}`} replace />
  const profile = competitions.data ? teamProfile(competitions.data, id) : null
  return (
    <StreamShell>
      <title>
        {profile
          ? text(`${profile.team.name} — Đội tuyển · AOV Stream`, `${profile.team.name} — Team · AOV Stream`)
          : text("Đội tuyển — AOV Stream", "Team — AOV Stream")}
      </title>
      <div className="cp-container pt-page">
        <Link className="cp-back" data-flush="" to="/explore?kind=TEAM">
          <StreamIcon name="back" size={16} />
          {text("Đội tuyển", "Teams")}
        </Link>
        {competitions.isPending || page.isPending ? (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải đội tuyển", "Loading the team")}
          />
        ) : competitions.isError ? (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa tải được đội tuyển", "The team could not be loaded")}</h1>
            <p>{competitions.error.message}</p>
            <button type="button" className="cp-button" onClick={() => void competitions.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : profile ? (
          <TeamContent id={id} profile={profile} />
        ) : (
          <ParticipantMissing
            title={text("Đội tuyển chưa có giải được công bố", "The team has no published tournament yet")}
            back={text("Xem các đội tuyển", "See teams")}
            to="/explore?kind=TEAM"
          />
        )}
      </div>
    </StreamShell>
  )
}

function TeamContent({ id, profile }: { id: string; profile: TeamProfile }) {
  const { text, languageTag } = useStreamLocale()
  const now = useNow()
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { team, seasons, titles, won, lost } = profile
  const region = regionName(team.country, languageTag)
  const entries = seasons.flatMap((season) => season.entries)
  const strip = matchStrip(entries, now, 4, layout === "compact" ? 4 : 8).slice(0, layout === "compact" ? 4 : 8)
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  const facts: [string, string][] = [
    [text("giải", "tournaments"), String(seasons.length)],
    ...(won + lost ? ([[text("thắng – thua", "won – lost"), `${won}–${lost}`]] as [string, string][]) : []),
    ...(titles ? ([[text("danh hiệu", "titles"), String(titles)]] as [string, string][]) : []),
  ]
  return (
    <>
      <Stage tint={team.name} lights={[{ src: team.logoUrl, darkSrc: team.logoDarkUrl, at: "left" }]}>
        <header className="pt-head">
          <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
          <div className="pt-head-text">
            <p>
              {team.shortName && team.shortName !== team.name && <span>{team.shortName}</span>}
              {region && (
                <span>
                  <RegionMark code={team.country} />
                  {region}
                </span>
              )}
              <FormMarks marks={teamForm(entries, id)} />
            </p>
            <h1>{team.name}</h1>
            <dl className="pt-head-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dd>{value}</dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </header>
      </Stage>
      <TeamSquad id={id} profile={profile} />
      {strip.length > 0 && (
        <Part title={text("Trận đấu", "Matches")}>
          <div className="tn-match-grid">
            {strip.map((entry) => (
              <MatchCard key={`${entry.competition.id}:${entry.match.key}`} entry={entry} context />
            ))}
          </div>
        </Part>
      )}
      <Part title={text("Giải đã tham dự", "Tournaments played")} note={seasons.length.toLocaleString(languageTag)}>
        <ul className="pt-seasons">
          {shown.map(({ view, place, record }) => (
            <SeasonLine key={view.id} view={view} place={place}>
              {record.played > 0 &&
                text(`${record.won} thắng, ${record.lost} thua`, `${record.won} won, ${record.lost} lost`)}
            </SeasonLine>
          ))}
        </ul>
        {seasons.length > SEASONS && (
          <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open
              ? text("Thu gọn", "Show less")
              : text(`Xem thêm ${seasons.length - SEASONS} giải`, `Show ${seasons.length - SEASONS} more`)}
            <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
          </button>
        )}
      </Part>
    </>
  )
}

const order = (row: RosterMembershipContent) =>
  (row.status === "ACTIVE" ? 0 : 10) + (row.lane ? LANES.indexOf(row.lane) : 9)

/** The squad of the newest competition the team stands in, with its staff there. */
function TeamSquad({ id, profile }: { id: string; profile: TeamProfile }) {
  const { text } = useStreamLocale()
  const newest = profile.seasons[0]!.view
  const query = useQuery(competitionQuery(newest.id))
  if (!query.data) return null
  const { rosters, players, tournament, people } = query.data.content
  const squad = rosters.filter((row) => row.teamId === id).sort((a, b) => order(a) - order(b))
  if (!squad.length) return null
  return (
    <Part
      title={text("Đội hình", "Squad")}
      note={<Link to={`/competitions/${newest.id}?tab=teams`}>{tournament.name}</Link>}
    >
      <ul className="pt-cards">
        {squad.map((row) => {
          const name = players[row.playerId]?.nickname || text("Tuyển thủ", "Player")
          return (
            <li key={`${row.playerId}:${row.lane}`} className="pt-card">
              <PlayerMark name={name} lane={row.lane} size={44} />
              <span className="pt-card-text">
                <EntityPageLink kind="PLAYER" id={row.playerId} name={name} plain />
                <small>
                  {row.status === "SUBSTITUTE"
                    ? text("Dự bị", "Substitute")
                    : row.lane
                      ? text(LANE_NAMES[row.lane][0], LANE_NAMES[row.lane][1])
                      : text("Chưa rõ vị trí", "Unknown position")}
                </small>
              </span>
            </li>
          )
        })}
      </ul>
      <TeamStaff staff={tournament.staff} teamId={id} people={people} />
    </Part>
  )
}
