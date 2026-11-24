import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HeroLaneIcon } from "@aov/ui/components/hero-marks"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { regionName } from "../../../components/community-ui"
import { GoLink } from "../../../components/go-link"
import { PlayerMark } from "../../../components/player-mark"
import { RegionMark } from "../../../components/region-mark"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { playerProfile, playerStints, type PlayerProfile } from "../../../lib/participant-model"
import { playerCompetitionsQuery } from "../../../lib/tournament-api"
import { LANE_NAMES } from "../../../lib/tournament-model"
import { ParticipantMissing, Part, SeasonLine } from "../components/participant-parts"
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
      <title>
        {profile
          ? text(
              `${profile.player.nickname} — Tuyển thủ · AOV Stream`,
              `${profile.player.nickname} — Player · AOV Stream`,
            )
          : text("Tuyển thủ — AOV Stream", "Player — AOV Stream")}
      </title>
      <div className="cp-container pt-page">
        <Link className="cp-back" data-flush="" to="/explore?kind=PLAYER">
          <StreamIcon name="back" size={16} />
          {text("Tuyển thủ", "Players")}
        </Link>
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
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { player, lane, seasons, titles, mvps, awards } = profile
  const region = regionName(player.country, languageTag)
  const stints = playerStints(seasons)
  const now = stints[0]
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  const facts = [
    [text("giải", "tournaments"), seasons.length],
    [text("danh hiệu", "titles"), titles],
    [text("MVP trận", "match MVPs"), mvps],
    [text("giải cá nhân", "awards"), awards],
  ].filter(([, value]) => value) as [string, number][]
  return (
    <>
      <Stage
        tint={player.nickname}
        lights={now ? [{ src: now.team.logoUrl, darkSrc: now.team.logoDarkUrl, at: "right" }] : []}
      >
        <header className="pt-head">
          <PlayerMark name={player.nickname} size={layout === "compact" ? 72 : 112} />
          <div className="pt-head-text">
            <p>
              {lane && (
                <span>
                  <HeroLaneIcon lane={lane} size={18} label="" />
                  {text(LANE_NAMES[lane][0], LANE_NAMES[lane][1])}
                </span>
              )}
              {region && (
                <span>
                  <RegionMark code={player.country} />
                  {region}
                </span>
              )}
              {now && (
                <GoLink className="hub-go-pill pt-head-team" to={`/teams/${now.teamId}`}>
                  <StreamImage
                    src={now.team.logoUrl}
                    darkSrc={now.team.logoDarkUrl}
                    logo
                    name={now.team.shortName || now.team.name}
                  />
                  {now.team.name}
                </GoLink>
              )}
            </p>
            <h1>{player.nickname}</h1>
            <dl className="pt-head-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dd>{value.toLocaleString(languageTag)}</dd>
                  <dt>{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </header>
      </Stage>
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
                  <StreamIcon name="spark" size={13} />
                  {text(`${best} MVP`, `${best} MVP`)}
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
        {seasons.length > SEASONS && (
          <button type="button" className="tn-more" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open
              ? text("Thu gọn", "Show less")
              : text(`Xem thêm ${seasons.length - SEASONS} giải`, `Show ${seasons.length - SEASONS} more`)}
            <StreamIcon name={open ? "chevronLeft" : "chevronRight"} size={14} />
          </button>
        )}
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
