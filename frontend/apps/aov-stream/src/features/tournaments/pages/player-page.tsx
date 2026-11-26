import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { regionName } from "../../../components/community-ui"
import { FoldButton } from "../../../components/fold-button"
import { GoLink } from "../../../components/go-link"
import { Jersey } from "../../../components/jersey"
import { useSections } from "../../../components/place-trail"
import { PageHead } from "../../../components/page-head"
import { RegionMark } from "../../../components/region-mark"
import { MvpBadge } from "../../../components/mvp-badge"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { TitleShelf } from "../../../components/title-shelf"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { isTitleSeason, playerProfile, playerStints, type PlayerProfile } from "../../../lib/participant-model"
import { playerCompetitionsQuery } from "../../../lib/tournament-api"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { ParticipantMissing, Part, SeasonLine, ShelfPart } from "../components/participant-parts"
import { StreamHead } from "../../../components/stream-head"
import "../../../components/participant-list.css"

/** Seasons shown before the rest unfold. */
const SEASONS = 12

/**
 * A player as the published competitions show it: the teams that registered them, what they won and their awards.
 * Nicknames only: the page shows no photo and no real name. A player with a published page opens there instead.
 */
export function PlayerPage() {
  const { id = "" } = useParams()
  const { text } = useStreamLocale()
  const page = useQuery({
    queryKey: communityKeys.entityPage("PLAYER", id),
    queryFn: () => communityApi.pageByEntity("PLAYER", id),
    retry: false,
    staleTime: 60_000,
  })
  const competitions = useQuery(playerCompetitionsQuery(id))
  if (page.data) return <Navigate to={`/pages/${page.data.code}`} replace />
  const profile = competitions.data ? playerProfile(competitions.data, id) : null
  return (
    <StreamShell>
      <StreamHead
        title={
          profile
            ? text(
                `${profile.player.nickname} — Tuyển thủ · AOV Stream`,
                `${profile.player.nickname} — Player · AOV Stream`,
              )
            : text("Tuyển thủ — AOV Stream", "Player — AOV Stream")
        }
        description={
          profile
            ? text(
                `${profile.player.nickname}, tuyển thủ Liên Quân Mobile: đội tuyển, các giải đã thi đấu và thành tích.`,
                `${profile.player.nickname}, Arena of Valor player: teams, tournaments played and achievements.`,
              )
            : undefined
        }
        noindex={!profile && competitions.isSuccess && !page.isPending}
      />
      <div className="cp-container pt-page">
        {competitions.isPending || page.isPending ? (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải tuyển thủ", "Loading the player")}
          />
        ) : competitions.isError ? (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa tải được tuyển thủ", "The player could not be loaded")}</h1>
            <p>{competitions.error.message}</p>
            <button type="button" className="cp-button" onClick={() => void competitions.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : profile ? (
          <PlayerBody profile={profile} />
        ) : (
          <ParticipantMissing
            title={text("Tuyển thủ chưa có giải được công bố", "The player has no published tournament yet")}
            back={text("Xem các tuyển thủ", "See players")}
            to="/explore?kind=PLAYER"
          />
        )}
      </div>
    </StreamShell>
  )
}

function PlayerBody({ profile }: { profile: PlayerProfile }) {
  const { text, languageTag } = useStreamLocale()
  const { explore } = useSections()
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { player, lane, seasons, titles, mvps, awards } = profile
  const region = regionName(player.country, languageTag)
  const stints = playerStints(seasons)
  const now = stints[0]
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  const figures = [
    { value: titles, label: text("lần vô địch", titles === 1 ? "title" : "titles"), title: true },
    { value: seasons.length, label: text("giải đã tham gia", "tournaments played") },
    { value: mvps, label: text("MVP trận", "match MVPs") },
    { value: awards, label: text("giải cá nhân", "awards") },
  ].flatMap(({ value, ...figure }) => (value ? [{ ...figure, value: value.toLocaleString(languageTag) }] : []))
  return (
    <>
      <PageHead
        tint={player.nickname}
        lights={now ? [{ src: now.team.logoUrl, darkSrc: now.team.logoDarkUrl, at: "left" }] : []}
        places={[explore, { to: "/explore?kind=PLAYER", name: text("Tuyển thủ", "Players") }]}
        mark={
          <Jersey
            name={player.nickname}
            lane={lane}
            logoUrl={now?.team.logoUrl}
            logoDarkUrl={now?.team.logoDarkUrl}
            size={layout === "compact" ? 84 : 148}
          />
        }
        kicker={
          <>
            {lane && text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])}
            {region && (
              <>
                {lane && " · "}
                <RegionMark code={player.country} size={18} /> {region}
              </>
            )}
          </>
        }
        name={player.nickname}
        title={player.nickname}
        smallMark={
          <Jersey
            name={player.nickname}
            lane={lane}
            logoUrl={now?.team.logoUrl}
            logoDarkUrl={now?.team.logoDarkUrl}
            size={30}
          />
        }
        lines={
          now && (
            <p className="ph-line">
              <GoLink className="hub-go-pill pt-head-team" to={`/teams/${now.teamId}`}>
                <StreamImage
                  src={now.team.logoUrl}
                  darkSrc={now.team.logoDarkUrl}
                  logo
                  name={now.team.shortName || now.team.name}
                />
                {now.team.name}
              </GoLink>
            </p>
          )
        }
        figures={figures}
      />
      <ShelfPart titles={seasons.filter(isTitleSeason)}>
        {(shelf) => (
          <TitleShelf
            titles={shelf}
            views={seasons.map((season) => season.view)}
            teams
            name={player.nickname}
            logoUrl={now?.team.logoUrl}
            logoDarkUrl={now?.team.logoDarkUrl}
          />
        )}
      </ShelfPart>
      {stints.length > 0 && (
        <Part title={text("Các đội đã thi đấu", "Teams")}>
          <ul className="pt-cards">
            {stints.map((stint, index) => (
              <li key={`${stint.teamId}:${index}`} className="pt-card">
                <StreamImage
                  src={stint.team.logoUrl}
                  darkSrc={stint.team.logoDarkUrl}
                  logo
                  name={stint.team.shortName || stint.team.name}
                />
                <span className="pt-card-text">
                  <Link to={`/teams/${stint.teamId}`}>{stint.team.name}</Link>
                  <small>
                    {[
                      stint.from && (stint.from === stint.to ? stint.from : `${stint.from}–${stint.to}`),
                      text(
                        `${stint.seasons} giải`,
                        `${stint.seasons} ${stint.seasons === 1 ? "tournament" : "tournaments"}`,
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        </Part>
      )}
      <Part title={text("Giải đã tham dự", "Tournaments played")} note={seasons.length.toLocaleString(languageTag)}>
        <ul className="pt-seasons">
          {shown.map(({ view, place, team, teamId, awards: won, mvps: best }) => (
            <SeasonLine key={view.id} view={view} place={place}>
              {won.map((title) => (
                <span key={title} className="pt-award">
                  <StreamIcon name="trophy" size={13} />
                  {title}
                </span>
              ))}
              {best > 0 && (
                <span className="pt-award">
                  <MvpBadge label={text(`${best} lần MVP`, `MVP ${best} ${best === 1 ? "time" : "times"}`)} />
                  {`×${best}`}
                </span>
              )}
              {team && teamId && (
                <GoLink plain to={`/teams/${teamId}`}>
                  <StreamImage src={team.logoUrl} darkSrc={team.logoDarkUrl} logo name={team.shortName || team.name} />
                  {team.shortName || team.name}
                </GoLink>
              )}
            </SeasonLine>
          ))}
        </ul>
        <FoldButton
          fold={{ folds: seasons.length > SEASONS, open, toggle: () => setOpen(!open) }}
          more={text(`Xem thêm ${seasons.length - SEASONS} giải`, `Show ${seasons.length - SEASONS} more`)}
        />
      </Part>
      <p className="tn-quiet">
        {text(
          "Theo danh sách đăng ký của từng giải, không khẳng định tuyển thủ đã ra sân từng trận.",
          "From each tournament's registered rosters, which do not confirm that the player played in each match.",
        )}
      </p>
    </>
  )
}
