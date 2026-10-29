import { Fragment, type ReactNode } from "react"
import { Link } from "react-router"
import { ChevronRight, RefreshCw, Trophy } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Page } from "@/components/page-header"
import { tournamentError } from "@/features/tournaments/tournament-api"
import { useTournamentAccess } from "../data/use-esports-data"
import "@/features/tournaments/tournament-styles"
import "../esports.css"

export type Access = ReturnType<typeof useTournamentAccess>

export function EsportsPage({ children }: { children: ReactNode }) {
  return <Page className="esports mx-auto w-full max-w-[1400px] gap-5">{children}</Page>
}

/** Resolves community-service capabilities before rendering; read-only users get the same pages without edit controls. */
export function AccessGate({ children }: { children: (access: Access) => ReactNode }) {
  const access = useTournamentAccess()
  if (access.me.isPending)
    return (
      <EsportsPage>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-xl" />
      </EsportsPage>
    )
  if (access.me.isError || !access.canRead)
    return (
      <EsportsPage>
        <div className="flex flex-col items-center gap-3 rounded-2xl border px-6 py-14 text-center" role="alert">
          <Trophy size={32} className="text-muted-foreground" />
          <h1 className="text-lg font-semibold">
            {access.me.isError ? "Chưa mở được dữ liệu giải đấu" : "Bạn chưa có quyền xem giải đấu"}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {access.me.isError
              ? tournamentError(access.me.error)
              : "Cần quyền tournament:read của dịch vụ cộng đồng. Quyền Wiki được quản lý riêng."}
          </p>
          <Button variant="outline" size="sm" onClick={() => void access.me.refetch()}>
            <RefreshCw size={14} /> Thử lại
          </Button>
        </div>
      </EsportsPage>
    )
  return <>{children(access)}</>
}

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <ChevronRight size={14} className="shrink-0" aria-hidden="true" />}
          {item.to ? (
            <Link to={item.to} className="truncate hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
      role="alert"
    >
      <span className="flex-1">{tournamentError(error)}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} /> Tải lại
      </Button>
    </div>
  )
}

export const tournamentPath = (tournamentId: string) => `/tournaments/${tournamentId}`
export const matchPath = (tournamentId: string, seriesId: string) => `/tournaments/${tournamentId}/matches/${seriesId}`
export const gamePath = (tournamentId: string, seriesId: string, gameId: string) =>
  `${matchPath(tournamentId, seriesId)}/games/${gameId}`
