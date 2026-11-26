import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import type { RosterMembershipContent } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { regionName } from "../../../components/community-ui"
import { FoldButton } from "../../../components/fold-button"
import { MatchCard } from "../../../components/match-card"
import { useSections } from "../../../components/place-trail"
import { PageHead, type HeadFigure } from "../../../components/page-head"
import { PlayerMark } from "../../../components/player-mark"
import { EntityPageLink } from "../../../components/go-link"
import { RegionMark } from "../../../components/region-mark"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { TeamLineup } from "../../../components/team-lineup"
import { TitleShelf } from "../../../components/title-shelf"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { matchStrip } from "../../../lib/competition-model"
import { competitionLineup } from "../../../lib/lineup-model"
import { isTitleSeason, teamProfile, type TeamProfile } from "../../../lib/participant-model"
import { competitionQuery, teamCompetitionsQuery } from "../../../lib/tournament-api"
import { LANE_NAMES, LANES } from "../../../lib/tournament-model"
import { useNow } from "../../../lib/use-now"
import { TeamStaff } from "../components/competition-people"
import { FormMarks } from "../components/form-marks"
import { ParticipantMissing, Part, SeasonLine, ShelfPart } from "../components/participant-parts"
import "../../../components/participant-list.css"
import { teamForm } from "../../../lib/standings-model"

/** Seasons shown before the rest unfold. */
const SEASONS = 12

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
  const { explore } = useSections()
  const now = useNow()
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { team, seasons, titles, won, lost } = profile
  const region = regionName(team.country, languageTag)
  const entries = seasons.flatMap((season) => season.entries)
  const strip = matchStrip(entries, now, 4, layout === "compact" ? 4 : 8).slice(0, layout === "compact" ? 4 : 8)
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  const figures: HeadFigure[] = [
    ...(titles
      ? [{ value: String(titles), label: text("lần vô địch", titles === 1 ? "title" : "titles"), title: true }]
      : []),
    { value: String(seasons.length), label: text("giải đã tham gia", "tournaments played") },
    ...(won + lost ? [{ value: `${won}–${lost}`, label: text("thắng – thua", "won – lost") }] : []),
  ]
  const marks = teamForm(entries, id)
  return (
    <>
      <PageHead
        tint={team.name}
        lights={[{ src: team.logoUrl, darkSrc: team.logoDarkUrl, at: "left" }]}
        places={[explore, { to: "/explore?kind=TEAM", name: text("Đội tuyển", "Teams") }]}
        mark={
          <span className="pt-mark">
            <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
          </span>
        }
        kicker={
          <>
            {team.shortName && team.shortName !== team.name && team.shortName}
            {region && (
              <>
                {team.shortName && team.shortName !== team.name && " · "}
                <RegionMark code={team.country} size={18} /> {region}
              </>
            )}
          </>
        }
        name={team.name}
        title={team.name}
        smallMark={
          <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
        }
        lines={
          marks.length > 0 && (
            <p className="ph-line">
              <span>{text("Gần đây", "Lately")}</span>
              <FormMarks marks={marks} />
            </p>
          )
        }
        figures={figures}
      />
      <TeamSquad id={id} profile={profile} />
      <ShelfPart titles={seasons.filter(isTitleSeason)}>
        {(shelf) => (
          <TitleShelf
            titles={shelf}
            views={seasons.map((season) => season.view)}
            name={team.name}
            logoUrl={team.logoUrl}
            logoDarkUrl={team.logoDarkUrl}
          />
        )}
      </ShelfPart>
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
        <FoldButton
          fold={{ folds: seasons.length > SEASONS, open, toggle: () => setOpen(!open) }}
          more={text(`Xem thêm ${seasons.length - SEASONS} giải`, `Show ${seasons.length - SEASONS} more`)}
        />
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
  const { rosters, players, teams, tournament, people } = query.data.content
  const squad = rosters.filter((row) => row.teamId === id).sort((a, b) => order(a) - order(b))
  if (!squad.length) return null
  const note = <Link to={`/competitions/${newest.id}?tab=teams`}>{tournament.name}</Link>
  const lineup = competitionLineup([query.data], id)
  const others = lineup ? squad.filter((row) => !lineup.seats.some((seat) => seat.key === row.playerId)) : squad
  const list = others.length > 0 && (
    <ul className="pt-cards">
      {others.map((row) => {
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
  )
  const staff = <TeamStaff staff={tournament.staff} teamId={id} people={people} />
  if (!lineup)
    return (
      <Part title={text("Đội hình", "Squad")} note={note}>
        {list}
        {staff}
      </Part>
    )
  const team = teams[id]
  return (
    <TeamLineup seats={lineup.seats} logoUrl={team?.logoUrl} logoDarkUrl={team?.logoDarkUrl} note={note}>
      <div className="pt-others">
        {list}
        {staff}
      </div>
    </TeamLineup>
  )
}
