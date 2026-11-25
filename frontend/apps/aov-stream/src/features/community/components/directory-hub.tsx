import type { ReactNode } from "react"
import { Link } from "react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import {
  profileKindLabels,
  type CommunityProfile,
  type CompetitionParticipant,
  type ProfileKind,
} from "@aov/community-contracts"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { followersLabel, profileKindEnglish, regionKey, regionName } from "../../../components/community-ui"
import { Jersey } from "../../../components/jersey"
import { OfficialName } from "../../../components/official-name"
import { ProfileMark } from "../../../components/page-mark"
import { PlayerMark } from "../../../components/player-mark"
import { RegionMark } from "../../../components/region-mark"
import { StreamIcon } from "../../../components/stream-icon"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { participantPath } from "../../../lib/participant-model"
import { participantsQuery } from "../../../lib/tournament-api"
import "./directory-hub.css"

/** Tiles of one kind: a row of the widest wall, two on a compact one. */
const TILES = 8

/**
 * The directory before anything is chosen: a wall of each kind of page, with the way to all of them. Teams, players and
 * personnel come from the published competitions, which know more of them than have a page of their own.
 */
export function DirectoryHub() {
  return (
    <div className="dh">
      <ParticipantWall kind="TEAM" />
      <ParticipantWall kind="PLAYER" />
      <PageWall kind="CIRCUIT" />
      <PageWall kind="ORGANIZATION" />
      <ParticipantWall kind="PERSON" />
    </div>
  )
}

function Wall({ kind, total, children }: { kind: ProfileKind; total: number; children: ReactNode }) {
  const { text, languageTag } = useStreamLocale()
  const id = `wall-${kind}`
  return (
    <section aria-labelledby={id}>
      <div className="tn-heading">
        <h3 id={id}>
          {text(profileKindLabels[kind], profileKindEnglish[kind])} <small>{total.toLocaleString(languageTag)}</small>
        </h3>
        {total > TILES && (
          <Link to={`/explore?kind=${kind}`}>
            {text("Xem tất cả", "See all")}
            <StreamIcon name="arrow" size={15} />
          </Link>
        )}
      </div>
      <ul className="dh-wall">{children}</ul>
    </section>
  )
}

function Tile({ to, mark, name, note }: { to: string; mark: ReactNode; name: ReactNode; note: ReactNode }) {
  return (
    <li className="dh-tile">
      {mark}
      <strong>
        <Link to={to}>{name}</Link>
      </strong>
      {note && <span>{note}</span>}
    </li>
  )
}

function ParticipantWall({ kind }: { kind: CompetitionParticipant["kind"] }) {
  const { languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const query = useInfiniteQuery(participantsQuery(kind, "", TILES))
  const page = query.data?.pages[0]
  // While no competition is published, the pages of this kind stand in for who took part.
  if (page && !page.items.length) return <PageWall kind={kind} />
  if (!page) return null
  const size = compact ? 64 : 84
  return (
    <Wall kind={kind} total={page.totalElements}>
      {page.items.map((item) => {
        const region = regionName(item.country, languageTag)
        return (
          <Tile
            key={item.id}
            to={participantPath(item)}
            name={item.name}
            mark={
              item.kind === "TEAM" ? (
                <StreamImage src={item.imageUrl} darkSrc={item.imageDarkUrl} logo name={item.shortName || item.name} />
              ) : item.kind === "PLAYER" ? (
                <Jersey
                  name={item.name}
                  logoUrl={item.team?.logoUrl}
                  logoDarkUrl={item.team?.logoDarkUrl}
                  size={size + 4}
                />
              ) : (
                <PlayerMark name={item.name} size={size - 8} round />
              )
            }
            note={
              item.kind !== "TEAM" && item.team
                ? item.team.shortName || item.team.name
                : region && (
                    <>
                      <RegionMark code={item.country} size={16} /> {region}
                    </>
                  )
            }
          />
        )
      })}
    </Wall>
  )
}

function PageWall({ kind }: { kind: ProfileKind }) {
  const { languageTag } = useStreamLocale()
  const compact = usePageLayout() === "compact"
  const query = useQuery({
    queryKey: communityKeys.pageWall(kind),
    queryFn: () => communityApi.pages({ kind, size: String(TILES) }),
    staleTime: 5 * 60_000,
  })
  if (!query.data?.items.length) return null
  const note = (profile: CommunityProfile) => {
    const region = regionName(profile.content?.country, languageTag)
    if (region)
      return (
        <>
          <RegionMark code={regionKey(profile.content?.country)} size={16} /> {region}
        </>
      )
    return profile.followers > 0 ? followersLabel(profile.followers) : null
  }
  return (
    <Wall kind={kind} total={query.data.totalElements}>
      {query.data.items.map((profile) => (
        <Tile
          key={profile.id}
          to={`/pages/${profile.code}`}
          mark={<ProfileMark profile={profile} size={compact ? 64 : 84} />}
          name={<OfficialName name={profile.content?.name || profile.code} official={profile.represented} />}
          note={note(profile)}
        />
      ))}
    </Wall>
  )
}
