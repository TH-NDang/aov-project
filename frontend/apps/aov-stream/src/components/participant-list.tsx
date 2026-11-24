import { Link } from "react-router"
import { useInfiniteQuery } from "@tanstack/react-query"
import { personRoleLabels, type CompetitionParticipant } from "@aov/community-contracts"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { personRoleEnglish, regionName } from "./community-ui"
import { PlayerMark } from "./player-mark"
import { RegionMark } from "./region-mark"
import { StreamImage } from "./stream-image"
import { useStreamLocale } from "./stream-locale"
import { participantPath } from "../lib/participant-model"
import { participantsQuery } from "../lib/tournament-api"
import "./participant-list.css"

/** One team or player: its mark, its name, and where it plays. */
export function ParticipantCard({ item }: { item: CompetitionParticipant }) {
  const { text, languageTag } = useStreamLocale()
  const region = regionName(item.country, languageTag)
  const count = text(
    `${item.competitions} giải`,
    `${item.competitions} ${item.competitions === 1 ? "tournament" : "tournaments"}`,
  )
  return (
    <li className="pt-card">
      {item.kind === "TEAM" ? (
        <StreamImage src={item.imageUrl} darkSrc={item.imageDarkUrl} logo name={item.shortName || item.name} />
      ) : (
        <PlayerMark name={item.name} size={44} round={item.kind === "PERSON"} />
      )}
      <span className="pt-card-text">
        <Link to={participantPath(item)} title={item.name}>
          {item.name}
        </Link>
        <small>
          {region && <RegionMark code={item.country} size={16} />}
          {item.kind === "PERSON"
            ? [
                item.roles.map((role) => text(personRoleLabels[role], personRoleEnglish[role])).join(", "),
                item.team?.shortName || item.team?.name,
              ]
                .filter(Boolean)
                .join(" · ") || count
            : item.kind === "PLAYER" && item.team
              ? item.team.shortName || item.team.name
              : count}
        </small>
      </span>
    </li>
  )
}

/** The teams or the players of published competitions, those seen last first. */
export function ParticipantList({ kind, q = "" }: { kind: CompetitionParticipant["kind"]; q?: string }) {
  const { text } = useStreamLocale()
  const query = useInfiniteQuery(participantsQuery(kind, q, 48))
  const items = query.data?.pages.flatMap((page) => page.items) ?? []
  if (query.isPending)
    return (
      <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải danh sách", "Loading the list")} />
    )
  if (query.isLoadingError)
    return (
      <div className="hub-state" role="alert">
        <h3>{text("Chưa tải được danh sách", "The list could not be loaded")}</h3>
        <p>{query.error.message}</p>
        <button type="button" className="cp-button" onClick={() => void query.refetch()}>
          {text("Thử lại", "Retry")}
        </button>
      </div>
    )
  if (!items.length)
    return (
      <div className="hub-state">
        <h3>
          {q
            ? text(`Không có kết quả nào khớp “${q}”`, `Nothing matches “${q}”`)
            : text("Chưa có giải đấu nào được công bố", "No tournament has been published yet")}
        </h3>
      </div>
    )
  return (
    <>
      <ul className="pt-cards">
        {items.map((item) => (
          <ParticipantCard key={item.id} item={item} />
        ))}
      </ul>
      <InfiniteScroll
        query={query}
        label={text("Đang tải thêm", "Loading more")}
        retryLabel={text("Tải lại phần tiếp theo", "Load the next part again")}
      />
    </>
  )
}
