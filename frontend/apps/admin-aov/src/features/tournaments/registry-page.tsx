import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import type { DocumentView, PlayerContent, TeamContent } from "@aov/community-contracts"
import { ArrowLeft, Plus, Upload, UserRound, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { Page, PageHeader } from "@/components/page-header"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { useRecords } from "@/features/esports/data/use-esports-data"
import { RegistryEditor } from "./registry-editor"
import { TeamRegistry } from "./team-registry"
import { PlayerRegistry } from "./player-registry"
import { TeamRosterSheet } from "./team-roster-sheet"
import { RecordTrash } from "./record-trash"
import { RecordStateMenu } from "./record-state-menu"
import { RegistryImportSheet } from "./registry-import"
import { tournamentError } from "./tournament-api"
import "./tournament-styles"

type Tab = "teams" | "players"
type Editor = { kind: Tab; entry?: DocumentView<TeamContent | PlayerContent> }

/** Shared identities (teams and players) used by every tournament; tournament pages live under /tournaments. */
export function RegistryPage() {
  return <AccessGate>{(access) => <Registry canWrite={access.canWrite} actorKey={access.actorKey} />}</AccessGate>
}

function Registry({ canWrite, actorKey }: { canWrite: boolean; actorKey: string }) {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "players" ? "players" : "teams"
  const deleted = params.get("state") === "deleted"
  const country = params.get("country") ?? ""
  const [search, setSearch] = useState("")
  const [editor, setEditor] = useState<Editor | null>(null)
  const [importing, setImporting] = useState(false)
  const [rosterTeamId, setRosterTeamId] = useState<string | null>(null)
  const teams = useRecords("teams")
  const players = useRecords("players")
  const tournaments = useRecords("tournaments")
  const rosterTeam = teams.data?.find((entry) => entry.id === rosterTeamId)
  const navigate = (values: Record<string, string | null>) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  const active = tab === "teams" ? teams : players

  return (
    <Page className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        title="Đội & tuyển thủ"
        description="Danh tính dùng chung cho mọi giải. Đội hình theo từng giải được ghi ở trang đội tham dự của giải."
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tournaments">
                <ArrowLeft size={14} /> Giải đấu
              </Link>
            </Button>
            {canWrite && (
              <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
                <Upload size={14} /> Nhập dữ liệu
              </Button>
            )}
            {canWrite && !deleted && (
              <Button size="sm" onClick={() => setEditor({ kind: tab })}>
                <Plus size={14} /> {tab === "teams" ? "Thêm đội" : "Thêm tuyển thủ"}
              </Button>
            )}
            <RecordStateMenu deleted={deleted} onChange={(value) => navigate({ state: value ? "deleted" : null })} />
          </>
        }
      />
      <nav className="flex gap-1 border-b" aria-label="Danh mục">
        {(
          [
            { id: "teams", label: "Đội tuyển", icon: Users, count: teams.data?.length },
            { id: "players", label: "Tuyển thủ", icon: UserRound, count: players.data?.length },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => {
              setSearch("")
              navigate({ tab: item.id === "teams" ? null : item.id })
            }}
            className={cn(
              "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium",
              tab === item.id ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon size={15} /> {item.label}
            <small className="text-muted-foreground">{item.count}</small>
          </button>
        ))}
      </nav>
      {deleted ? (
        <RecordTrash key={tab} initialKind={tab} actorKey={actorKey} canWrite={canWrite} />
      ) : active.error ? (
        <p role="alert" className="text-sm text-destructive">
          {tournamentError(active.error)}
        </p>
      ) : active.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải…
        </p>
      ) : tab === "teams" ? (
        <TeamRegistry
          teams={teams.data ?? []}
          {...{ country, search, canWrite }}
          onCountryChange={(value) => navigate({ country: value || null })}
          onSearchChange={setSearch}
          onEdit={(entry) => setEditor({ kind: "teams", entry })}
          onRoster={(team) => setRosterTeamId(team.id)}
        />
      ) : (
        <PlayerRegistry
          players={players.data ?? []}
          {...{ country, search, canWrite }}
          onSearchChange={setSearch}
          onCountryChange={(value) => navigate({ country: value || null })}
          onEdit={(entry) => setEditor({ kind: "players", entry })}
        />
      )}
      {editor && (
        <RegistryEditor
          kind={editor.kind}
          entry={editor.entry}
          open
          onClose={() => setEditor(null)}
          teams={teams.data ?? []}
          tournaments={tournaments.data ?? []}
        />
      )}
      {importing && canWrite && <RegistryImportSheet key={actorKey} onClose={() => setImporting(false)} />}
      {rosterTeam && (
        <TeamRosterSheet
          key={rosterTeam.id}
          team={rosterTeam}
          tournaments={tournaments.data ?? []}
          players={players.data ?? []}
          {...{ canWrite, actorKey }}
          onClose={() => setRosterTeamId(null)}
        />
      )}
    </Page>
  )
}
