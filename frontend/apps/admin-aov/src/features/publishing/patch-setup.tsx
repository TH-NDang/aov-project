import { LocalTime } from "@aov/ui/components/local-time"
import { useState, type ReactNode } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi } from "./publishing-api"
import { ReleaseSeasonFields } from "./season-setup"
import { Box, control } from "./fields"
import { defaultRulesetId, hasRulesetChoice } from "./default-ruleset"
import type { PageSlice, Region, Ruleset } from "./types"
import { z } from "zod"
import { useDraftForm } from "@/app/drafts/use-draft-form"
import { DraftStatus } from "@/app/drafts/draft-status"
import { InfiniteScroll } from "@/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"
const assignmentDraftSchema = z.object({
  regionId: z.string(),
  rulesetId: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
})
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
export function PatchSetup({
  rulesets,
  regions,
  mode = "all",
  initialRegion = "",
}: {
  rulesets: Ruleset[]
  regions: Region[]
  /** Rulesets are not created here: the wiki runs on one default ruleset (see `default-ruleset.ts`). */
  mode?: "all" | "patch" | "assignment"
  initialRegion?: string
}) {
  const Container = mode === "all" ? Box : SetupPanel
  const queryClient = useQueryClient()
  const capabilities = useSession().actor?.capabilities ?? []
  const patches = useInfiniteQuery({
    queryKey: ["publishing-patches"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => backendRequest<PageSlice<Patch>>(`/admin/patches?page=${pageParam}&size=20`),
    getNextPageParam: nextPageOf,
    enabled: mode === "all" || mode === "patch",
  })
  const patchRows = patches.data?.pages.flatMap((page) => page.items) ?? []
  const assignmentDraft = useDraftForm({
    form: `ruleset:assignment:${initialRegion || "any"}`,
    initialValue: { regionId: initialRegion, rulesetId: "", validFrom: "", validTo: "" },
    schema: assignmentDraftSchema,
    enabled: mode === "all" || mode === "assignment",
  })
  const regionId = assignmentDraft.form.watch("regionId")
  const assignmentLocked =
    !assignmentDraft.draft.ready || assignmentDraft.draft.invalid || assignmentDraft.draft.conflict
  const setRegionId = (value: string) => assignmentDraft.form.setValue("regionId", value)
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
      if (regionId) await assignments.refetch()
      await queryClient.invalidateQueries({ queryKey: ["publication-overview"] })
      await queryClient.invalidateQueries({ queryKey: ["authoring-contexts"] })
      setMessage(message)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const choosable = hasRulesetChoice(rulesets)
  const fallbackRuleset = defaultRulesetId(rulesets)
  const selectRuleset = choosable ? (
    <label className="grid gap-1 text-sm">
      Bộ quy tắc
      <select name="rulesetId" className={control} required defaultValue={fallbackRuleset}>
        {rulesets.map((r) => (
          <option key={r.id} value={r.id}>
            {r.code}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <input type="hidden" name="rulesetId" value={fallbackRuleset} />
  )
  const selectRegion = (
    <label className="grid gap-1 text-sm">
      Thị trường
      <select
        className={control}
        required
        disabled={assignmentLocked}
        value={regionId}
        onChange={(e) => setRegionId(e.target.value)}
      >
        <option value="" disabled>
          Chọn thị trường
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
    <Container title={mode === "assignment" ? "Liên kết gameplay" : "Patch và lịch phát hành"}>
      <p className="text-sm text-muted-foreground">
        Nội dung gameplay dùng chung theo bộ quy tắc. Mỗi thị trường có lịch mùa và lịch phát hành patch riêng.
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
      <fieldset disabled={busy} className="grid gap-5">
        {capabilities.includes("region:admin") && (
          <>
            {(mode === "all" || mode === "assignment") && (
              <form
                className="space-y-3 rounded-lg border p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (assignmentLocked || busy) return
                  const f = assignmentDraft.form.getValues()
                  void perform(async () => {
                    await api.send(`/admin/regions/${regionId}/ruleset-assignments`, "POST", {
                      rulesetId: f.rulesetId || fallbackRuleset,
                      validFrom: new Date(f.validFrom).toISOString(),
                      validTo: f.validTo ? new Date(f.validTo).toISOString() : null,
                    })
                    await assignmentDraft.draft.discard()
                  }, "Đã gán bộ quy tắc cho vùng.")
                }}
              >
                <h3 className="font-medium">Thị trường dùng chung gameplay</h3>
                <DraftStatus draft={assignmentDraft.draft} disabled={busy} />
                {selectRegion}
                {choosable && (
                  <label className="grid gap-1 text-sm">
                    Bộ quy tắc
                    <select
                      {...assignmentDraft.form.register("rulesetId")}
                      className={control}
                      disabled={assignmentLocked}
                    >
                      <option value="">Mặc định ({DEFAULT_LABEL(rulesets, fallbackRuleset)})</option>
                      {rulesets.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.code}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1 text-sm">
                  Bắt đầu
                  <input
                    {...assignmentDraft.form.register("validFrom")}
                    className={control}
                    disabled={assignmentLocked}
                    type="datetime-local"
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Kết thúc (tùy chọn)
                  <input
                    {...assignmentDraft.form.register("validTo")}
                    className={control}
                    disabled={assignmentLocked}
                    type="datetime-local"
                  />
                </label>
                <Button disabled={assignmentLocked}>Gán bộ quy tắc</Button>
                {assignments.data?.map((a) => (
                  <p key={a.id} className="text-xs">
                    {rulesets.find((r) => r.id === a.rulesetId)?.code}:{" "}
                    <LocalTime value={a.validFrom} sourceTimeZone={regions.find((r) => r.id === regionId)?.timeZone} />{" "}
                    →{" "}
                    <LocalTime
                      value={a.validTo}
                      sourceTimeZone={regions.find((r) => r.id === regionId)?.timeZone}
                      fallback="Không giới hạn"
                    />
                  </p>
                ))}
              </form>
            )}
          </>
        )}
        {capabilities.includes("patch:write") && (mode === "all" || mode === "patch") && (
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
            <h3 className="font-medium">Patch</h3>
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
      {(mode === "all" || mode === "patch") && (
        <>
          {patches.isError && <p role="alert">{errorMessage(patches.error)}</p>}
          {patchRows.map((patch) => (
            <div key={patch.id} className="space-y-3 rounded-lg border p-4">
              <h3 className="font-medium">
                {patch.code} · {patch.status}
              </h3>
              {capabilities.includes("patch:write") && (
                <form
                  className="grid items-end gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const f = new FormData(e.currentTarget)
                    void perform(
                      () =>
                        api.send(`/admin/patches/${patch.id}/variants`, "POST", {
                          rulesetId: f.get("rulesetId"),
                          variantCode: f.get("variantCode"),
                          rulesetOrdinal: Number(f.get("ordinal")),
                          beforeVariantId: f.get("beforeVariantId") || null,
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
                    Thứ tự trong bộ quy tắc
                    <input className={control} name="ordinal" type="number" min="1" defaultValue="1" required />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Chèn patch lịch sử trước
                    <select className={control} name="beforeVariantId" defaultValue="">
                      <option value="">Dùng thứ tự đã nhập</option>
                      {patchRows.flatMap((p) =>
                        p.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {p.code} · {v.variantCode}
                          </option>
                        )),
                      )}
                    </select>
                    <span className="text-xs text-muted-foreground">
                      Chọn mốc cùng bộ quy tắc; thứ tự các mốc sau sẽ tự dịch chuyển.
                    </span>
                  </label>
                  <Button disabled={busy}>Thêm variant</Button>
                </form>
              )}
              {patch.variants.map((v) => (
                <div key={v.id} className="space-y-3 border-t pt-3">
                  <p className="text-sm">
                    {v.variantCode}
                    {choosable ? ` · ${rulesets.find((r) => r.id === v.rulesetId)?.code ?? ""}` : ""} · #
                    {v.rulesetOrdinal} · {v.status}
                  </p>
                  <p className="select-all break-all font-mono text-xs text-muted-foreground">Mã biến thể: {v.id}</p>
                  {capabilities.includes("patch:publish") &&
                    (v.status !== "PUBLISHED" ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void perform(
                            () => api.send(`/admin/patch-variants/${v.id}/publish`, "POST"),
                            "Đã xuất bản biến thể.",
                          )
                        }
                      >
                        Xuất bản biến thể
                      </Button>
                    ) : (
                      <form
                        className="grid items-end gap-3 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const f = new FormData(e.currentTarget)
                          void perform(
                            () =>
                              api.send(`/admin/patch-variants/${v.id}/releases`, "POST", {
                                regionId: f.get("regionId"),
                                seasonId: f.get("seasonId") || null,
                                effectiveAt: new Date(String(f.get("effectiveAt"))).toISOString(),
                                sourceUrl: f.get("sourceUrl"),
                              }),
                            "Đã lưu lịch phát hành.",
                          )
                        }}
                      >
                        <ReleaseSeasonFields regions={regions} />
                        <label className="grid gap-1 text-sm">
                          Phát hành tại thị trường
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
                      <LocalTime
                        value={r.effectiveAt}
                        sourceTimeZone={regions.find((region) => region.id === r.regionId)?.timeZone}
                      />{" "}
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
          <InfiniteScroll query={patches} enabled={!busy} label="Đang tải thêm patch" />
        </>
      )}
    </Container>
  )
}

const DEFAULT_LABEL = (rulesets: Ruleset[], id: string) => rulesets.find((row) => row.id === id)?.code ?? ""

function SetupPanel({ children }: { title: string; children: ReactNode }) {
  return <div className="space-y-4">{children}</div>
}
