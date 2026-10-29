import type { DocumentView, PlayerContent } from "@aov/community-contracts"
import { Edit3 } from "lucide-react"
import { Input } from "@aov/ui/components/input"
import { RegistryLogo } from "./registry-logo"
import { registrySearchText } from "./registry-form-model"
import { TeamRegionBadge, teamRegionName } from "./team-region"

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
  onSearchChange: (value: string) => void
  onCountryChange: (value: string) => void
  onEdit: (player: DocumentView<PlayerContent>) => void
}) {
  const countries = [...new Set(players.map((player) => player.content.country || ""))].sort((a, b) =>
    teamRegionName(a).localeCompare(teamRegionName(b), "vi"),
  )
  const query = registrySearchText(search)
  const shown = players.filter(
    (entry) =>
      (!country || (entry.content.country || "UNKNOWN") === country) &&
      registrySearchText(
        `${entry.content.nickname} ${entry.content.fullName ?? ""} ${entry.content.code} ${(entry.content.aliases ?? []).join(" ")}`,
      ).includes(query),
  )
  return (
    <>
      <div className="tournament-overview-controls">
        <select
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
        <Input
          aria-label="Tìm tuyển thủ"
          placeholder="Tên thi đấu, tên khác…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <small className="tournament-filter-count" role="status">
          {shown.length}/{players.length} tuyển thủ
        </small>
      </div>
      <div className="tournament-registry-list">
        {shown.map((entry) => {
          const body = (
            <>
              <RegistryLogo url={entry.content.photoUrl} name={entry.content.nickname} portrait />
              <div>
                <strong>{entry.content.nickname}</strong>
                {entry.content.fullName && <small>{entry.content.fullName}</small>}
                <TeamRegionBadge code={entry.content.country} />
              </div>
              {canWrite && <Edit3 size={14} className="tournament-card-edit-hint" aria-hidden="true" />}
            </>
          )
          const props = {
            className: "tournament-registry-card",
            id: `tournament-player-${entry.id}`,
            "data-selected": selectedId === entry.id || undefined,
            title: [entry.content.nickname, ...(entry.content.aliases ?? [])].join("\n"),
          }
          return canWrite ? (
            <button
              {...props}
              key={entry.id}
              type="button"
              aria-label={`Sửa tuyển thủ ${entry.content.nickname}`}
              onClick={() => onEdit(entry)}
            >
              {body}
            </button>
          ) : (
            <article {...props} key={entry.id}>
              {body}
            </article>
          )
        })}
      </div>
      {!shown.length && (
        <div className="tournament-empty-inline">
          {players.length ? "Không có tuyển thủ khớp bộ lọc." : "Chưa có hồ sơ tuyển thủ."}
        </div>
      )}
    </>
  )
}
