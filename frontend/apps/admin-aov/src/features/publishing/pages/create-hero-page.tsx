import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Page, PageHeader } from "@/components/page-header"
import { backendRequest } from "@/app/auth/session"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import { ImportContextPicker, type ImportContext } from "../components/import/import-context"
import { z } from "zod"
import { useDraftForm } from "@/app/drafts/use-draft-form"
import { DraftStatus } from "@/app/drafts/draft-status"
import { invalidateHeroCatalogs } from "../api/publishing-cache"
import { Input } from "@aov/ui/components/input"
const api = createPublishingApi(backendRequest)
const createHeroSchema = z.object({
  code: z.string(),
  name: z.string(),
  locale: z.string(),
  context: z
    .custom<ImportContext>(
      (value) =>
        !!value &&
        typeof value === "object" &&
        typeof (value as ImportContext).contextId === "string" &&
        typeof (value as ImportContext).seasonId === "string",
    )
    .nullable(),
})
export function CreateHeroPage() {
  const navigate = useNavigate()
  const cache = useQueryClient()
  const { form, draft } = useDraftForm({
    form: "hero:create",
    initialValue: { code: "", name: "", locale: "vi-VN", context: null as ImportContext | null },
    schema: createHeroSchema,
  })
  // The current patch the picker offers stays out of the saved draft until someone changes it or creates the hero.
  const [offered, setOffered] = useState<ImportContext | null>(null)
  const context = form.watch("context") ?? offered
  const locale = form.watch("locale")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const regions = useQuery({ queryKey: publishingKeys.regions, queryFn: api.regions })
  const canWrite = useSession().actor?.capabilities.includes("hero:write")
  return (
    <Page>
      <PageHeader
        title="Tạo tướng"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/hero">
              <ArrowLeft className="size-4" />
              Danh sách tướng
            </Link>
          </Button>
        }
      />
      {!canWrite ? (
        <p>Bạn chưa có quyền tạo tướng.</p>
      ) : (
        <>
          <DraftStatus draft={draft} disabled={busy} />
          <ImportContextPicker
            key={draft.ready ? "ready" : "loading"}
            regions={regions.data ?? []}
            value={context}
            onChange={(value, automatic) =>
              automatic ? setOffered(value) : form.setValue("context", value, { shouldDirty: true })
            }
            disabled={busy || !draft.ready}
            locale={locale}
            onLocaleChange={(value) => form.setValue("locale", value, { shouldDirty: true })}
          />
          {(error || regions.error) && (
            <p role="alert" className="text-destructive">
              {error || errorMessage(regions.error)}
            </p>
          )}
          <form
            className="space-y-5 admin-section py-6"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!context || busy) return
              const data = form.getValues()
              setBusy(true)
              setError("")
              try {
                const revision = await api.create(
                  data.code.trim(),
                  data.name.trim(),
                  locale,
                  context.rulesetId,
                  context.contextId,
                )
                await draft.discard()
                await invalidateHeroCatalogs(cache)
                void navigate(`/hero/${revision.heroId}`, { replace: true })
              } catch (cause) {
                setError(errorMessage(cause))
              } finally {
                setBusy(false)
              }
            }}
          >
            <h2 className="type-section-title">Thông tin nhận diện</h2>
            <fieldset disabled={busy || !draft.ready || draft.invalid} className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                Mã tướng
                <Input
                  {...form.register("code")}

                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="airi"
                />
                <span className="text-xs text-muted-foreground">Mã cố định dùng để ánh xạ khi nhập.</span>
              </label>
              <label className="grid content-start gap-2 text-sm">
                Tên tướng
                <Input {...form.register("name")} required maxLength={200} placeholder="Airi" />
              </label>
            </fieldset>
            <p className="text-sm text-muted-foreground">
              Tạo bản nháp để tiếp tục thiết lập mô tả, chỉ số, kỹ năng, biểu tượng chiêu và ảnh tướng trong trang biên
              tập.
            </p>
            <Button disabled={!context || busy || !draft.ready || draft.invalid}>
              <Plus className="size-4" />
              {busy ? "Đang tạo…" : "Tạo và tiếp tục biên tập"}
            </Button>
          </form>
        </>
      )}
    </Page>
  )
}
