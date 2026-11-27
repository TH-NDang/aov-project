import { CalendarDays, ChevronRight, Crown, UserRoundPen, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LaneIcon, RegionFlag, TeamLogo } from "@/features/esports/components/primitives"
import { useThemedLogo } from "@/lib/themed-logo"
import { LANE_LABELS } from "@/lib/lanes"
import { placeLabel } from "../workspace/final-places-table"
import { rosterBoard } from "../workspace/model"
import { backState, lastRank, teamRecord, type PeekTarget } from "./peek-model"
import { useRecordPage, type PeekWorld } from "./peek-world"
import { BackButton, ProfileButton } from "./profile-button"

type CardProps = {
  world: PeekWorld
  teamId: string
  onOpen: (target: PeekTarget) => void
  onBack?: () => void
  onDone: () => void
}

/**
 * A team as the tournament knows it: how it entered, how it did, who played where, and the ways to its roster, its
 * matches and its profile. Every player opens their own card.
 */
export function TeamCard({ world, teamId, onOpen, onBack, onDone }: CardProps) {
  const team = world.team(teamId)
  const logo = useThemedLogo(team.logoUrl, team.logoDarkUrl)
  const page = useRecordPage(world.actorKey, "TEAM", teamId)
  const record = teamRecord(world.resolved, teamId)
  const finalPlace = world.finalPlace?.(teamId)
  const rank = finalPlace
    ? { label: /^\d+$/.test(finalPlace) ? `#${finalPlace}` : placeLabel(finalPlace), stage: "Chung cuộc" }
    : (() => {
        const row = lastRank(world.standings, world.stageName, teamId)
        return row && { label: `#${row.rank}`, stage: row.stage }
      })()
  const rows = world.rosters.filter((row) => row.teamId === teamId)
  const board = rosterBoard(rows)
  const nameOf = (playerId: string) =>
    world.players?.get(playerId)?.nickname ?? world.known[playerId]?.nickname ?? "Chưa rõ tên"
  const others = [...board.unplaced, ...board.bench, ...board.unknown]
  const act = (action?: (teamId: string) => void) => () => {
    onDone()
    action?.(teamId)
  }
  return (
    <article className="esp-peek-card" data-kind="team" aria-label={`Đội ${team.name}`}>
      <header className="esp-peek-team-head">
        {logo.url && <img className="esp-peek-wash" src={logo.url} alt="" aria-hidden="true" />}
        {onBack && <BackButton onBack={onBack} />}
        <span className="esp-peek-socket">
          <TeamLogo team={team} size={48} />
        </span>
        <span className="min-w-0">
          <strong className="type-section-title block truncate">{team.name}</strong>
          <span className="type-meta flex flex-wrap items-center gap-x-2">
            {team.shortName}
            {team.country && <RegionFlag code={team.country} />}
          </span>
          {world.entry(teamId) && <span className="esp-peek-tag">{world.entry(teamId)}</span>}
        </span>
      </header>
      <dl className="esp-peek-stats">
        <div>
          <dt>Trận</dt>
          <dd>{record.played ? `${record.won}–${record.lost}` : "–"}</dd>
        </div>
        <div>
          <dt>Ván</dt>
          <dd>{record.played ? `${record.gameWins}–${record.gameLosses}` : "–"}</dd>
        </div>
        <div title={rank?.stage}>
          <dt>{finalPlace ? "Chung cuộc" : "Hạng"}</dt>
          <dd>{rank?.label ?? "–"}</dd>
        </div>
      </dl>
      <section className="esp-peek-section" aria-label="Đội hình tại giải">
        <h3 className="type-label text-muted-foreground">Đội hình tại giải</h3>
        {rows.length ? (
          <ul className="esp-peek-lineup">
            {board.lanes.map((cell) =>
              cell.players.length ? (
                cell.players.map((row) => (
                  <li key={row.playerId}>
                    <button type="button" onClick={() => onOpen({ kind: "player", id: row.playerId })}>
                      <LaneIcon lane={cell.lane} size={16} className="shrink-0 text-muted-foreground" />
                      <span className="type-meta w-14 shrink-0">{LANE_LABELS[cell.lane].short}</span>
                      <span className="type-body min-w-0 flex-1 truncate">{nameOf(row.playerId)}</span>
                      {row.captain && (
                        <Crown aria-label="Đội trưởng" className="size-3.5 fill-current text-(--aov-warning)" />
                      )}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))
              ) : (
                <li key={cell.lane} className="esp-peek-empty">
                  <LaneIcon lane={cell.lane} size={16} className="shrink-0 opacity-50" />
                  <span className="type-meta">Chưa có {LANE_LABELS[cell.lane].short.toLowerCase()}</span>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="type-meta">Chưa có đội hình.</p>
        )}
        {(others.length > 0 || board.left.length > 0) && (
          <p className="esp-peek-others">
            {[...others, ...board.left].map((row) => (
              <button
                key={row.playerId}
                type="button"
                data-left={row.status === "INACTIVE" || undefined}
                onClick={() => onOpen({ kind: "player", id: row.playerId })}
              >
                {nameOf(row.playerId)}
              </button>
            ))}
          </p>
        )}
      </section>
      <footer className="esp-peek-actions">
        {world.openRoster && (
          <Button type="button" variant="outline" size="sm" onClick={act(world.openRoster)}>
            <Users aria-hidden /> Đội hình
          </Button>
        )}
        {world.showMatches && (
          <Button type="button" variant="outline" size="sm" onClick={act(world.showMatches)}>
            <CalendarDays aria-hidden /> Lịch đấu
          </Button>
        )}
        {world.openRecord && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={act(world.openRecord)}
            title="Sửa hồ sơ đội và tuyển thủ"
          >
            <UserRoundPen aria-hidden />
            <span className="sr-only">Sửa hồ sơ đội và tuyển thủ</span>
          </Button>
        )}
        <ProfileButton page={page} state={backState(world.back)} />
      </footer>
    </article>
  )
}
