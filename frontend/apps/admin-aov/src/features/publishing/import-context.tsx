import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, GitBranch, Info } from "lucide-react"
import { DataLanguage } from "./data-language"
import { ContextSetup } from "./context-setup"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { control } from "./fields"
import type { Region } from "./types"
import type { components } from "./generated/hero-api"

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
  onChange: (value: ImportContext | null) => void
  disabled: boolean
  locale: string
  onLocaleChange: (value: string) => void
}) {
  const [setup, setSetup] = useState<"region" | "season" | "patch" | null>(null)
  const capabilities = useSession().actor?.capabilities ?? []
  const regionId = ""
  const [seasonId, setSeasonId] = useState(value?.seasonId ?? "")
  useEffect(() => {
    if (value?.seasonId) setSeasonId(value.seasonId)
  }, [value?.seasonId])
  const seasons = useQuery({
    queryKey: ["authoring-seasons", regionId],

    queryFn: () => backendRequest<Season[]>("/admin/seasons"),
  })
  const patches = useQuery({
    queryKey: ["authoring-contexts", regionId, seasonId],
    enabled: !!seasonId,
    queryFn: () => backendRequest<ImportContext[]>(`/admin/heroes/import/contexts?seasonId=${seasonId}`),
  })
  return (
    <section className="rounded-xl border bg-card p-5">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-2 text-sm">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            Mùa
          </span>
          <select
            className={control}
            value={seasonId}
            disabled={seasons.isPending}
            onChange={(e) => {
              if (e.target.value === "__create") {
                setSetup("season")
                return
              }
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
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="flex items-center gap-2">
            <GitBranch className="size-4 text-muted-foreground" />
            Patch
          </span>
          <select
            className={control}
            value={value?.contextId ?? ""}
            disabled={!seasonId || patches.isPending}
            onChange={(e) => {
              if (e.target.value === "__create") {
                setSetup("patch")
                return
              }
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
          </select>
        </label>
        <DataLanguage value={locale} onChange={onLocaleChange} />
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
        </p>
      )}
      <ContextSetup kind={setup} regions={regions} regionId={regionId} onClose={() => setSetup(null)} />
    </section>
  )
}
