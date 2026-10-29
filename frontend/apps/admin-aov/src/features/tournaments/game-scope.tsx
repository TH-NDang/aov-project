import { useQuery } from "@tanstack/react-query"
import type { GameContent } from "@aov/community-contracts"
import { CalendarDays, GitBranch } from "lucide-react"
import { GAME_REGIONS } from "./tournament-model"

interface ContextOptions {
  seasons: {
    id: string
    name: string
    patches: { id: string; code: string; title: string; regionalDate?: string | null }[]
  }[]
}
export function GameScope({
  content,
  onChange,
  disabled,
  tournamentRegion,
}: {
  content: GameContent
  onChange: (content: GameContent) => void
  disabled: boolean
  tournamentRegion?: string
}) {
  const query = useQuery({
    queryKey: ["tournament", "wiki-context", content.region, content.locale],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ region: content.region, locale: content.locale })
      const response = await fetch(`/api/wiki/v1/catalog-context?${params}`, { signal, credentials: "omit" })
      if (!response.ok) throw new Error("Catalog context unavailable")
      return response.json() as Promise<ContextOptions>
    },
    staleTime: 60000,
    retry: 1,
  })
  const seasons = query.data?.seasons ?? []
  const season = seasons.find((season) => season.id === content.seasonId)
  const patches = season?.patches ?? seasons.flatMap((season) => season.patches)
  return (
    <section className="tournament-game-scope" aria-label="Phiên bản gameplay của ván">
      <label>
        <span>Thị trường</span>
        <select
          aria-label="Thị trường của ván"
          value={content.region}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...content, region: event.target.value, seasonId: null, patchVariantId: null })
          }
        >
          {GAME_REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </label>
      {content.region === "GLOBAL" && tournamentRegion && !GAME_REGIONS.includes(tournamentRegion) && (
        <p className="tournament-scope-note">
          Giải đấu thuộc {tournamentRegion}. Ván hiện dùng Quốc tế; chọn đúng thị trường thi đấu khi nguồn xác nhận. Mùa
          và patch được chọn riêng cho ván.
        </p>
      )}
      <label>
        <span>
          <CalendarDays size={13} />
          Mùa
        </span>
        <select
          aria-label="Mùa"
          value={content.seasonId ?? ""}
          disabled={disabled || query.isPending}
          onChange={(event) => onChange({ ...content, seasonId: event.target.value || null, patchVariantId: null })}
        >
          <option value="">Chưa xác định</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
          {content.seasonId && !season && <option value={content.seasonId}>Mùa đã liên kết</option>}
        </select>
      </label>
      <label>
        <span>
          <GitBranch size={13} />
          Patch của ván
        </span>
        <select
          aria-label="Patch của ván"
          value={content.patchVariantId ?? ""}
          disabled={disabled || query.isPending}
          onChange={(event) => {
            const patch = seasons
              .flatMap((season) => season.patches.map((patch) => ({ ...patch, seasonId: season.id })))
              .find((patch) => patch.id === event.target.value)
            onChange({
              ...content,
              seasonId: patch?.seasonId ?? content.seasonId,
              patchVariantId: event.target.value || null,
            })
          }}
        >
          <option value="">Chưa xác định patch</option>
          {patches.map((patch) => (
            <option key={patch.id} value={patch.id}>
              {patch.code} · {patch.title}
            </option>
          ))}
          {content.patchVariantId && !patches.some((patch) => patch.id === content.patchVariantId) && (
            <option value={content.patchVariantId}>Patch đã liên kết</option>
          )}
        </select>
      </label>
      {query.isError && (
        <p className="tournament-scope-note">
          Chưa lấy được mốc Wiki của thị trường này. Có thể tiếp tục ghi tên thủ công và bổ sung mốc sau.
          <button type="button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {(content.seasonId || content.patchVariantId) && (
        <label className="tournament-scope-unscoped">
          <input
            type="checkbox"
            checked={content.includeUnscoped ?? false}
            disabled={disabled}
            onChange={(event) => onChange({ ...content, includeUnscoped: event.target.checked })}
          />
          <span>Kèm dữ liệu nền chưa rõ mốc (chỉ để đối chiếu)</span>
        </label>
      )}
      <p className="tournament-scope-note">
        Mốc áp dụng riêng cho ván này. Đổi mùa/patch giữ các lựa chọn đã nhập và sẽ kiểm tra lại khi xuất bản.
      </p>
    </section>
  )
}
