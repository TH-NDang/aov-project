import { SharedPatchSetup } from "./shared-version-setup"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@aov/ui/components/sheet"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { useIsWide } from "@/hooks/use-media-query"
import { createPublishingApi } from "./publishing-api"
import { SeasonSetup } from "./season-setup"
import { DataLanguage } from "./data-language"
import { control } from "./fields"
import type { Region } from "./types"
import { z } from "zod"
import { useDraftForm } from "@/app/drafts/use-draft-form"
import { DraftStatus } from "@/app/drafts/draft-status"
const api = createPublishingApi(backendRequest)
const regionDraftSchema = z.object({
  code: z.string(),
  displayName: z.string(),
  productName: z.string(),
  locale: z.string(),
  timezone: z.string(),
  available: z.boolean(),
})
export function ContextSetup({
  kind,
  onClose,
}: {
  kind: "region" | "season" | "patch" | null
  regions: Region[]
  regionId: string
  onClose: () => void
}) {
  const wide = useIsWide()
  const cache = useQueryClient()
  const rulesets = useQuery({ queryKey: ["publishing-rulesets"], queryFn: api.rulesets, enabled: kind === "patch" })
  const close = () => {
    void cache.invalidateQueries({ queryKey: ["authoring-seasons"] })
    void cache.invalidateQueries({ queryKey: ["authoring-contexts"] })
    void cache.invalidateQueries({ queryKey: ["publishing-regions"] })
    void cache.invalidateQueries({ queryKey: ["publication-overview"] })
    onClose()
  }
  return (
    <Sheet
      open={!!kind}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[760px] sm:max-w-[760px]" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>
            {kind === "region"
              ? "Tạo thị trường"
              : kind === "season"
                ? "Tạo mùa xếp hạng"
                : "Tạo patch và lịch phát hành"}
          </SheetTitle>
          <SheetDescription>
            {kind === "patch"
              ? "Patch cần được xuất bản và đặt lịch trong mùa để dùng làm mốc dữ liệu."
              : "Lưu thiết lập, sau đó chọn mục vừa tạo trong bộ chọn."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {kind === "region" && <CreateRegion onDone={close} />}
          {kind === "season" && <SeasonSetup onDone={close} />}
          {kind === "patch" &&
            (rulesets.isPending ? (
              <p>Đang tải…</p>
            ) : rulesets.error ? (
              <p role="alert">{errorMessage(rulesets.error)}</p>
            ) : (
              <SharedPatchSetup onDone={close} />
            ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
function CreateRegion({ onDone }: { onDone: () => void }) {
  const { form, draft } = useDraftForm({
    form: "region:create",
    initialValue: {
      code: "",
      displayName: "",
      productName: "Arena of Valor",
      locale: "en-US",
      timezone: "UTC",
      available: false,
    },
    schema: regionDraftSchema,
  })
  const locale = form.watch("locale")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const data = form.getValues()
        setBusy(true)
        setError("")
        try {
          await backendRequest("/admin/regions", {
            method: "POST",
            body: JSON.stringify({
              code: data.code,
              displayName: data.displayName,
              productName: data.productName,
              defaultLocale: locale,
              timezone: data.timezone,
              available: data.available,
            }),
          })
          await draft.discard()
          onDone()
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setBusy(false)
        }
      }}
    >
      <DraftStatus draft={draft} disabled={busy} />
      <fieldset disabled={busy || !draft.ready || draft.invalid} className="space-y-4">
        <label className="grid gap-2 text-sm">
          Mã thị trường
          <input
            className={control}
            {...form.register("code")}
            required
            pattern="[A-Z][A-Z0-9-]{1,15}"
            maxLength={16}
            placeholder="VN"
          />
        </label>
        <label className="grid gap-2 text-sm">
          Tên thị trường
          <input {...form.register("displayName")} className={control} required maxLength={80} />
        </label>
        <label className="grid gap-2 text-sm">
          Tên trò chơi
          <input {...form.register("productName")} className={control} required maxLength={80} />
        </label>
        <DataLanguage value={locale} onChange={(value) => form.setValue("locale", value)} />
        <label className="grid gap-2 text-sm">
          Múi giờ
          <select {...form.register("timezone")} className={control}>
            {["UTC", ...Intl.supportedValuesOf("timeZone")].map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input {...form.register("available")} type="checkbox" />
          Cho phép chọn thị trường này
        </label>
        <p className="text-xs text-muted-foreground">Để tắt nếu dữ liệu thị trường chưa sẵn sàng.</p>
        <Button disabled={busy}>{busy ? "Đang tạo…" : "Tạo thị trường"}</Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
