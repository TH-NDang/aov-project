import { useState } from "react"
import { Navigate, useSearchParams } from "react-router"
import type { DocumentView, PlayerContent, TeamContent } from "@aov/community-contracts"
import { Check, List, Plus, Trash2, Upload, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { Page, PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { AccessGate, LoadError } from "@/features/esports/pages/esports-shell"
import { useRecords } from "@/features/esports/data/use-esports-data"
import { RegistryEditor } from "./registry-editor"
import { TeamRegistry } from "./team-registry"
import { PlayerRegistry } from "./player-registry"
import { TeamRosterSheet } from "./team-roster-sheet"
import { RecordTrash } from "./record-trash"
import { RegistryImportSheet } from "./registry-import"
import { ManagementLoading } from "./management-list"
import "./tournament-styles"

type RegistryKind = "teams" | "players"
type Editor = { kind: RegistryKind; entry?: DocumentView<TeamContent | PlayerContent> }

export function LegacyRegistryRedirect() {
  const [params] = useSearchParams()
  const pathname = params.get("tab") === "players" ? "/players" : "/teams"
  const search = new URLSearchParams(params)
  search.delete("tab")
  return <Navigate to={{ pathname, search: search.toString() }} replace />
}

/** Shared identities (teams and players) used by every tournament; tournament pages live under /tournaments. */
export function RegistryPage({ kind }: { kind: RegistryKind }) {
  return (
    <AccessGate>
      {(access) => <Registry key={kind} kind={kind} canWrite={access.canWrite} actorKey={access.actorKey} />}
    </AccessGate>
  )
}

function Registry({ kind, canWrite, actorKey }: { kind: RegistryKind; canWrite: boolean; actorKey: string }) {
  const [params, setParams] = useSearchParams()
  const title = kind === "teams" ? "Đội tuyển" : "Tuyển thủ"
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
  const active = kind === "teams" ? teams : players

  return (
    <Page className="mx-auto w-full max-w-[1400px] gap-5">
      <PageHeader
        title={title}
        description={
          kind === "teams"
            ? "Hồ sơ đội tuyển và đội hình theo từng giải đấu."
            : "Hồ sơ, tên thi đấu và các tên khác của tuyển thủ."
        }
        actions={
          <>
            {canWrite && !deleted && (
              <Button onClick={() => setEditor({ kind })}>
                <Plus aria-hidden="true" /> {kind === "teams" ? "Thêm đội tuyển" : "Thêm tuyển thủ"}
              </Button>
            )}
            {deleted && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate({ state: null })}
                title="Về danh sách đang dùng"
              >
                <Trash2 size={14} /> Thùng rác <X size={14} />
              </Button>
            )}
            <PageActionsMenu label={`${title}: nhập dữ liệu và thùng rác`}>
              {canWrite && (
                <>
                  <DropdownMenuItem onSelect={() => setImporting(true)}>
                    <Upload />
                    Nhập dữ liệu
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onSelect={() => navigate({ state: null })}>
                <List />
                Đang dùng{!deleted && <Check className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ state: "deleted" })}>
                <Trash2 />
                Thùng rác{deleted && <Check className="ml-auto" />}
              </DropdownMenuItem>
            </PageActionsMenu>
          </>
        }
      />
      {deleted ? (
        <RecordTrash key={kind} initialKind={kind} actorKey={actorKey} canWrite={canWrite} />
      ) : active.error ? (
        <LoadError error={active.error} onRetry={() => void active.refetch()} />
      ) : active.isPending ? (
        <ManagementLoading />
      ) : kind === "teams" ? (
        <TeamRegistry
          teams={teams.data ?? []}
          {...{ country, search, canWrite }}
          onSearchChange={setSearch}
          onCountryChange={(value) => navigate({ country: value || null })}
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
