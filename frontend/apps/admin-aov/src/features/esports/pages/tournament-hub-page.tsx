import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { Plus, Search, Trophy, Upload, Users, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { RegistryImportSheet } from "@/features/tournaments/registry-import"
import { useRecords } from "../data/use-esports-data"
import { EmptyState } from "../components/primitives"
import { TournamentCard, type TournamentStats } from "../components/tournament-cards"
import { STATUS_LABELS, TIER_LABELS } from "../model/labels"
import { AccessGate, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

type StatusFilter = "all" | "ONGOING" | "UPCOMING" | "FINISHED"
const STATUS_FILTERS: StatusFilter[] = ["all", "ONGOING", "UPCOMING", "FINISHED"]
const STATUS_ORDER: Record<string, number> = { ONGOING: 0, UPCOMING: 1, ANNOUNCED: 2, UNKNOWN: 3, FINISHED: 4 }

export function TournamentHubPage() {
  return <AccessGate>{(access) => <Hub access={access} />}</AccessGate>
}

function Hub({ access }: { access: Access }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const status = (STATUS_FILTERS.find((value) => value === params.get("status")) ?? "all") as StatusFilter
  const tier = params.get("tier") ?? ""
  const tournaments = useRecords("tournaments")
  const series = useRecords("series")
  const teams = useRecords("teams")

  const stats = useMemo(() => {
    const result = new Map<string, TournamentStats>()
    for (const entry of series.data ?? []) {
      const current = result.get(entry.content.tournamentId) ?? { teams: 0, matches: 0, played: 0 }
      current.matches++
      if (entry.content.result) current.played++
      result.set(entry.content.tournamentId, current)
    }
    for (const [tournamentId, value] of result)
      value.teams = new Set(
        (series.data ?? [])
          .filter((entry) => entry.content.tournamentId === tournamentId)
          .flatMap((entry) => [entry.content.teamAId, entry.content.teamBId]),
      ).size
    return result
  }, [series.data])

  const visible = (tournaments.data ?? [])
    .filter((entry) => status === "all" || (entry.content.status ?? "UNKNOWN") === status)
    .filter((entry) => !tier || entry.content.tier === tier)
    .filter((entry) =>
      `${entry.content.name} ${entry.content.code} ${entry.content.region}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.content.status ?? "UNKNOWN"] ?? 3) - (STATUS_ORDER[b.content.status ?? "UNKNOWN"] ?? 3) ||
        (b.content.startsOn ?? "").localeCompare(a.content.startsOn ?? ""),
    )
  const tiers = [
    ...new Set((tournaments.data ?? []).map((entry) => entry.content.tier).filter(Boolean)),
  ] as NonNullable<TournamentContent["tier"]>[]
  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value && value !== "all") next.set(key, value)
      else next.delete(key)
      return next
    })
  const open = (entry: DocumentView<TournamentContent>) => navigate(tournamentPath(entry.id))
  const error = tournaments.error ?? series.error

  return (
    <EsportsPage>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Trophy size={24} className="text-[var(--esp-gold)]" /> Giải đấu
          </h1>
          <p className="text-sm text-muted-foreground">
            Lịch, kết quả, đội hình và diễn biến từng ván gắn với video YouTube chính thức.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tournaments/registry">
              <Users size={14} /> Đội & tuyển thủ
            </Link>
          </Button>
          {access.canWrite && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <Upload size={14} /> Nhập dữ liệu
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} /> Tạo giải
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border p-0.5" role="group" aria-label="Trạng thái">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setFilter("status", value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition",
                status === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "Tất cả" : STATUS_LABELS[value]}
            </button>
          ))}
        </div>
        {tiers.length > 1 && (
          <select
            aria-label="Hạng giải"
            value={tier}
            onChange={(event) => setFilter("tier", event.target.value)}
            className="h-8 rounded-full border bg-background px-3 text-xs"
          >
            <option value="">Mọi hạng</option>
            {tiers.map((value) => (
              <option key={value} value={value}>
                {TIER_LABELS[value]}
              </option>
            ))}
          </select>
        )}
        <div className="relative ml-auto w-full @xl:w-64">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm giải…"
            aria-label="Tìm giải"
            className="h-8 rounded-full pl-8"
          />
          {search && (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error ? (
        <LoadError error={error} onRetry={() => void Promise.all([tournaments.refetch(), series.refetch()])} />
      ) : tournaments.isPending ? (
        <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-60 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {visible.map((entry, index) => (
            <TournamentCard
              key={entry.id}
              content={entry.content}
              stats={stats.get(entry.id) ?? { teams: 0, matches: 0, played: 0 }}
              featured={index === 0 && entry.content.status === "ONGOING" && status === "all" && !search}
              onOpen={() => open(entry)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy size={28} />}
          title={search || status !== "all" ? "Không có giải phù hợp" : "Chưa có giải đấu"}
        >
          {access.canWrite && !tournaments.data?.length
            ? `Tạo giải, sau đó thêm đội (${teams.data?.length ?? 0} đội đã có) và lịch thi đấu.`
            : "Thử bỏ bớt bộ lọc."}
        </EmptyState>
      )}

      {creating && (
        <RegistryEditor
          kind="tournaments"
          open
          onClose={() => setCreating(false)}
          teams={teams.data ?? []}
          tournaments={tournaments.data ?? []}
        />
      )}
      {importing && <RegistryImportSheet key={access.actorKey} onClose={() => setImporting(false)} />}
    </EsportsPage>
  )
}
