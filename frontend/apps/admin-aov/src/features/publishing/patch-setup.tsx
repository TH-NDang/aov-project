import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi } from "./publishing-api"
import { Box, control } from "./fields"
import type { PageSlice, Region, Ruleset } from "./types"
export interface Patch {
  id: string
  code: string
  status: string
  variants: {
    id: string
    rulesetId: string
    variantCode: string
    rulesetOrdinal: number
    status: string
    releases: { id: string; regionId: string; effectiveAt: string; sourceUrl: string | null }[]
  }[]
}
const api = createPublishingApi(backendRequest)
export function PatchSetup({ rulesets, regions }: { rulesets: Ruleset[]; regions: Region[] }) {
  const queryClient = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const [page, setPage] = useState(0)
  const patches = useQuery({
    queryKey: ["publishing-patches", page],
    queryFn: () => backendRequest<PageSlice<Patch>>(`/admin/patches?page=${page}&size=20`),
  })
  const [regionId, setRegionId] = useState("")
  const assignments = useQuery({
    queryKey: ["publishing-assignments", regionId],
    queryFn: () =>
      backendRequest<{ id: string; rulesetId: string; validFrom: string; validTo: string | null }[]>(
        `/admin/regions/${regionId}/ruleset-assignments`,
      ),
    enabled: !!regionId,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await action()
      await queryClient.invalidateQueries({ queryKey: ["publishing-rulesets"] })
      await queryClient.invalidateQueries({ queryKey: ["publishing-patches"] })
      await assignments.refetch()
      setMessage(message)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const selectRuleset = (
    <label className="grid gap-1 text-sm">
      Ruleset
      <select name="rulesetId" className={control} required defaultValue="">
        <option value="" disabled>
          Chọn ruleset
        </option>
        {rulesets.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code}
          </option>
        ))}
      </select>
    </label>
  )
  const selectRegion = (
    <label className="grid gap-1 text-sm">
      Vùng
      <select className={control} required value={regionId} onChange={(e) => setRegionId(e.target.value)}>
        <option value="" disabled>
          Chọn vùng
        </option>
        {regions
          .filter((r) => r.available)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
      </select>
    </label>
  )
  return (
    <Box title="Gameplay context và lịch phát hành">
      <p className="text-sm text-muted-foreground">
        Gán ruleset cho vùng trước, rồi tạo patch, variant, publish và lịch phát hành. Ngày giờ dưới đây dùng múi giờ
        của máy bạn. Nhập ngày cùng nguồn đã đối chiếu; dữ liệu thử chỉ dùng với backend dev.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-600">
          {message}
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-5 lg:grid-cols-2">
        {capabilities.includes("region:admin") && (
          <>
            <form
              className="space-y-3 rounded-lg border p-4"
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                void perform(
                  () => api.send("/admin/rulesets", "POST", { code: f.get("code"), description: f.get("description") }),
                  "Đã tạo ruleset.",
                )
              }}
            >
              <h3 className="font-medium">1. Ruleset</h3>
              <label className="grid gap-1 text-sm">
                Mã
                <input className={control} name="code" required pattern="[A-Za-z0-9][A-Za-z0-9-]{0,63}" />
              </label>
              <label className="grid gap-1 text-sm">
                Mô tả
                <textarea className={control} name="description" required />
              </label>
              <Button>Tạo ruleset</Button>
            </form>
            <form
              className="space-y-3 rounded-lg border p-4"
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                void perform(
                  () =>
                    api.send(`/admin/regions/${regionId}/ruleset-assignments`, "POST", {
                      rulesetId: f.get("rulesetId"),
                      validFrom: new Date(String(f.get("validFrom"))).toISOString(),
                      validTo: f.get("validTo") ? new Date(String(f.get("validTo"))).toISOString() : null,
                    }),
                  "Đã gán ruleset cho vùng.",
                )
              }}
            >
              <h3 className="font-medium">2. Timeline vùng</h3>
              {selectRegion}
              {selectRuleset}
              <label className="grid gap-1 text-sm">
                Bắt đầu
                <input className={control} name="validFrom" type="datetime-local" required />
              </label>
              <label className="grid gap-1 text-sm">
                Kết thúc (tùy chọn)
                <input className={control} name="validTo" type="datetime-local" />
              </label>
              <Button>Gán ruleset</Button>
              {assignments.data?.map((a) => (
                <p key={a.id} className="text-xs">
                  {rulesets.find((r) => r.id === a.rulesetId)?.code}: {new Date(a.validFrom).toLocaleString()} →{" "}
                  {a.validTo ? new Date(a.validTo).toLocaleString() : "Không giới hạn"}
                </p>
              ))}
            </form>
          </>
        )}
        {capabilities.includes("patch:write") && (
          <form
            className="space-y-3 rounded-lg border p-4"
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              void perform(
                () =>
                  api.send("/admin/patches", "POST", {
                    code: f.get("code"),
                    translations: [
                      { locale: f.get("locale"), title: f.get("title"), summary: f.get("summary"), description: null },
                    ],
                  }),
                "Đã tạo patch. Chọn patch bên dưới để thêm variant.",
              )
            }}
          >
            <h3 className="font-medium">3. Patch</h3>
            {[
              ["code", "Mã patch"],
              ["locale", "Ngôn ngữ"],
              ["title", "Tiêu đề"],
              ["summary", "Tóm tắt"],
            ].map(([name, label]) => (
              <label key={name} className="grid gap-1 text-sm">
                {label}
                <input
                  className={control}
                  name={name}
                  required
                  defaultValue={name === "locale" ? "vi-VN" : ""}
                  pattern={name === "code" ? "[a-z0-9]+(?:-[a-z0-9]+)*" : undefined}
                />
              </label>
            ))}
            <Button>Tạo patch</Button>
          </form>
        )}
      </fieldset>
      {patches.isError && <p role="alert">{errorMessage(patches.error)}</p>}
      {patches.data?.items.map((patch) => (
        <div key={patch.id} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">
            {patch.code} · {patch.status}
          </h3>
          {capabilities.includes("patch:write") && (
            <form
              className="grid items-end gap-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                void perform(
                  () =>
                    api.send(`/admin/patches/${patch.id}/variants`, "POST", {
                      rulesetId: f.get("rulesetId"),
                      variantCode: f.get("variantCode"),
                      rulesetOrdinal: Number(f.get("ordinal")),
                    }),
                  "Đã thêm variant.",
                )
              }}
            >
              {selectRuleset}
              <label className="grid gap-1 text-sm">
                Mã variant
                <input className={control} name="variantCode" required />
              </label>
              <label className="grid gap-1 text-sm">
                Thứ tự trong ruleset
                <input className={control} name="ordinal" type="number" min="1" required />
              </label>
              <Button disabled={busy}>Thêm variant</Button>
            </form>
          )}
          {patch.variants.map((v) => (
            <div key={v.id} className="space-y-3 border-t pt-3">
              <p className="text-sm">
                {v.variantCode} · {rulesets.find((r) => r.id === v.rulesetId)?.code} · #{v.rulesetOrdinal} · {v.status}
              </p>
              <p className="select-all break-all font-mono text-xs text-muted-foreground">Variant ID: {v.id}</p>
              {capabilities.includes("patch:publish") &&
                (v.status !== "PUBLISHED" ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        () => api.send(`/admin/patch-variants/${v.id}/publish`, "POST"),
                        "Đã publish variant.",
                      )
                    }
                  >
                    Publish variant
                  </Button>
                ) : (
                  <form
                    className="grid items-end gap-3 sm:grid-cols-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const f = new FormData(e.currentTarget)
                      void perform(
                        () =>
                          api.send(`/admin/patch-variants/${v.id}/releases`, "POST", {
                            regionId: f.get("regionId"),
                            effectiveAt: new Date(String(f.get("effectiveAt"))).toISOString(),
                            sourceUrl: f.get("sourceUrl"),
                          }),
                        "Đã lưu lịch phát hành.",
                      )
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      Vùng
                      <select className={control} name="regionId" required defaultValue="">
                        <option value="" disabled>
                          Chọn vùng
                        </option>
                        {regions
                          .filter((r) => r.available)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.displayName}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      Hiệu lực
                      <input className={control} name="effectiveAt" type="datetime-local" required />
                    </label>
                    <label className="grid gap-1 text-sm">
                      URL nguồn
                      <input className={control} name="sourceUrl" type="url" required />
                    </label>
                    <Button disabled={busy}>Lưu lịch phát hành</Button>
                  </form>
                ))}
              {v.releases.map((r) => (
                <p key={r.id} className="text-sm">
                  {regions.find((region) => region.id === r.regionId)?.code} ·{" "}
                  {new Date(r.effectiveAt).toLocaleString()}{" "}
                  {r.sourceUrl && (
                    <a className="underline" href={r.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                    </a>
                  )}
                </p>
              ))}
            </div>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" disabled={!page || busy} onClick={() => setPage(page - 1)}>
          Trước
        </Button>
        <span>Trang {page + 1}</span>
        <Button
          variant="outline"
          disabled={!patches.data || (page + 1) * 20 >= patches.data.totalElements || busy}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </Button>
      </div>
    </Box>
  )
}
