import { useQuery } from "@tanstack/react-query"
import type { GameContent } from "@aov/community-contracts"
import { CalendarDays, GitBranch } from "lucide-react"
import { GAME_REGIONS } from "../model/tournament-model"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { fetchCatalogContext, tournamentKeys, type GamePatchScope } from "../api/tournament-api"
import { NativeSelect } from "@/components/native-select"

export function GameScope({
  content,
  onChange,
  disabled,
  tournamentRegion,
  scope,
}: {
  content: GameContent
  onChange: (content: GameContent) => void
  disabled: boolean
  tournamentRegion?: string
  /** Where the game's patch comes from when it names none of its own (spec 04, patch ranges). */
  scope?: GamePatchScope
}) {
  const query = useQuery({
    queryKey: tournamentKeys.catalogContext(content.region, content.locale),
    queryFn: ({ signal }) => fetchCatalogContext(content.region, content.locale, signal),
    staleTime: 60000,
    retry: 1,
  })
  const seasons = query.data?.seasons ?? []
  const season = seasons.find((season) => season.id === content.seasonId)
  const patches = season?.patches ?? seasons.flatMap((season) => season.patches)
  const own = !!content.seasonId || !!content.patchVariantId
  const fromStage = !own && scope?.source === "STAGE"
  const unset = fromStage ? "Theo giai đoạn" : "Chưa xác định"
  return (
    <section className="tournament-game-scope" aria-label="Phiên bản gameplay của ván">
      <StageScopeNote scope={scope} own={own} />
      <label>
        <span>Thị trường</span>
        <NativeSelect
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
        </NativeSelect>
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
        <NativeSelect
          aria-label="Mùa"
          value={content.seasonId ?? ""}
          disabled={disabled || query.isPending}
          onChange={(event) => onChange({ ...content, seasonId: event.target.value || null, patchVariantId: null })}
        >
          <option value="">{unset}</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
          {content.seasonId && !season && <option value={content.seasonId}>Mùa đã liên kết</option>}
        </NativeSelect>
      </label>
      <label>
        <span>
          <GitBranch size={13} />
          Patch của ván
        </span>
        <NativeSelect
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
          <option value="">{fromStage ? "Theo giai đoạn" : "Chưa xác định patch"}</option>
          {patches.map((patch) => (
            <option key={patch.id} value={patch.id}>
              {patch.code} · {patch.title}
            </option>
          ))}
          {content.patchVariantId && !patches.some((patch) => patch.id === content.patchVariantId) && (
            <option value={content.patchVariantId}>Patch đã liên kết</option>
          )}
        </NativeSelect>
      </label>
      {query.isError && (
        <p className="tournament-scope-note">
          Chưa lấy được mốc Wiki của thị trường này. Có thể tiếp tục ghi tên thủ công và bổ sung mốc sau.
          <button type="button" onClick={() => void query.refetch()}>
            Thử lại
          </button>
        </p>
      )}
      {(own || fromStage) && (
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
        Để trống thì ván theo patch của giai đoạn. Chỉ chọn riêng khi ván là ngoại lệ, ví dụ trận đá bù. Đổi mùa hoặc
        patch giữ các lựa chọn đã nhập và sẽ kiểm tra lại khi xuất bản.
      </p>
    </section>
  )
}

/** Which patch the game is played on when it names none, and why: the stage line, or no line at all. */
function StageScopeNote({ scope, own }: { scope?: GamePatchScope; own: boolean }) {
  if (!scope) return null
  if (own)
    return (
      <p className="tournament-scope-note">
        Ván ghi patch riêng, khác giai đoạn. Chọn "Theo giai đoạn" để bỏ ngoại lệ.
      </p>
    )
  if (scope.source === "NONE")
    return (
      <p className="tournament-scope-note">
        Ván chưa thuộc phạm vi patch nào: giai đoạn chưa có dòng phiên bản, hoặc ván diễn ra trước dòng đầu tiên.
      </p>
    )
  return (
    <p className="tournament-scope-note">
      <strong>Theo giai đoạn:</strong>{" "}
      {[scope.lineLabel, scope.lineName].filter(Boolean).join(" · ") || "dòng phiên bản"}
      {scope.lineReleasedOn && <> (từ {formatCalendarDate(scope.lineReleasedOn)})</>}
      {!scope.patchId && " · dòng chưa gắn patch Wiki"}
    </p>
  )
}
