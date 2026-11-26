import type { CompetitionView } from "@aov/community-contracts"
import { StreamImage } from "../../../components/stream-image"
import { useStreamLocale } from "../../../components/stream-locale"
import { useCentred } from "../../../lib/use-centred"
import "./team-follow.css"

/**
 * Teams as a row of crests: one press follows a team, pressing it again lets go. Pointing at a crest shows what
 * following it would light.
 */
export function TeamFollow({
  view,
  teams,
  followed,
  onFollow,
  onPoint,
}: {
  view: CompetitionView
  teams: string[]
  followed: string | null
  onFollow: (team: string | null) => void
  onPoint: (team: string | null) => void
}) {
  const { text } = useStreamLocale()
  const row = useCentred<HTMLDivElement>(followed)
  return (
    <div
      ref={row}
      className="tn-follow"
      role="group"
      aria-label={text("Theo dõi một đội", "Follow a team")}
      onPointerLeave={() => onPoint(null)}
    >
      {teams.map((id) => {
        const team = view.content.teams[id]
        const name = team?.name ?? text("Đội", "Team")
        return (
          <button
            key={id}
            type="button"
            className="tn-follow-team"
            aria-pressed={followed === id}
            title={name}
            onClick={() => onFollow(followed === id ? null : id)}
            onPointerEnter={(event) => event.pointerType === "mouse" && onPoint(id)}
          >
            <StreamImage src={team?.logoUrl} darkSrc={team?.logoDarkUrl} logo name={team?.shortName || name} />
            <span>{team?.shortName || name}</span>
          </button>
        )
      })}
    </div>
  )
}
