import { useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Input } from "@aov/ui/components/input"
import { NativeSelect } from "@/components/native-select"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { randomId } from "@/lib/random-id"
import { createPublishingApi, publishingKeys, type PatchSource } from "@/lib/api/publishing-api"
import { usePatchNotePosts } from "../../../patch-watch/use-patch-watch"
import {
  MAX_PATCH_SOURCES,
  SOURCE_LANGUAGES,
  SOURCE_MARKETS,
  sourceFromPost,
  sourceLanguage,
  sourceProblem,
  sourcesToSave,
  type SourceRow,
} from "../../model/patch-changes/patch-source-model"

const api = createPublishingApi(backendRequest)

export function usePatchSources(variantId: string) {
  return useQuery({
    queryKey: publishingKeys.patchSources(variantId),
    queryFn: ({ signal }) => api.patchSources(variantId, signal),
    enabled: !!variantId,
    staleTime: 60_000,
  })
}

/** The links to the official notes of a patch: written once here, they are the source of every change from them. */
export function PatchSourceStrip({ variantId, canEdit }: { variantId: string; canEdit: boolean }) {
  const query = usePatchSources(variantId)
  const [editing, setEditing] = useState(false)
  if (query.isPending) return null
  const sources = query.data ?? []
  return (
    <div role="group" aria-label="Nguồn ghi chú cập nhật" className="flex flex-wrap items-center gap-1.5">
      <span className="type-label mr-1 inline-flex items-center gap-1.5 text-muted-foreground">
        <Link2 aria-hidden className="size-4" /> Nguồn
      </span>
      {query.isError && <span className="type-meta">Không tải được link nguồn.</span>}
      {sources.map((source) => {
        const language = sourceLanguage(source.locale)
        return (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.url}
            className="type-body inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background px-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            {source.region && (
              <span className="type-label text-foreground" title={source.region}>
                {source.region}
              </span>
            )}
            {source.label}
            {language && language !== source.label && <span className="text-muted-foreground">· {language}</span>}
            <ExternalLink aria-hidden className="size-3.5 text-muted-foreground" />
          </a>
        )
      })}
      {!sources.length && !query.isError && !canEdit && <span className="type-meta">Chưa có link nguồn.</span>}
      {canEdit && (
        <Button type="button" size="sm" variant="ghost" aria-haspopup="dialog" onClick={() => setEditing(true)}>
          {sources.length ? (
            <>
              <Pencil aria-hidden className="size-4" /> Sửa nguồn
            </>
          ) : (
            <>
              <Plus aria-hidden className="size-4" /> Thêm link nguồn
            </>
          )}
        </Button>
      )}
      <Dialog open={editing} onOpenChange={(open) => !open && setEditing(false)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {editing && <PatchSourcesForm variantId={variantId} saved={sources} onClose={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const toRow = (source: PatchSource): SourceRow => ({ ...source, key: randomId() })
const MARKET_LANGUAGE: Record<string, string> = { VN: "vi-VN", TH: "th-TH", TW: "zh-TW", ID: "id-ID" }
const emptyRow = () => toRow({ url: "", label: "", locale: null, region: null })

function PatchSourcesForm({
  variantId,
  saved,
  onClose,
}: {
  variantId: string
  saved: PatchSource[]
  onClose: () => void
}) {
  const cache = useQueryClient()
  const [rows, setRows] = useState<SourceRow[]>(() => (saved.length ? saved.map(toRow) : [emptyRow()]))
  const [checked, setChecked] = useState(false)
  const posts = usePatchNotePosts(null)
  const save = useMutation({
    mutationFn: (sources: PatchSource[]) => api.savePatchSources(variantId, sources),
    onSuccess: (result) => {
      cache.setQueryData(publishingKeys.patchSources(variantId), result)
      onClose()
    },
    meta: { silent: true, successMessage: "Đã lưu link nguồn." },
  })
  const problems = rows.map((row) => sourceProblem(row, rows))
  const update = (key: string, patch: Partial<PatchSource>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const move = (index: number, step: number) =>
    setRows((current) => {
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(index + step, 0, row)
      return next
    })
  const used = new Set(rows.map((row) => row.url.trim()))
  const suggestions = (posts.data?.pages[0]?.items ?? []).filter((post) => !used.has(post.url)).slice(0, 6)
  const full = rows.length >= MAX_PATCH_SOURCES

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setChecked(true)
    if (problems.some(Boolean)) return
    save.mutate(sourcesToSave(rows))
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Link nguồn của patch</DialogTitle>
        <DialogDescription>
          Dùng chung cho mọi thay đổi ghi từ ghi chú cập nhật. Chọn thị trường đăng bài để Wiki xếp nguồn theo khu vực.
        </DialogDescription>
      </DialogHeader>

      <ol className="space-y-3">
        {rows.map((row, index) => {
          const problem = checked ? problems[index] : null
          const label = `Link ${index + 1}`
          return (
            <li key={row.key} aria-label={label} className="grid gap-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_19rem]">
                <Input
                  aria-label={`${label}: nhãn`}
                  placeholder="Nhãn, ví dụ Chi tiết cập nhật"
                  maxLength={80}
                  value={row.label}
                  aria-invalid={!!problem && !row.label.trim()}
                  onChange={(event) => update(row.key, { label: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <NativeSelect
                    aria-label={`${label}: thị trường`}
                    className="w-full"
                    value={row.region ?? ""}
                    onChange={(event) => {
                      const region = event.target.value || null
                      update(row.key, {
                        region,
                        locale: row.locale || (region ? (MARKET_LANGUAGE[region] ?? null) : null),
                      })
                    }}
                  >
                    <option value="">Không rõ khu vực</option>
                    {SOURCE_MARKETS.map((market) => (
                      <option key={market.code} value={market.code}>
                        {market.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    aria-label={`${label}: ngôn ngữ`}
                    className="w-full"
                    value={row.locale ?? ""}
                    onChange={(event) => update(row.key, { locale: event.target.value || null })}
                  >
                    <option value="">Không ghi ngôn ngữ</option>
                    {SOURCE_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`${label}: địa chỉ`}
                  type="url"
                  inputMode="url"
                  placeholder="https://lienquan.garena.vn/…"
                  value={row.url}
                  aria-invalid={!!problem}
                  onChange={(event) => update(row.key, { url: event.target.value })}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Đưa ${label.toLowerCase()} lên`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Đưa ${label.toLowerCase()} xuống`}
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Bỏ ${label.toLowerCase()}`}
                  onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
              {problem && (
                <p role="alert" className="type-meta text-destructive">
                  {problem}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={full}
        onClick={() => setRows((current) => [...current, emptyRow()])}
      >
        <Plus aria-hidden className="size-4" /> Thêm link
      </Button>

      {suggestions.length > 0 && (
        <section aria-labelledby="patch-source-suggestions" className="space-y-2">
          <h3 id="patch-source-suggestions" className="type-label text-muted-foreground">
            Bài gần đây từ Theo dõi cập nhật
          </h3>
          <ul className="divide-y rounded-lg border">
            {suggestions.map((post) => {
              const source = sourceFromPost(post)
              return (
                <li key={post.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate">{post.title || post.url}</span>
                    <span className="type-meta block">{source.label}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={full}
                    aria-label={`Thêm nguồn ${post.title || post.url}`}
                    onClick={() =>
                      setRows((current) => [
                        ...current.filter((row) => row.url.trim() || row.label.trim()),
                        toRow(source),
                      ])
                    }
                  >
                    <Plus aria-hidden className="size-4" /> Thêm
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {save.isError && (
        <p role="alert" className="type-body text-destructive">
          {errorMessage(save.error)}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
          Hủy
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Đang lưu…" : "Lưu nguồn"}
        </Button>
      </DialogFooter>
    </form>
  )
}
