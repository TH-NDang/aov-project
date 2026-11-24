import { useState } from "react"
import { Link, Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { personRoleLabels, type PersonRole } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { personRoleEnglish } from "../../../components/community-ui"
import { GoLink } from "../../../components/go-link"
import { ImageRights } from "../../../components/image-rights"
import { PlayerMark } from "../../../components/player-mark"
import { Stage } from "../../../components/stage"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { personProfile, type PersonProfile } from "../../../lib/participant-model"
import { personCompetitionsQuery } from "../../../lib/tournament-api"
import { ParticipantMissing, Part, SeasonLine } from "../components/participant-parts"

/** Competitions shown before the rest unfold. */
const SEASONS = 12

/**
 * A caster, a host, a coach or an analyst as the published competitions show them. `id` is the one of their profile
 * page, which opens instead once it is published.
 */
export function PersonPage() {
  const { id = "" } = useParams()
  const { text } = useStreamLocale()
  const page = useQuery({
    queryKey: communityKeys.publicPage(id),
    queryFn: () => communityApi.page(id),
    retry: false,
    staleTime: 60_000,
  })
  const competitions = useQuery(personCompetitionsQuery(id))
  if (page.data) return <Navigate to={`/pages/${page.data.code}`} replace />
  const profile = competitions.data ? personProfile(competitions.data, id) : null
  return (
    <StreamShell>
      <title>
        {profile
          ? text(`${profile.name} — Nhân sự · AOV Stream`, `${profile.name} — Staff · AOV Stream`)
          : text("Nhân sự — AOV Stream", "Staff — AOV Stream")}
      </title>
      <div className="cp-container pt-page">
        <Link className="cp-back" data-flush="" to="/explore?kind=PERSON">
          <StreamIcon name="back" size={16} />
          {text("Nhân sự", "Staff")}
        </Link>
        {competitions.isPending || page.isPending ? (
          <div
            className="hub-skeleton-rows"
            role="status"
            aria-label={text("Đang tải nhân sự", "Loading the person")}
          />
        ) : competitions.isError ? (
          <div className="hub-state" role="alert">
            <h1>{text("Chưa tải được nhân sự", "The person could not be loaded")}</h1>
            <p>{competitions.error.message}</p>
            <button type="button" className="cp-button" onClick={() => void competitions.refetch()}>
              {text("Thử lại", "Retry")}
            </button>
          </div>
        ) : profile ? (
          <PersonBody profile={profile} />
        ) : (
          <ParticipantMissing
            title={text("Nhân sự chưa có giải được công bố", "The person has no published tournament yet")}
            back={text("Xem nhân sự", "See staff")}
            to="/explore?kind=PERSON"
          />
        )}
      </div>
    </StreamShell>
  )
}

function PersonBody({ profile }: { profile: PersonProfile }) {
  const { text, languageTag } = useStreamLocale()
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { name, roles, seasons } = profile
  const roleName = (role: PersonRole) => text(personRoleLabels[role], personRoleEnglish[role])
  const team = seasons.find((season) => season.team)
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  return (
    <>
      <Stage
        tint={name}
        lights={team?.team ? [{ src: team.team.logoUrl, darkSrc: team.team.logoDarkUrl, at: "right" }] : []}
      >
        <header className="pt-head">
          <PlayerMark name={name} size={layout === "compact" ? 72 : 112} round />
          <div className="pt-head-text">
            <p>
              {roles.map((role) => (
                <span key={role}>{roleName(role)}</span>
              ))}
              {team?.team && (
                <GoLink className="hub-go-pill pt-head-team" to={`/teams/${team.teamId}`}>
                  <StreamImage
                    src={team.team.logoUrl}
                    darkSrc={team.team.logoDarkUrl}
                    logo
                    name={team.team.shortName || team.team.name}
                  />
                  {team.team.name}
                </GoLink>
              )}
            </p>
            <h1>{name}</h1>
            <dl className="pt-head-facts">
              <div>
                <dd>{seasons.length.toLocaleString(languageTag)}</dd>
                <dt>{text("giải", seasons.length === 1 ? "tournament" : "tournaments")}</dt>
              </div>
            </dl>
          </div>
        </header>
      </Stage>
      <Part title={text("Giải đã tham gia", "Tournaments")} note={seasons.length.toLocaleString(languageTag)}>
        <ul className="pt-seasons">
          {shown.map((season) => (
            <SeasonLine key={season.view.id} view={season.view}>
              {season.roles.map(({ role, title }) => (
                <span key={role}>{title || roleName(role)}</span>
              ))}
              {season.matches > 0 && (
                <span>
                  {text(`${season.matches} trận`, `${season.matches} ${season.matches === 1 ? "match" : "matches"}`)}
                </span>
              )}
              {season.team && season.teamId && (
                <GoLink plain to={`/teams/${season.teamId}`}>
                  <StreamImage
                    src={season.team.logoUrl}
                    darkSrc={season.team.logoDarkUrl}
                    logo
                    name={season.team.shortName || season.team.name}
                  />
                  {season.team.shortName || season.team.name}
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
      <ImageRights />
    </>
  )
}
