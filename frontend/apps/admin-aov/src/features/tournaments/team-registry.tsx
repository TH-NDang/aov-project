import { Edit3, Users } from "lucide-react"
import { useEffect } from "react"
import type { DocumentView, TeamContent } from "@aov/community-contracts"
import { Input } from "@aov/ui/components/input"
import { RegistryLogo } from "./registry-logo"
import { TeamRegionBadge, teamRegionName } from "./team-region"
import { registrySearchText } from "./registry-form-model"

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
  /** Shows a search box in the toolbar; the registry page searches from its header instead. */
  onSearchChange?: (search: string) => void
  onEdit: (team: DocumentView<TeamContent>) => void
  selectedId?: string
  onRoster?: (team: DocumentView<TeamContent>) => void
}) {
  useEffect(() => {
    if (selectedId) document.getElementById(`tournament-team-${selectedId}`)?.scrollIntoView?.({ block: "nearest" })
  }, [selectedId, teams])
  const countries = [...new Set(teams.map((team) => team.content.country || ""))].sort((a, b) =>
    teamRegionName(a).localeCompare(teamRegionName(b), "vi"),
  )
  const query = registrySearchText(search)
  const shown = teams.filter(
    (team) =>
      (!country || (team.content.country || "UNKNOWN") === country) &&
      registrySearchText(
        `${team.content.name} ${team.content.code} ${team.content.shortName ?? ""} ${(team.content.aliases ?? []).join(" ")}`,
      ).includes(query),
  )
  const groups = [...new Set(shown.map((team) => team.content.country || ""))].sort((a, b) =>
    teamRegionName(a).localeCompare(teamRegionName(b), "vi"),
  )
  return (
    <>
      <div className="tournament-overview-controls">
        <select
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
        {onSearchChange && (
          <Input
            aria-label="Tìm đội tuyển"
            placeholder="Tìm đội tuyển…"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        )}
        <small className="tournament-filter-count" role="status">
          {shown.length}/{teams.length} đội
        </small>
      </div>
      {groups.map((code) => {
        const entries = shown.filter((team) => (team.content.country || "") === code)
        return (
          <section className="tournament-team-group" key={code || "UNKNOWN"}>
            <h2>
              <TeamRegionBadge code={code} />
              <small>{entries.length} đội</small>
            </h2>
            <div className="tournament-registry-list">
              {entries.map((entry) => {
                const body = (
                  <>
                    <RegistryLogo url={entry.content.logoUrl} name={entry.content.shortName || entry.content.name} />
                    <div>
                      <strong className="tournament-team-name">
                        {entry.content.shortName && (
                          <span className="tournament-team-short-name">{entry.content.shortName}</span>
                        )}
                        <span>{entry.content.name}</span>
                      </strong>
                      {!entry.content.shortName && <small>{entry.content.code}</small>}
                    </div>
                    {canWrite && <Edit3 size={14} className="tournament-card-edit-hint" aria-hidden="true" />}
                  </>
                )
                const props = {
                  className: "tournament-registry-card",
                  id: `tournament-team-${entry.id}`,
                  "data-selected": selectedId === entry.id || undefined,
                  title: [entry.content.name, ...(entry.content.aliases ?? [])].join("\n"),
                }
                const card = canWrite ? (
                  <button
                    {...props}
                    type="button"
                    aria-label={`Sửa đội ${entry.content.name}`}
                    onClick={() => onEdit(entry)}
                  >
                    {body}
                  </button>
                ) : (
                  <article {...props}>{body}</article>
                )
                return (
                  <div className="tournament-team-card" key={entry.id}>
                    {card}
                    {onRoster && (
                      <button
                        type="button"
                        className="tournament-team-roster-action"
                        onClick={() => onRoster(entry)}
                        aria-label={`Đội hình ${entry.content.name}`}
                      >
                        <Users size={13} />
                        Đội hình
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
      {!shown.length && (
        <div className="tournament-empty-inline">
          {teams.length
            ? "Không có đội phù hợp với bộ lọc."
            : "Chưa có đội tuyển. Tạo hồ sơ trước, sau đó chọn vào đội hình từng ván."}
        </div>
      )}
    </>
  )
}
