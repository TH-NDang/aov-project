import type { ComponentType, ReactNode } from "react"
import type {
  CompetitionPlan,
  CompetitionSnapshot,
  CompetitionView,
  DocumentView,
  GameContent,
  ResolvedMatch,
  RosterMembershipContent,
  SeriesContent,
  TeamContent,
} from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { initials, type TeamView } from "@/features/esports/model/game-view"
import type { Access } from "@/features/esports/pages/esports-shell"
import type { WorkspaceStep } from "./model"

export type WorkspaceAction = "save" | "publish" | "withdraw" | "materialize"

/** What every step of the workspace reads and the few things it may ask the shell to do. */
export type Workspace = {
  entry: CompetitionView
  access: Access
  plan: CompetitionPlan
  /** The plan as last saved, to tell edited fields from saved ones. */
  baseline: CompetitionPlan
  /** The snapshot readers see now; absent while the competition is not published. */
  published?: CompetitionSnapshot | null
  change: <K extends keyof CompetitionPlan>(key: K, value: CompetitionPlan[K]) => void
  /** True while the plan has edits that were not saved yet. */
  dirty: boolean
  busy: boolean
  canEdit: boolean
  resolved: Map<string, ResolvedMatch>
  teams: Record<string, TeamContent>
  team: (id?: string | null) => TeamView
  /** Makes a team picked a moment ago readable before the plan is saved. */
  rememberTeam: (id: string, name: string) => void
  series: DocumentView<SeriesContent>[]
  rosters: DocumentView<RosterMembershipContent>[]
  games?: DocumentView<GameContent>[]
  go: (step: WorkspaceStep) => void
  run: (action: WorkspaceAction) => void
}

export const teamViewOf = (id: string, content?: TeamContent): TeamView =>
  content
    ? {
        id,
        name: content.name,
        shortName: content.shortName || initials(content.name),
        logoUrl: content.logoUrl,
        country: content.country,
      }
    : { id, name: "Chưa xác định", shortName: "TBD" }

export type Tone = "neutral" | "ok" | "warn" | "info" | "gold" | "danger"

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-[var(--aov-success-soft)] text-[var(--aov-success)]",
  warn: "bg-[var(--aov-warning-soft)] text-[var(--aov-warning)]",
  info: "bg-[var(--aov-info-soft)] text-[var(--aov-info)]",
  gold: "bg-[var(--aov-accent-soft)] text-primary",
  danger: "bg-[var(--aov-danger-soft)] text-destructive",
}

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "type-label inline-flex h-6 items-center gap-1.5 rounded-md px-2 whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A titled surface; the workspace uses it for anything that is a list or a table. */
export function Panel({
  title,
  icon: Icon,
  meta,
  action,
  className,
  children,
  label,
}: {
  title?: ReactNode
  icon?: ComponentType<{ className?: string }>
  meta?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
  label?: string
}) {
  return (
    <section className={cn("admin-panel min-w-0 overflow-hidden", className)} aria-label={label}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
            {title && <h2 className="type-section-title">{title}</h2>}
            {meta && <span className="type-meta">{meta}</span>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Progress({ value, total, tone = "gold" }: { value: number; total: number; tone?: "gold" | "ok" }) {
  const share = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <span
      className="block h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
    >
      <span
        className={cn("block h-full rounded-full", tone === "ok" ? "bg-[var(--aov-success)]" : "bg-primary")}
        style={{ width: `${share}%` }}
      />
    </span>
  )
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "type-body rounded-lg px-3.5 py-3",
        tone === "warn" ? "bg-[var(--aov-warning-soft)]" : "bg-[var(--aov-info-soft)]",
      )}
    >
      {children}
    </p>
  )
}
