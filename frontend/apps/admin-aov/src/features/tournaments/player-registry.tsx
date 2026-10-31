import { useState } from "react"
import type { DocumentView, PlayerContent } from "@aov/community-contracts"
import { Edit3 } from "lucide-react"
import { TableCell, TableRow } from "@aov/ui/components/table"
import { RegistryLogo } from "./registry-logo"
import { registrySearchText } from "./registry-form-model"
import { TeamRegionBadge, teamRegionName } from "./team-region"
import {
  ManagementEmpty,
  ManagementFooter,
  ManagementPanel,
  ManagementTable,
  ManagementToolbar,
  managementSelectClassName,
  useManagementPagination,
} from "./management-list"

export function PlayerRegistry({
  players,
  search,
  country,
  canWrite,
  selectedId,
  onSearchChange,
  onCountryChange,
  onEdit,
}: {
  players: DocumentView<PlayerContent>[]
  search: string
  country: string
  canWrite: boolean
  selectedId?: string
  onSearchChange?: (value: string) => void
  onCountryChange: (value: string) => void
  onEdit: (player: DocumentView<PlayerContent>) => void
}) {
  const [order, setOrder] = useState("asc")
  const countries = [...new Set(players.map((player) => player.content.country || ""))].sort((a, b) =>
    teamRegionName(a).localeCompare(teamRegionName(b), "vi"),
  )
  const query = registrySearchText(search)
  const shown = players
    .filter(
      (entry) =>
        (!country || (entry.content.country || "UNKNOWN") === country) &&
        registrySearchText(
          `${entry.content.nickname} ${entry.content.fullName ?? ""} ${entry.content.code} ${(entry.content.aliases ?? []).join(" ")}`,
        ).includes(query),
    )
    .sort((a, b) => a.content.nickname.localeCompare(b.content.nickname, "vi") * (order === "asc" ? 1 : -1))
  const pagination = useManagementPagination(shown, JSON.stringify([search, country, order]), selectedId)
  const filtered = !!country || !!search.trim()
  const reset = () => {
    onCountryChange("")
    onSearchChange?.("")
  }

  return (
    <ManagementPanel>
      <ManagementToolbar
        search={search}
        onSearchChange={onSearchChange}
        searchLabel="Tìm tuyển thủ"
        placeholder="Tên thi đấu, họ tên hoặc tên khác…"
        onReset={filtered ? reset : undefined}
      >
        <select
          className={managementSelectClassName}
          aria-label="Lọc quốc gia tuyển thủ"
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
        >
          <option value="">Tất cả quốc gia</option>
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
          aria-label="Sắp xếp tuyển thủ"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        >
          <option value="asc">Tên A–Z</option>
          <option value="desc">Tên Z–A</option>
        </select>
      </ManagementToolbar>
      {shown.length ? (
        <ManagementTable
          label="Danh sách tuyển thủ"
          columns={[
            { label: "Tuyển thủ" },
            { label: "Quốc gia", className: "hidden w-44 @2xl:table-cell" },
            { label: "Tên khác", className: "hidden w-1/4 @4xl:table-cell" },
          ]}
        >
          {pagination.rows.map((entry) => {
            const body = (
              <>
                <RegistryLogo url={entry.content.photoUrl} name={entry.content.nickname} portrait />
                <span className="min-w-0 flex-1 space-y-1">
                  <strong className="type-body block truncate">{entry.content.nickname}</strong>
                  <span className="type-meta block truncate">{entry.content.fullName || entry.content.code}</span>
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
              title: [entry.content.nickname, entry.content.code, ...(entry.content.aliases ?? [])].join("\n"),
            }
            return (
              <TableRow
                key={entry.id}
                id={`tournament-player-${entry.id}`}
                data-state={selectedId === entry.id ? "selected" : undefined}
              >
                <TableCell>
                  {canWrite ? (
                    <button
                      {...props}
                      type="button"
                      aria-label={`Sửa tuyển thủ ${entry.content.nickname}`}
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
              </TableRow>
            )
          })}
        </ManagementTable>
      ) : (
        <ManagementEmpty
          title={players.length ? "Không tìm thấy tuyển thủ" : "Chưa có tuyển thủ"}
          description={
            players.length
              ? "Thử tên khác hoặc xóa bộ lọc để xem toàn bộ tuyển thủ."
              : "Thêm hồ sơ tuyển thủ để lưu thông tin và sử dụng trong đội hình thi đấu."
          }
          onReset={filtered ? reset : undefined}
        />
      )}
      <ManagementFooter count={shown.length} total={players.length} noun="tuyển thủ" {...pagination} />
    </ManagementPanel>
  )
}
