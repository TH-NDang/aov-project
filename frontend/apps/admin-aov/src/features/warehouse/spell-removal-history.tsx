import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { errorMessage } from "@/lib/api/errors"
import { Field, control } from "../publishing/fields"
import { usePublicationOverview } from "../publishing/publication-overview"
import { warehouseApi, warehouseKeys, invalidateWarehouseCatalogs } from "./warehouse-api"
import { WarehousePatchContext } from "./warehouse-patch-context"

export function SpellRemovalHistory({
  id,
  revisionId,
  rulesetId,
  published,
  canPublish,
}: {
  id: string
  revisionId: string
  rulesetId: string
  published: boolean
  canPublish: boolean
}) {
  const client = useQueryClient()
  const overview = usePublicationOverview()
  const query = useQuery({
    queryKey: [...warehouseKeys.all, "removals", id, rulesetId],
    queryFn: () => warehouseApi.spellRemovals(id, rulesetId),
  })
  const [adding, setAdding] = useState(false)
  const [patchId, setPatchId] = useState<string | null>(null)
  const [sourceUrl, setSourceUrl] = useState("")
  const [notes, setNotes] = useState("")
  const mutation = useMutation({
    mutationFn: () =>
      warehouseApi.recordSpellRemoval(id, {
        revisionId,
        patchVariantId: patchId!,
        sourceUrl: sourceUrl.trim(),
        notes: notes.trim() || null,
      }),
    onSuccess: async () => {
      await invalidateWarehouseCatalogs(client)
      await client.invalidateQueries({ queryKey: ["patch-spell-removals"] })
      setAdding(false)
      setPatchId(null)
      setSourceUrl("")
      setNotes("")
    },
  })
  let validSource = false
  try {
    const url = new URL(sourceUrl.trim())
    validSource = ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
  } catch {
    /* Invalid URLs remain disabled until corrected. */
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-medium">Lịch sử loại bỏ</h3>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Chỉ bổ sung patch khi có nguồn xác nhận. Mốc này không thay đổi các chỉ số hay bản đã xuất bản.
          </p>
        </div>
        {published && canPublish && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Thêm mốc loại bỏ
          </Button>
        )}
      </div>
      {!published && (
        <p className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
          Xuất bản hồ sơ trước khi ghi nhận nguồn xác nhận patch loại bỏ.
        </p>
      )}
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải lịch sử…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{errorMessage(query.error)}</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Tải lại
          </Button>
        </div>
      )}
      {query.data?.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Chưa có nguồn xác nhận patch loại bỏ.
        </p>
      )}
      {query.data?.map((event) => {
        const patch = overview.data?.variants.find((entry) => entry.id === event.patchVariantId)
        return (
          <article key={event.id} className="space-y-2 rounded-xl border p-4">
            <p className="text-sm font-medium">Đã loại bỏ · {patch?.patchCode ?? "Patch đã xác nhận"}</p>
            <a
              className="inline-flex max-w-full items-start gap-2 text-sm text-primary underline-offset-4 hover:underline"
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mt-0.5 size-4 shrink-0" />
              <span className="break-all">{event.sourceUrl}</span>
            </a>
            {event.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.notes}</p>}
          </article>
        )
      })}
      {adding && (
        <fieldset disabled={mutation.isPending} className="space-y-4 rounded-xl border p-4">
          <WarehousePatchContext
            rulesetId={rulesetId}
            value={patchId}
            onChange={setPatchId}
            label="Patch loại bỏ"
            emptyLabel="Chọn patch đã xác nhận"
            hint="Chọn patch theo nguồn, không dùng ngày nhập dữ liệu làm ngày loại bỏ."
          />
          <Field
            label="Link nguồn xác nhận"
            type="url"
            value={sourceUrl}
            onChange={setSourceUrl}
            placeholder="https://…"
          />
          <label className="grid gap-1.5 text-sm">
            Ghi chú nguồn
            <textarea
              className={control}
              maxLength={4000}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={!patchId || !validSource || sourceUrl.trim().length > 2048 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Đang lưu…" : "Ghi nhận lịch sử"}
            </Button>
          </div>
        </fieldset>
      )}
    </section>
  )
}
