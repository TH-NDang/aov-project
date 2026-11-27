import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { Field } from "../editing/fields"
import { STAT_LABELS, statLabel } from "../../model/patch-changes/patch-change-model"
import { formatStat, statUnit, type StatDefault } from "../../model/assessment/combat-attributes"
import type { Variant } from "../../api/publication-overview"
import { publishingKeys } from "@/lib/api/publishing-api"
import { NativeSelect } from "@/components/native-select"

export function useStatDefaults(id?: string) {
  return useQuery({
    queryKey: publishingKeys.patchStatDefaults(id),
    enabled: !!id,
    queryFn: () => backendRequest<StatDefault[]>(`/admin/patch-variants/${id}/stat-defaults`),
  })
}

export function PatchStatDefaults({ variant }: { variant: Variant }) {
  const query = useStatDefaults(variant.id)
  const cache = useQueryClient()
  const canWrite = useSession().actor?.capabilities.includes("patch:write")
  const [edit, setEdit] = useState<{ key: string; value: string; source: string; version: number } | null>(null)
  const start = (key: string) => {
    const rule = query.data?.find((d) => d.statKey === key)
    setEdit({
      key,
      value: String(rule?.baseValue ?? ""),
      source: rule?.sourceUrl ?? "",
      version: rule?.variantId === variant.id ? rule.version : 0,
    })
  }
  const save = useMutation({
    mutationFn: (input: NonNullable<typeof edit>) =>
      backendRequest<void>(`/admin/patch-variants/${variant.id}/stat-defaults/${input.key}`, {
        method: "PUT",
        body: JSON.stringify({
          baseValue: Number(input.value),
          unit: statUnit(input.key),
          sourceUrl: input.source.trim(),
          expectedVersion: input.version,
        }),
      }),
    onSuccess: async () => {
      setEdit(null)
      await Promise.all([
        cache.invalidateQueries({ queryKey: publishingKeys.allPatchStatDefaults }),
        cache.invalidateQueries({ queryKey: publishingKeys.overview }),
      ])
    },
    onError: () => {
      void query.refetch()
    },
    meta: { silent: true },
  })
  return (
    <div className="space-y-3">
      <p className="type-body">
        Giá trị chung từ patch {variant.patchCode} cho các tướng cùng bộ luật. Từng tướng có thể có ngoại lệ.
      </p>
      {query.isPending ? (
        <p className="type-meta">Đang tải mặc định…</p>
      ) : query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <>
          <ul className="divide-y">
            {query.data?.map((rule) => (
              <li key={rule.statKey} className="flex flex-wrap items-center gap-2 py-2">
                <span className="type-body">
                  {statLabel(rule.statKey)} <strong>{formatStat(rule.baseValue, rule.unit)}</strong>
                </span>
                <a className="type-meta underline" href={rule.sourceUrl} target="_blank" rel="noreferrer">
                  Nguồn · {rule.patchCode}
                </a>
                {canWrite && !edit && (
                  <Button size="sm" variant="ghost" onClick={() => start(rule.statKey)}>
                    Sửa
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!query.data?.length && <p className="type-meta">Chưa có mặc định được xác nhận.</p>}
          {canWrite && !edit && (
            <Button size="sm" variant="outline" onClick={() => start("CRITICAL_DAMAGE")}>
              Đặt mặc định cho patch
            </Button>
          )}
        </>
      )}
      {edit && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(edit)
          }}
        >
          <label className="type-label grid gap-1">
            Thuộc tính
            <NativeSelect className="w-full" value={edit.key} onChange={(e) => start(e.target.value)}>
              {Object.entries(STAT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Field
            type="number"
            step="any"
            label={statUnit(edit.key) === "PERCENT" ? "Giá trị (%)" : "Giá trị"}
            required
            value={edit.value}
            onChange={(value) => setEdit({ ...edit, value })}
          />
          <Field
            type="url"
            label="Liên kết nguồn xác nhận"
            required
            value={edit.source}
            onChange={(source) => setEdit({ ...edit, source })}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              Lưu mặc định
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                setEdit(null)
                save.reset()
              }}
            >
              Hủy
            </Button>
          </div>
          {save.error && (
            <p role="alert" className="type-meta text-destructive">
              {errorMessage(save.error)}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
