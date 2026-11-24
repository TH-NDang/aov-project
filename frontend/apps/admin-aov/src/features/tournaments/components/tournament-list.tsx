import { Link } from "react-router"
import { CalendarDays, Layers } from "lucide-react"
import type {
  DocumentView,
  TournamentContent,
  TournamentPart,
  TournamentStats as ContractStats,
} from "@aov/community-contracts"
import { Checkbox } from "@aov/ui/components/checkbox"
import { TableCell, TableRow } from "@aov/ui/components/table"
import { dateRange, TIER_LABELS } from "@/features/esports/model/labels"
import { ManagementTable } from "./management-list"
import { PartPhaseDot } from "./part-phase-dot"
import { tournamentTiming } from "../model/record-reason"
import { RegistryLogo } from "./registry-logo"
import { TeamRegionBadge } from "./team-region"
import { TournamentRowMenu, type TournamentRowActions } from "./tournament-row-menu"
import { TournamentRowStatus } from "./tournament-row-status"
import type { RowSelectionState } from "./use-row-selection"
import { partLabel, partsOnLine } from "../model/tournament-parts"

type TournamentStats = Omit<ContractStats, "tournamentId">
type Entry = DocumentView<TournamentContent>

const NO_PARTS: TournamentPart[] = []

/** A click on a control of the row, or on a menu it opened, is that control's own. */
const onControl = (event: React.MouseEvent) =>
  !event.currentTarget.contains(event.target as Node) ||
  !!(event.target as Element).closest("button, a, [data-row-control]")

/**
 * A list of main events. Their parts (qualifiers, wildcard, weekly stops, show matches) are not rows of their own:
 * each main event names them on a line under its dates, where a part opens with one click. Without `actions` and
 * `selection` the list is for reading only.
 */
export function TournamentList({
  entries,
  stats,
  onOpen,
  parts,
  published,
  actions,
  selection,
  search = "",
  partHref = (id) => `/tournaments/${id}`,
}: {
  entries: Entry[]
  /** Missing while the counts are on their way, so no tournament reads as empty meanwhile. */
  stats?: Map<string, TournamentStats>
  onOpen: (entry: Entry) => void
  /** Parts by the id of their main event. */
  parts?: ReadonlyMap<string, TournamentPart[]>
  /** Ids of the tournaments readers see on Stream; missing while that is not known. */
  published?: ReadonlySet<string>
  actions?: TournamentRowActions
  selection?: Pick<RowSelectionState, "ids" | "toggle" | "toggleAll">
  /** What the list was searched for: a part it names moves to the front of its line. */
  search?: string
  partHref?: (id: string) => string
}) {
  const ticked = selection?.ids.size ?? 0
  return (
    <ManagementTable
      label="Danh sách giải đấu"
      columns={[
        ...(selection
          ? [
              {
                label: "Chọn",
                header: (
                  <Checkbox
                    aria-label="Chọn mọi giải đang hiện"
                    className="align-middle"
                    checked={ticked === entries.length ? true : ticked ? "indeterminate" : false}
                    onCheckedChange={selection.toggleAll}
                  />
                ),
                className: "w-10 pr-0",
              },
            ]
          : []),
        { label: "Giải đấu" },
        { label: "Trạng thái", className: "hidden w-44 @2xl:table-cell @4xl:w-56" },
        { label: "Trận đấu", className: "hidden w-36 @4xl:table-cell" },
        ...(actions
          ? [{ label: "Thao tác", header: <span className="sr-only">Thao tác</span>, className: "w-14" }]
          : []),
      ]}
    >
      {entries.map((entry) => (
        <TournamentRow
          key={entry.id}
          entry={entry}
          counts={stats && (stats.get(entry.id) ?? { teams: 0, matches: 0, played: 0 })}
          parts={parts?.get(entry.id) ?? NO_PARTS}
          published={published?.has(entry.id)}
          search={search}
          partHref={partHref}
          onOpen={() => onOpen(entry)}
          actions={actions}
          selected={selection?.ids.has(entry.id)}
          onToggle={selection && ((range) => selection.toggle(entry.id, range))}
        />
      ))}
    </ManagementTable>
  )
}

