import { useState } from "react"
import { Navigate, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { personRoleLabels, type PersonRole } from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { personRoleEnglish } from "../../../components/community-ui"
import { GoLink } from "../../../components/go-link"
import { useSections } from "../../../components/place-trail"
import { PageHead } from "../../../components/page-head"
import { PlayerMark } from "../../../components/player-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { StreamShell } from "../../../components/stream-shell"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { personProfile, type PersonProfile } from "../../../lib/participant-model"
import { personCompetitionsQuery } from "../../../lib/tournament-api"
import { ParticipantMissing, Part, SeasonLine } from "../components/participant-parts"
import { StreamHead } from "../../../components/stream-head"

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
      <StreamHead
        title={
          profile
            ? text(`${profile.name} — Nhân sự · AOV Stream`, `${profile.name} — Staff · AOV Stream`)
            : text("Nhân sự — AOV Stream", "Staff — AOV Stream")
        }
        description={
          profile
            ? text(
                `${profile.name}, nhân sự các giải Liên Quân Mobile: vai trò và các mùa giải đã tham gia.`,
                `${profile.name}, Arena of Valor tournament staff: roles and seasons worked.`,
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
  const { explore } = useSections()
  const layout = usePageLayout()
  const [open, setOpen] = useState(false)
  const { name, roles, seasons } = profile
  const roleName = (role: PersonRole) => text(personRoleLabels[role], personRoleEnglish[role])
  const team = seasons.find((season) => season.team)
  const shown = open ? seasons : seasons.slice(0, SEASONS)
  return (
    <>
      <PageHead
        tint={name}
        lights={team?.team ? [{ src: team.team.logoUrl, darkSrc: team.team.logoDarkUrl, at: "left" }] : []}
        places={[explore, { to: "/explore?kind=PERSON", name: text("Nhân sự", "Staff") }]}
        mark={<PlayerMark name={name} size={layout === "compact" ? 72 : 120} round />}
        kicker={roles.map(roleName).join(" · ")}
        name={name}
        title={name}
        smallMark={<PlayerMark name={name} size={28} round />}
        lines={
          team?.team && (
            <p className="ph-line">
              <GoLink className="hub-go-pill pt-head-team" to={`/teams/${team.teamId}`}>
                <StreamImage
                  src={team.team.logoUrl}
                  darkSrc={team.team.logoDarkUrl}
                  logo
                  name={team.team.shortName || team.team.name}
                />
                {team.team.name}
              </GoLink>
            </p>
          )
        }
        figures={[
          {
            value: seasons.length.toLocaleString(languageTag),
            label: text("giải đã tham gia", seasons.length === 1 ? "tournament" : "tournaments"),
          },
        ]}
      />
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
    </>
  )
}
