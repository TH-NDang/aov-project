import { Globe } from "lucide-react"

export const TEAM_REGIONS = [
  { id: "VN", name: "Việt Nam" },
  { id: "TH", name: "Thái Lan" },
  { id: "TW/HK/MO", name: "Đài Loan / Hồng Kông / Ma Cao" },
  { id: "TW", name: "Đài Loan" },
  { id: "HK", name: "Hồng Kông" },
  { id: "MO", name: "Ma Cao" },
  { id: "ID", name: "Indonesia" },
  { id: "MY", name: "Malaysia" },
  { id: "SG", name: "Singapore" },
  { id: "PH", name: "Philippines" },
  { id: "LA", name: "Lào" },
  { id: "KH", name: "Campuchia" },
  { id: "MM", name: "Myanmar" },
  { id: "CN", name: "Trung Quốc" },
  { id: "GLOBAL", name: "Quốc tế" },
]

const localFlags = new Set(["VN", "TH", "TW", "ID", "CN"])

export function teamRegionName(code?: string) {
  return TEAM_REGIONS.find((region) => region.id === code)?.name || code || "Chưa xác định khu vực"
}

export function TeamRegionBadge({ code }: { code?: string }) {
  return (
    <span className="tournament-region-badge" title={teamRegionName(code)}>
      {code && localFlags.has(code) ? (
        <img src={`/images/flags/${code.toLowerCase()}.svg`} alt="" loading="lazy" />
      ) : code && code !== "GLOBAL" ? (
        <span className="tournament-region-code" aria-hidden="true">
          {code}
        </span>
      ) : (
        <Globe size={13} aria-hidden="true" />
      )}
      <span>{teamRegionName(code)}</span>
    </span>
  )
}