function TournamentRow({
  entry,
  counts,
  parts,
  published,
  search,
  partHref,
  onOpen,
  actions,
  selected,
  onToggle,
}: {
  entry: Entry
  counts?: TournamentStats
  parts: TournamentPart[]
  published?: boolean
  search: string
  partHref: (id: string) => string
  onOpen: () => void
  actions?: TournamentRowActions
  selected?: boolean
  onToggle?: (range: boolean) => void
}) {
  const content = entry.content
  const timing = tournamentTiming(content)
  const status = (
    <TournamentRowStatus
      content={content}
      published={published}
      onFix={actions && ((next) => actions.changeStatus(entry, next))}
    />
  )
  return (
    <TableRow
      className="cursor-pointer [&>td]:align-top"
      data-state={selected ? "selected" : undefined}
      onClick={(event) => {
        if (!onControl(event)) onOpen()
      }}
    >
      {onToggle && (
        <TableCell data-row-control className="cursor-default pr-0! select-none">
          <Checkbox
            className="mt-3"
            aria-label={`Chọn ${content.name}`}
            checked={selected}
            // Shift held down extends the selection; the browser would mark the text in between instead.
            onMouseDown={(event) => event.shiftKey && event.preventDefault()}
            onClick={(event) => onToggle(event.shiftKey)}
          />
        </TableCell>
      )}
      <TableCell className="@max-2xl:px-2!">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Mở giải ${content.name}`}
          className="group flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RegistryLogo url={content.logoUrl} darkUrl={content.logoDarkUrl} name={content.name} />
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="type-body underline-offset-2 group-hover:underline">{content.name}</strong>
              {content.tier && content.tier !== "UNKNOWN" && (
                <span className="type-label rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {TIER_LABELS[content.tier]}
                </span>
              )}
            </span>
            <span className="type-meta flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <TeamRegionBadge code={content.region} />
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                {dateRange(content.startsOn, content.endsOn)}
              </span>
              {timing && <span className="whitespace-nowrap">{timing}</span>}
              {counts && (
                <span className="whitespace-nowrap @4xl:hidden">
                  {counts.teams} đội · {counts.played}/{counts.matches} trận đã đấu
                </span>
              )}
            </span>
          </span>
        </button>
        {/* Indented by the logo and its gap, so it starts under the tournament's name. */}
        <div className="mt-2 pl-[54px] @2xl:hidden">{status}</div>
        <PartLinks main={content} parts={parts} search={search} href={partHref} onMore={onOpen} />
      </TableCell>
      <TableCell className="hidden @2xl:table-cell">{status}</TableCell>
      <TableCell className="hidden @4xl:table-cell">
        <span className="type-body tabular-nums">
          {counts?.played ?? "–"}
          <span className="text-muted-foreground"> / {counts?.matches ?? "–"}</span>
        </span>
        <div className="my-1.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${counts?.matches ? (counts.played / counts.matches) * 100 : 0}%` }}
          />
        </div>
        <p className="type-meta">{counts?.teams ?? "–"} đội tham dự</p>
      </TableCell>
      {actions && (
        <TableCell data-row-control className="px-2! text-right">
          <TournamentRowMenu entry={entry} actions={actions} />
        </TableCell>
      )}
    </TableRow>
  )
}

/** How many parts a main event has and the few its line has room for, each a link; the rest wait inside the event. */
function PartLinks({
  main,
  parts,
  search,
  href,
  onMore,
}: {
  main: TournamentContent
  parts: TournamentPart[]
  search: string
  href: (id: string) => string
  onMore: () => void
}) {
  if (!parts.length) return null
  const { shown, hidden } = partsOnLine(parts, search)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[54px]">
      <span className="type-meta inline-flex shrink-0 items-center gap-1">
        <Layers className="size-3.5" aria-hidden="true" />
        {parts.length} phần
      </span>
      {shown.map(({ part, phase }) => (
        <Link
          key={part.id}
          to={href(part.id)}
          title={`${part.name} · ${dateRange(part.startsOn ?? undefined, part.endsOn ?? undefined)}`}
          className="type-meta inline-flex h-6 max-w-56 items-center gap-1.5 rounded-md border px-2 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PartPhaseDot phase={phase} />
          <span className="truncate">{partLabel(part.name, main.name)}</span>
        </Link>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={onMore}
          className="type-meta rounded underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{hidden} phần khác
        </button>
      )}
    </div>
  )
}
