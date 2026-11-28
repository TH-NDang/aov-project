import { Fragment } from "react"
import { Link, useNavigate } from "react-router"
import { CalendarDays, ChevronDown, ChevronUp, Layers, Shapes, ShieldCheck, Swords, Trophy, Users } from "lucide-react"
import type {
  ContentVerificationSummary,
  DocumentView,
  TournamentContent,
  TournamentPart,
  TournamentStats as ContractStats,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Checkbox } from "@aov/ui/components/checkbox"
import { cn } from "@aov/ui/lib/utils"
import { TableCell, TableRow } from "@aov/ui/components/table"
import { TierBadge } from "@/features/esports/components/primitives"
import { dateRange } from "@/features/esports/model/labels"
import { ManagementTable } from "./management-list"
import { PartPhaseDot } from "./part-phase-dot"
import { tournamentTiming } from "../model/record-reason"
import { RegistryLogo } from "./registry-logo"
import { TeamRegionBadge } from "./team-region"
import { TournamentRowMenu, type TournamentRowActions } from "./tournament-row-menu"
import { TournamentRowStatus } from "./tournament-row-status"
import type { RowSelectionState } from "./use-row-selection"
import { championName, type FoldedGroup } from "../model/tournament-groups"
import { partLabel, partsOnLine } from "../model/tournament-parts"
import { ProgressBar } from "./tournament-progress"

type TournamentStats = Omit<ContractStats, "tournamentId">
type Entry = DocumentView<TournamentContent>

const NO_PARTS: TournamentPart[] = []

/** A click on a control of the row, or on a menu it opened, is that control's own. */
const onControl = (event: React.MouseEvent) =>
  !event.currentTarget.contains(event.target as Node) ||
  !!(event.target as Element).closest("button, a, [data-row-control]")

/**
 * A list of main events. Their parts (qualifiers, wildcard, weekly stops, show matches) are not rows of their own:
 * each main event names them on a line under its dates, where a part opens with one click. With `groups` the seasons
 * of a circuit stand together under its name, and `entries` are the rows on screen. A row is a link to its tournament
 * under the controls it holds. Without `actions` and `selection` the list is for reading only.
 */
export function TournamentList({
  entries,
  groups,
  onToggleGroup,
  stats,
  parts,
  published,
  checked,
  actions,
  selection,
  search = "",
  href = (id) => `/tournaments/${id}`,
}: {
  entries: Entry[]
  groups?: FoldedGroup[]
  onToggleGroup?: (key: string) => void
  /** Missing while the counts are on their way, so no tournament reads as empty meanwhile. */
  stats?: Map<string, TournamentStats>
  /** Parts by the id of their main event. */
  parts?: ReadonlyMap<string, TournamentPart[]>
  /** Ids of the tournaments readers see on Stream; missing while that is not known. */
  published?: ReadonlySet<string>
  /** How far the owner's own checks of each tournament go, by its id; Admin only. */
  checked?: ReadonlyMap<string, ContentVerificationSummary>
  actions?: TournamentRowActions
  selection?: Pick<RowSelectionState, "ids" | "toggle" | "toggleAll">
  /** What the list was searched for: a part it names moves to the front of its line. */
  search?: string
  /** Where a tournament or a part of one opens. */
  href?: (id: string) => string
}) {
  const ticked = selection?.ids.size ?? 0
  const lead = selection ? 2 : 1
  const row = (entry: Entry, group?: FoldedGroup) => (
    <TournamentRow
      key={entry.id}
      entry={entry}
      circuit={group?.circuit?.name}
      hideRegion={!!group?.region}
      counts={stats && (stats.get(entry.id) ?? { teams: 0, matches: 0, played: 0 })}
      parts={parts?.get(entry.id) ?? NO_PARTS}
      published={published?.has(entry.id)}
      checked={checked?.get(entry.id)}
      search={search}
      href={href}
      actions={actions}
      selected={selection?.ids.has(entry.id)}
      onToggle={selection && ((range) => selection.toggle(entry.id, range))}
    />
  )
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
        { label: "Trận đấu", className: "hidden w-44 @4xl:table-cell" },
        ...(actions
          ? [{ label: "Thao tác", header: <span className="sr-only">Thao tác</span>, className: "w-14" }]
          : []),
      ]}
    >
      {groups
        ? groups.map((group) => (
            <Fragment key={group.key}>
              {(groups.length > 1 || group.circuit) && <GroupHeading group={group} lead={lead} menu={!!actions} />}
              {group.entries.map((entry) => row(entry, group))}
              {onToggleGroup && group.foldable && (
                <GroupFold group={group} lead={lead} menu={!!actions} onToggle={() => onToggleGroup(group.key)} />
              )}
            </Fragment>
          ))
        : entries.map((entry) => row(entry))}
    </ManagementTable>
  )
}

