import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, GitBranch, Info } from "lucide-react"
import { DataLanguage } from "../editing/data-language"
import { ContextSetup } from "../setup/context-setup"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import type { Region } from "@/lib/hero-types"
import type { components } from "../../generated/hero-api"
import { publishingKeys } from "@/lib/api/publishing-api"
import { NativeSelect } from "@/components/native-select"
import { usePublicationOverview } from "../../api/publication-overview"

export type ImportContext = components["schemas"]["AuthoringContext"]
type Season = components["schemas"]["Season"]

export function ImportContextPicker({
  regions,
  value,
  onChange,
  disabled,
  locale,
  onLocaleChange,
}: {
  regions: Region[]
  value: ImportContext | null
  /** `automatic` is set when the picker offers the current patch itself, before anyone chose. */
  onChange: (value: ImportContext | null, automatic?: boolean) => void
  disabled: boolean
  /** Left out where the language does not matter for what is being chosen. */
  locale?: string
  onLocaleChange?: (value: string) => void
}) {
  const [setup, setSetup] = useState<"region" | "season" | "patch" | null>(null)
  const capabilities = useSession().actor?.capabilities ?? []
  const regionId = ""
  const [seasonId, setSeasonId] = useState(value?.seasonId ?? "")
  useEffect(() => {
    if (value?.seasonId) setSeasonId(value.seasonId)
  }, [value?.seasonId])
  const seasons = useQuery({
    queryKey: publishingKeys.authoringSeasons(regionId),

    queryFn: () => backendRequest<Season[]>("/admin/seasons"),
  })
  const patches = useQuery({
    queryKey: publishingKeys.authoringContexts(regionId, seasonId),
    enabled: !!seasonId,
    queryFn: () => backendRequest<ImportContext[]>(`/admin/heroes/import/contexts?seasonId=${seasonId}`),
  })
  // Most entries belong to the patch players have now, so an empty choice starts there; it is offered once and any
  // choice the editor makes afterwards stays.
  const overview = usePublicationOverview()
  const market = overview.data?.markets.find((entry) => entry.available && entry.currentReleaseId)
  const current = overview.data?.releases.find((release) => release.id === market?.currentReleaseId)
  const offered = useRef(!!value)
  const [suggested, setSuggested] = useState<string | null>(null)
  useEffect(() => {
    if (offered.current || disabled || !market?.currentSeasonId) return
    if (!seasonId) {
      setSeasonId(market.currentSeasonId)
      return
    }
    if (seasonId !== market.currentSeasonId || !patches.data) return
    offered.current = true
    const now = patches.data.find((patch) => patch.patchVariantId === current?.variantId)
    if (!now) return
    setSuggested(market.displayName)
    onChange(now, true)
  }, [disabled, market, current, seasonId, patches.data, onChange])
  return (
    <section className="admin-section py-5">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            Mùa
          </span>
          <NativeSelect
            className="w-full"
            value={seasonId}
            disabled={seasons.isPending}
            onChange={(e) => {
              if (e.target.value === "__create") {
                setSetup("season")
                return
              }
              offered.current = true
              setSuggested(null)
              setSeasonId(e.target.value)
              onChange(null)
            }}
          >
            <option value="">{seasons.isPending ? "Đang tải mùa…" : "Chọn mùa"}</option>
            {capabilities.includes("patch:write") && <option value="__create">＋ Tạo mùa…</option>}
            {seasons.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            Patch
          </span>
          <NativeSelect
            className="w-full"
            value={value?.contextId ?? ""}
            disabled={!seasonId || patches.isPending}
            onChange={(e) => {
              if (e.target.value === "__create") {
                setSetup("patch")
                return
              }
              offered.current = true
              setSuggested(null)
              onChange(patches.data?.find((p) => p.contextId === e.target.value) ?? null)
            }}
          >
            <option value="">{seasonId && patches.isPending ? "Đang tải patch…" : "Chọn patch"}</option>
            {capabilities.includes("patch:write") && <option value="__create">＋ Tạo patch…</option>}
            {patches.data?.map((p) => (
              <option key={p.contextId} value={p.contextId}>
                {p.patchCode}
              </option>
            ))}
          </NativeSelect>
        </label>
        {locale && onLocaleChange && <DataLanguage value={locale} onChange={onLocaleChange} />}
      </fieldset>
      {(seasons.error || patches.error) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMessage(seasons.error || patches.error)}
        </p>
      )}
      {(seasons.data?.length === 0 || (seasonId && patches.data?.length === 0)) && (
        <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" />
          Chưa có {seasonId ? "patch trong mùa này" : "mùa dùng chung"}. Chọn mục tạo trong bộ chọn phía trên trước khi
          nhập dữ liệu.
        </p>
      )}
      {value && (
        <p className="mt-4 border-t pt-3 text-sm">
          <span className="font-medium">
            {value.seasonName} / {value.patchCode}
          </span>
          {suggested && (
            <span className="text-muted-foreground"> · patch đang áp dụng ở {suggested}, đổi được ở trên</span>
          )}
        </p>
      )}
      <ContextSetup kind={setup} regions={regions} regionId={regionId} onClose={() => setSetup(null)} />
    </section>
  )
}
