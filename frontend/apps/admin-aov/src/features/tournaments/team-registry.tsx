import { Edit3, Users } from "lucide-react"
import { useEffect, useState } from "react"
import type { DocumentView, TeamContent } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { TableCell, TableRow } from "@aov/ui/components/table"
import { RegistryLogo } from "./registry-logo"
import { TeamRegionBadge, teamRegionName } from "./team-region"
import { registrySearchText } from "./registry-form-model"
import {
  ManagementEmpty,
  ManagementFooter,
  ManagementPanel,
  ManagementTable,
  ManagementToolbar,
  managementSelectClassName,
  useManagementPagination,
} from "./management-list"

export function TeamRegistry({
  teams,
  country,
  search,
  canWrite,
  onCountryChange,
  onSearchChange,
  onEdit,
  selectedId,
  onRoster,
}: {
  teams: DocumentView<TeamContent>[]
  country: string
  search: string
  canWrite: boolean
  onCountryChange: (country: string) => void
  onSearchChange?: (search: string) => void
  onEdit: (team: DocumentView<TeamContent>) => void
  selectedId?: string
  onRoster?: (team: DocumentView<TeamContent>) => void
}) {
  const [order, setOrder] = useState("asc")
  const countries = [...new Set(teams.map((team) => team.content.country || ""))].sort((a, b) =>
    teamRegionName(a).localeCompare(teamRegionName(b), "vi"),
  )
  const query = registrySearchText(search)
  const shown = teams
    .filter(
      (team) =>
        (!country || (team.content.country || "UNKNOWN") === country) &&
        registrySearchText(
          `${team.content.name} ${team.content.code} ${team.content.shortName ?? ""} ${(team.content.aliases ?? []).join(" ")}`,
        ).includes(query),
    )
    .sort((a, b) => a.content.name.localeCompare(b.content.name, "vi") * (order === "asc" ? 1 : -1))
  const pagination = useManagementPagination(shown, JSON.stringify([search, country, order]), selectedId)
  const reset = () => {
    onCountryChange("")
    onSearchChange?.("")
  }
  const filtered = !!country || !!search.trim()

  useEffect(() => {
    if (selectedId) document.getElementById(`tournament-team-${selectedId}`)?.scrollIntoView?.({ block: "nearest" })
  }, [selectedId, teams, pagination.page])

  return (
    <ManagementPanel>
      <ManagementToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchLabel="Tìm đội tuyển"
        placeholder="Tên đội, tên viết tắt hoặc mã…"
        onReset={filtered ? reset : undefined}
      >
        <select
          className={managementSelectClassName}
          aria-label="Lọc khu vực đội tuyển"
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
        >
          <option value="">Tất cả khu vực</option>
          {countries.map((code) => (
            <option key={code || "UNKNOWN"} value={code || "UNKNOWN"}>
              {teamRegionName(code)}
            </option>
          ))}
          {country && !countries.some((code) => (code || "UNKNOWN") === country) && (
            <option value={country}>{teamRegionName(country === "UNKNOWN" ? "" : country)}</option>
          )}
        </select>
        <select
          className={managementSelectClassName}
          aria-label="Sắp xếp đội tuyển"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        >
          <option value="asc">Tên A–Z</option>
          <option value="desc">Tên Z–A</option>
        </select>
      </ManagementToolbar>
      {shown.length ? (
        <ManagementTable
          label="Danh sách đội tuyển"
          columns={[
            { label: "Đội tuyển" },
            { label: "Khu vực", className: "hidden w-44 @2xl:table-cell" },
            { label: "Tên khác", className: "hidden w-1/4 @4xl:table-cell" },
            ...(onRoster ? [{ label: "Đội hình", className: "w-20 text-right @xl:w-32" }] : []),
          ]}
        >
          {pagination.rows.map((entry) => {
            const body = (
              <>
                <RegistryLogo url={entry.content.logoUrl} name={entry.content.shortName || entry.content.name} />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="type-body break-words">{entry.content.name}</strong>
                    {entry.content.shortName && (
                      <span className="type-label rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {entry.content.shortName}
                      </span>
                    )}
                  </span>
                  <span className="type-meta block truncate">{entry.content.code}</span>
                  <span className="block @2xl:hidden">
                    <TeamRegionBadge code={entry.content.country} />
                  </span>
                </span>
                {canWrite && (
                  <Edit3
                    className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden="true"
                  />
                )}
              </>
            )
            const props = {
              className:
                "group flex w-full min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
              title: [entry.content.name, ...(entry.content.aliases ?? [])].join("\n"),
            }
            return (
              <TableRow
                key={entry.id}
                id={`tournament-team-${entry.id}`}
                data-state={selectedId === entry.id ? "selected" : undefined}
              >
                <TableCell>
                  {canWrite ? (
                    <button
                      {...props}
                      type="button"
                      aria-label={`Sửa đội ${entry.content.name}`}
                      onClick={() => onEdit(entry)}
                    >
                      {body}
                    </button>
                  ) : (
                    <div {...props}>{body}</div>
                  )}
                </TableCell>
                <TableCell className="hidden @2xl:table-cell">
                  <TeamRegionBadge code={entry.content.country} />
                </TableCell>
                <TableCell className="hidden @4xl:table-cell">
                  <span className="type-meta block truncate" title={entry.content.aliases?.join(", ")}>
                    {entry.content.aliases?.join(", ") || "—"}
                  </span>
                </TableCell>
                {onRoster && (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRoster(entry)}
                      aria-label={`Đội hình ${entry.content.name}`}
                    >
                      <Users aria-hidden="true" />
                      <span className="hidden @xl:inline">Đội hình</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </ManagementTable>
      ) : (
        <ManagementEmpty
          title={teams.length ? "Không tìm thấy đội tuyển" : "Chưa có đội tuyển"}
          description={
            teams.length
              ? "Thử tên khác hoặc xóa bộ lọc để xem toàn bộ đội tuyển."
              : "Thêm hồ sơ đội tuyển để quản lý thông tin và đội hình thi đấu."
          }
          onReset={filtered ? reset : undefined}
        />
      )}
      <ManagementFooter count={shown.length} total={teams.length} noun="đội tuyển" {...pagination} />
    </ManagementPanel>
  )
}
