import { useState } from "react"
import { Link, useSearchParams } from "react-router"
import type { DocumentView, PlayerContent, TeamContent } from "@aov/community-contracts"
import { Check, List, Plus, Trash2, Trophy, Upload, UserRound, Users, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { Page, PageHeader } from "@/components/page-header"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { SearchField } from "@/components/search-field"
import { AccessGate } from "@/features/esports/pages/esports-shell"
import { useRecords } from "@/features/esports/data/use-esports-data"
import { RegistryEditor } from "./registry-editor"
import { TeamRegistry } from "./team-registry"
import { PlayerRegistry } from "./player-registry"
import { TeamRosterSheet } from "./team-roster-sheet"
import { RecordTrash } from "./record-trash"
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
        search={
          deleted ? undefined : (
            <SearchField
              placement="header"
              label={tab === "teams" ? "Tìm đội tuyển" : "Tìm tuyển thủ"}
              placeholder={tab === "teams" ? "Tìm đội tuyển…" : "Tên thi đấu, tên khác…"}
              shortcut
              value={search}
              onChange={setSearch}
            />
          )
        }
        actions={
          <>
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
            <PageActionsMenu label="Đội & tuyển thủ: thêm, nhập và thùng rác">
              {canWrite && (
                <>
                  <DropdownMenuItem disabled={deleted} onSelect={() => setEditor({ kind: tab })}>
                    <Plus />
                    {tab === "teams" ? "Thêm đội" : "Thêm tuyển thủ"}
                  </DropdownMenuItem>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/tournaments">
                  <Trophy />
                  Giải đấu
                </Link>
              </DropdownMenuItem>
            </PageActionsMenu>
          </>
        }
      />
      <FilterTabs label="Danh mục">
        {(
          [
            { id: "teams", label: "Đội tuyển", icon: Users, count: teams.data?.length },
            { id: "players", label: "Tuyển thủ", icon: UserRound, count: players.data?.length },
          ] as const
        ).map((item) => (
          <FilterTab
            key={item.id}
            active={tab === item.id}
            count={item.count}
            onClick={() => {
              setSearch("")
              navigate({ tab: item.id === "teams" ? null : item.id })
            }}
          >
            <item.icon /> {item.label}
          </FilterTab>
        ))}
      </FilterTabs>
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
          onEdit={(entry) => setEditor({ kind: "teams", entry })}
          onRoster={(team) => setRosterTeamId(team.id)}
        />
      ) : (
        <PlayerRegistry
          players={players.data ?? []}
          {...{ country, search, canWrite }}
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