/**
 * The rest of a line that speaks for a group: one empty cell per column on screen. A single cell across every column
 * would also span the ones a narrow list hides, and squeeze the names beside them.
 */
function RestOfLine({ menu }: { menu: boolean }) {
  return (
    <>
      <TableCell className="hidden @2xl:table-cell" />
      <TableCell className="hidden @4xl:table-cell" />
      {menu && <TableCell />}
    </>
  )
}

/** The circuit the rows below belong to, with the logo of its newest season. */
function GroupHeading({ group, lead, menu }: { group: FoldedGroup; lead: number; menu: boolean }) {
  const newest = group.circuit ? group.entries[0]?.content : undefined
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={lead}>
        <div className="flex min-w-0 items-center gap-3">
          {newest ? (
            <RegistryLogo url={newest.logoUrl} darkUrl={newest.logoDarkUrl} name={group.circuit!.name} />
          ) : (
            <span className="grid size-[42px] shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Shapes className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="type-section-title">{group.circuit?.name ?? "Giải khác"}</h2>
            <span className="type-meta flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {group.region && <TeamRegionBadge code={group.region} />}
              <span>
                {group.total} {group.circuit ? "mùa" : "giải"}
                {group.years && ` · ${group.years}`}
              </span>
            </span>
          </div>
        </div>
      </TableCell>
      <RestOfLine menu={menu} />
    </TableRow>
  )
}

/** Shows the older seasons of a circuit, or folds them away again. */
function GroupFold({
  group,
  lead,
  menu,
  onToggle,
}: {
  group: FoldedGroup
  lead: number
  menu: boolean
  onToggle: () => void
}) {
  const noun = group.circuit ? "mùa" : "giải"
  const name = group.circuit?.name ?? "Giải khác"
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={lead} className="py-1!">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          aria-expanded={group.hidden === 0}
          aria-label={group.hidden ? `Xem thêm ${group.hidden} ${noun} của ${name}` : `Thu gọn ${name}`}
          onClick={onToggle}
        >
          {group.hidden ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          {group.hidden ? `Xem thêm ${group.hidden} ${noun}` : "Thu gọn"}
        </Button>
      </TableCell>
      <RestOfLine menu={menu} />
    </TableRow>
  )
}

function TournamentRow({
  entry,
  circuit,
  hideRegion,
  counts,
  parts,
  published,
  checked,
  search,
  href,
  actions,
  selected,
  onToggle,
}: {
  entry: Entry
  /** The circuit whose name already stands above the row; the row then names only its season. */
  circuit?: string
  /** The region already stands beside the circuit's name. */
  hideRegion?: boolean
  counts?: TournamentStats
  parts: TournamentPart[]
  published?: boolean
  checked?: ContentVerificationSummary
  search: string
  href: (id: string) => string
  actions?: TournamentRowActions
  selected?: boolean
  onToggle?: (range: boolean) => void
}) {
  const navigate = useNavigate()
  const content = entry.content
  // Among the seasons of a circuit the dates already say how long ago one ended.
  const timing = circuit && content.status === "FINISHED" ? "" : tournamentTiming(content)
  const champion = content.status === "FINISHED" ? championName(content) : null
  const status = (
    <TournamentRowStatus
      content={content}
      published={published}
      onFix={actions && ((next) => actions.changeStatus(entry, next))}
    />
  )
  return (
    <TableRow
      className="group/row relative cursor-pointer [&>td]:align-top"
      data-state={selected ? "selected" : undefined}
      // What stands above the link, such as a mark with a hint, opens the row as the link does.
      onClick={(event) => {
        if (!onControl(event)) void navigate(href(entry.id))
      }}
    >
      {onToggle && (
        <TableCell data-row-control className="relative z-1 cursor-default pr-0! select-none">
          <Checkbox
            className="mt-0.5"
            aria-label={`Chọn ${content.name}`}
            checked={selected}
            // Shift held down extends the selection; the browser would mark the text in between instead.
            onMouseDown={(event) => event.shiftKey && event.preventDefault()}
            onClick={(event) => onToggle(event.shiftKey)}
          />
        </TableCell>
      )}
      <TableCell className="@max-2xl:px-2!">
        {/* The link reaches over the whole row; its own words stand above it, so their hints still show. */}
        <Link
          to={href(entry.id)}
          aria-label={`Mở giải ${content.name}`}
          className="flex w-full min-w-0 items-start gap-3 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {circuit ? (
            // Lines the season up with its circuit's name; the logo stands once, beside that name.
            <span className="hidden w-0.5 shrink-0 @2xl:block" aria-hidden="true" />
          ) : (
            <RegistryLogo url={content.logoUrl} darkUrl={content.logoDarkUrl} name={content.name} />
          )}
          <span className="relative z-1 min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <strong className="type-body underline-offset-2 group-hover/row:underline" title={content.name}>
                {partLabel(content.name, circuit)}
              </strong>
              <TierBadge tier={content.tier} compact />
              {champion && (
                <span className="type-body inline-flex min-w-0 items-center gap-1.5 text-(--aov-game-gold)">
                  <Trophy className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Nhà vô địch:</span>
                  <span className="truncate text-foreground">{champion}</span>
                </span>
              )}
            </span>
            <span className="type-meta flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {!hideRegion && <TeamRegionBadge code={content.region} />}
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                {dateRange(content.startsOn, content.endsOn)}
              </span>
              {timing && <span className="whitespace-nowrap">{timing}</span>}
              {counts && counts.teams > 0 && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Users className="size-3.5 shrink-0" aria-hidden="true" />
                  {counts.teams} đội
                </span>
              )}
              {counts && counts.matches > 0 && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap @4xl:hidden">
                  <Swords className="size-3.5 shrink-0" aria-hidden="true" />
                  {counts.played}/{counts.matches} trận đã đấu
                </span>
              )}
              {checked && (
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-(--aov-success)"
                  title="Số phần bạn đã tự kiểm chứng; mở giải để xem phần nào đã đổi sau đó"
                >
                  <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                  Kiểm chứng {checked.parts} phần
                </span>
              )}
            </span>
          </span>
        </Link>
        {/* Indented by what stands before the tournament's name, so it starts under it. */}
        <div className={cn("mt-2 @2xl:hidden", !circuit && "pl-[54px]")}>{status}</div>
        <PartLinks
          main={entry}
          parts={parts}
          search={search}
          href={href}
          className={circuit ? "@2xl:pl-3.5" : "pl-[54px]"}
        />
      </TableCell>
      <TableCell className="hidden @2xl:table-cell">{status}</TableCell>
      <TableCell className="hidden @4xl:table-cell">
        <span className="flex items-center gap-2.5">
          <span className="type-body w-16 shrink-0 text-right tabular-nums">
            {counts?.played ?? "–"}
            <span className="text-muted-foreground"> / {counts?.matches ?? "–"}</span>
          </span>
          <ProgressBar played={counts?.played ?? 0} matches={counts?.matches ?? 0} />
        </span>
      </TableCell>
      {actions && (
        <TableCell data-row-control className="relative z-1 px-2! text-right">
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
  className,
}: {
  main: Entry
  parts: TournamentPart[]
  search: string
  href: (id: string) => string
  className?: string
}) {
  if (!parts.length) return null
  const { shown, hidden } = partsOnLine(parts, search)
  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", className)}>
      <span className="type-meta inline-flex shrink-0 items-center gap-1">
        <Layers className="size-3.5" aria-hidden="true" />
        {parts.length} phần
      </span>
      {shown.map(({ part, phase }) => (
        <Link
          key={part.id}
          to={href(part.id)}
          title={`${part.name} · ${dateRange(part.startsOn ?? undefined, part.endsOn ?? undefined)}`}
          className="type-meta relative z-1 inline-flex h-6 max-w-56 items-center gap-1.5 rounded-md border px-2 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PartPhaseDot phase={phase} />
          <span className="truncate">{partLabel(part.name, main.content.name)}</span>
        </Link>
      ))}
      {hidden > 0 && (
        <Link
          to={href(main.id)}
          className="type-meta relative z-1 rounded underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{hidden} phần khác
        </Link>
      )}
    </div>
  )
}
