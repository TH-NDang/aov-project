import { ChevronRight, Crown, UserRoundPen } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LaneIcon, PlayerPhoto, RegionFlag, TeamLogo } from "@/features/esports/components/primitives"
import { CAREER_STATUSES } from "@/features/tournaments/components/tournament-metadata"
import { LANE_LABELS } from "@/lib/lanes"
import { backState, birthYear, LINE_STATUS_LABELS, linesOfPlayer, type PeekTarget } from "./peek-model"
import { useRecordPage, type PeekWorld } from "./peek-world"
import { BackButton, ProfileButton } from "./profile-button"

type CardProps = {
  world: PeekWorld
  playerId: string
  onOpen: (target: PeekTarget) => void
  onBack?: () => void
  onDone: () => void
}

/**
 * A player as the tournament knows them: where they played and for whom, and the ways to their team's card, to the
 * quick edit of their record and to their profile.
 */
export function PlayerCard({ world, playerId, onOpen, onBack, onDone }: CardProps) {
  const player = world.players?.get(playerId) ?? world.known[playerId]
  const page = useRecordPage(world.actorKey, "PLAYER", playerId)
  const lines = linesOfPlayer(world.rosters, playerId)
  const line = lines[0]
  const lane = line?.lane ?? player?.lane ?? null
  const name = player?.nickname ?? "Chưa rõ tên"
  const born = birthYear(player?.birthDate)
  const facts = [
    player?.fullName,
    born ? `Sinh ${born}` : null,
    player?.careerStatus && player.careerStatus !== "UNKNOWN" ? CAREER_STATUSES[player.careerStatus] : null,
  ].filter(Boolean)
  return (
    <article className="esp-peek-card" data-kind="player" aria-label={`Tuyển thủ ${name}`}>
      <header className="esp-peek-player-head">
        {lane && <LaneIcon lane={lane} size={88} className="esp-peek-watermark" />}
        {onBack && <BackButton onBack={onBack} />}
        <span className="esp-peek-socket" data-round>
          <PlayerPhoto name={name} url={player?.photoUrl ?? undefined} size={48} />
        </span>
        <span className="min-w-0">
          <strong className="type-section-title flex items-center gap-1.5">
            <span className="truncate">{name}</span>
            {line?.captain && (
              <Crown aria-label="Đội trưởng" className="size-4 shrink-0 fill-current text-(--aov-warning)" />
            )}
          </strong>
          {facts.length > 0 && <span className="type-meta block truncate">{facts.join(" · ")}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {lane && (
              <span className="esp-peek-tag">
                <LaneIcon lane={lane} size={14} /> {LANE_LABELS[lane].short}
              </span>
            )}
            {line && <span className="esp-peek-tag">{LINE_STATUS_LABELS[line.status ?? "UNKNOWN"]}</span>}
            {player?.country && (
              <span className="type-meta">
                <RegionFlag code={player.country} />
              </span>
            )}
          </span>
        </span>
      </header>
      <section className="esp-peek-section" aria-label="Đội tại giải">
        <h3 className="type-label text-muted-foreground">Đội tại giải</h3>
        {lines.length ? (
          <ul className="esp-peek-lineup">
            {lines.map((row) => {
              const team = world.team(row.teamId)
              return (
                <li key={`${row.teamId}-${row.status}`}>
                  <button type="button" onClick={() => onOpen({ kind: "team", id: row.teamId })}>
                    <TeamLogo team={team} size={28} />
                    <span className="type-body min-w-0 flex-1 truncate">{team.name}</span>
                    {lines.length > 1 && (
                      <span className="type-meta shrink-0">{LINE_STATUS_LABELS[row.status ?? "UNKNOWN"]}</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="type-meta">Không có trong đội hình nào của giải.</p>
        )}
      </section>
      {(player?.signatureHeroes?.length ?? 0) > 0 && (
        <section className="esp-peek-section" aria-label="Tướng tủ">
          <h3 className="type-label text-muted-foreground">Tướng tủ</h3>
          <p className="esp-peek-heroes">
            {player!.signatureHeroes!.slice(0, 6).map((hero) => (
              <span key={hero}>{hero}</span>
            ))}
          </p>
        </section>
      )}
      <footer className="esp-peek-actions">
        {world.openRecord && line && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onDone()
              world.openRecord?.(line.teamId)
            }}
          >
            <UserRoundPen aria-hidden /> Sửa nhanh
          </Button>
        )}
        <ProfileButton page={page} state={backState(world.back)} />
      </footer>
    </article>
  )
}
