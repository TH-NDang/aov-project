import { Trophy } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import type { Bracket, BracketRound, BracketSlot } from "../model/competition"
import { RelativeDate } from "./relative-date"
import type { TeamView } from "../model/game-view"
import { BestOfBadge, TeamLogo } from "./primitives"

function SlotCard({
  slot,
  team,
  onOpen,
}: {
  slot: BracketSlot
  team: (id: string) => TeamView
  onOpen?: (seriesId: string) => void
}) {
  const line = (teamId: string | undefined, score: number | undefined, won: boolean) => {
    const view = teamId ? team(teamId) : undefined
    return (
      <span
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5",
          slot.winner && !won && "esp-loser",
          won && "esp-winner-row font-semibold",
        )}
      >
        {view ? <TeamLogo team={view} size={20} /> : <span className="size-5 rounded bg-muted" />}
        <span className="min-w-0 flex-1 truncate text-sm">{view?.name ?? "Chờ xác định"}</span>
        <span
          className={cn(
            "esp-num grid h-6 min-w-6 place-items-center rounded px-1 text-xs font-bold",
            won ? "esp-win-score" : "bg-muted",
          )}
        >
          {score ?? "–"}
        </span>
      </span>
    )
  }
  const clickable = !!slot.id && !!onOpen
  return (
    <div className="esp-bracket-slot">
      <button
        type="button"
        disabled={!clickable}
        onClick={() => slot.id && onOpen?.(slot.id)}
        className={cn(
          "block w-full overflow-hidden rounded-lg border bg-card text-left shadow-xs transition",
          clickable && "hover:border-foreground/30 hover:shadow-sm",
          slot.projected && "border-dashed",
        )}
      >
        {line(slot.teamAId, slot.scoreA, slot.winner === "A")}
        <span className="block border-t" />
        {line(slot.teamBId, slot.scoreB, slot.winner === "B")}
      </button>
      <span className="mt-1 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>{slot.projected ? "Dự kiến theo nhánh" : <RelativeDate value={slot.scheduledAt} />}</span>
        <BestOfBadge bestOf={slot.bestOf} className="h-4 px-1.5 text-[9px]" />
      </span>
    </div>
  )
}

function Rounds({
  title,
  rounds,
  team,
  onOpen,
}: {
  title: string
  rounds: BracketRound[]
  team: (id: string) => TeamView
  onOpen?: (seriesId: string) => void
}) {
  if (!rounds.length) return null
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round.key} className="flex min-w-[220px] flex-col gap-2">
            <p className="text-center text-xs font-medium text-muted-foreground">{round.label}</p>
            <div className="esp-bracket-round flex-1">
              {round.slots.map((slot, index) => (
                <SlotCard key={slot.id ?? index} slot={slot} team={team} onOpen={onOpen} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function BracketView({
  bracket,
  team,
  onOpen,
}: {
  bracket: Bracket
  team: (id: string) => TeamView
  onOpen?: (seriesId: string) => void
}) {
  const final = bracket.final?.slots[0]
  const champion = final?.winner === "A" ? final.teamAId : final?.winner === "B" ? final.teamBId : undefined
  return (
    <div className="grid gap-6 @5xl:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-6">
        <Rounds title="Nhánh thắng" rounds={bracket.upper} team={team} onOpen={onOpen} />
        <Rounds title="Nhánh thua" rounds={bracket.lower} team={team} onOpen={onOpen} />
      </div>
      {final && (
        <section className="space-y-3 self-center">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--esp-gold)]">
            <Trophy size={14} /> Chung kết tổng
          </h3>
          <SlotCard slot={final} team={team} onOpen={onOpen} />
          {champion && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--esp-gold-soft)] px-3 py-2 text-sm font-semibold">
              <Trophy size={16} className="text-[var(--esp-gold)]" />
              Vô địch: {team(champion).name}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
