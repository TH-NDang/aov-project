import { Link } from "react-router"
import { ChevronRight, Layers, Plus } from "lucide-react"
import type { TournamentPart } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { useTournamentStats } from "@/features/esports/data/use-esports-data"
import { FORMAT_LABELS, dateRange } from "@/features/esports/model/labels"
import { tournamentPath } from "@/features/esports/pages/esports-shell"
import { PART_PHASE_NAMES, PartPhaseDot } from "@/features/tournaments/part-phase-dot"
import { partLabel, partPhase, type EventFamily } from "@/features/tournaments/tournament-parts"
import { Chip, Panel } from "./parts"

const partTitle = (part: TournamentPart) =>
  `${part.name} · ${dateRange(part.startsOn ?? undefined, part.endsOn ?? undefined)}`

/**
 * The main event and its parts as one row of tabs, the way the source wiki shows them. Each tab opens that
 * tournament's own workspace; the row is only drawn for an event that has parts.
 */
export function EventPartTabs({ family, currentId }: { family: EventFamily; currentId: string }) {
  if (!family.isPart && !family.parts.length) return null
  const tab = (active: boolean) =>
    cn(
      "type-body inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
    )
  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Các phần của giải">
      <span className="type-label inline-flex shrink-0 items-center gap-1.5 pr-1 text-muted-foreground">
        <Layers className="size-4" aria-hidden />
        Các phần
      </span>
      <Link
        to={tournamentPath(family.mainEventId)}
        aria-current={family.mainEventId === currentId ? "page" : undefined}
        title={family.mainName}
        className={tab(family.mainEventId === currentId)}
      >
        Giải chính
      </Link>
      {family.parts.map((part) => (
        <Link
          key={part.id}
          to={tournamentPath(part.id)}
          aria-current={part.id === currentId ? "page" : undefined}
          title={partTitle(part)}
          className={tab(part.id === currentId)}
        >
          <PartPhaseDot phase={partPhase(part)} />
          {partLabel(part.name, family.mainName)}
        </Link>
      ))}
    </nav>
  )
}

/** The parts of a main event with what each one holds, and the one place a new part is added from. */
export function EventPartsPanel({
  family,
  canEdit,
  onAdd,
}: {
  family: EventFamily
  canEdit: boolean
  onAdd: () => void
}) {
  const stats = useTournamentStats()
  const counts = new Map((stats.data ?? []).map((row) => [row.tournamentId, row]))
  return (
    <Panel
      title="Các phần của giải"
      icon={Layers}
      meta={family.parts.length ? `${family.parts.length} phần` : undefined}
      action={
        canEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus aria-hidden /> Thêm phần
          </Button>
        )
      }
    >
      {family.parts.length ? (
        <ul>
          {family.parts.map((part) => {
            const phase = partPhase(part)
            const count = counts.get(part.id)
            return (
              <li key={part.id} className="border-b last:border-b-0">
                <Link
                  to={tournamentPath(part.id)}
                  className="group flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="type-body">{partLabel(part.name, family.mainName)}</strong>
                      {part.competitionType && part.competitionType !== "UNKNOWN" && (
                        <Chip>{FORMAT_LABELS[part.competitionType]}</Chip>
                      )}
                      {PART_PHASE_NAMES[phase] && (
                        <Chip tone={phase === "ongoing" ? "ok" : "warn"}>{PART_PHASE_NAMES[phase]}</Chip>
                      )}
                    </span>
                    <span className="type-meta mt-1 block">
                      {dateRange(part.startsOn ?? undefined, part.endsOn ?? undefined)}
                      {count && ` · ${count.teams} đội · ${count.played}/${count.matches} trận đã đấu`}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="type-body px-4 py-3 text-muted-foreground">
          Chưa có phần nào. Vòng loại, wildcard, chặng đấu hay showmatch của giải được thêm ở đây, không tạo thành một
          giải riêng.
        </p>
      )}
    </Panel>
  )
}
