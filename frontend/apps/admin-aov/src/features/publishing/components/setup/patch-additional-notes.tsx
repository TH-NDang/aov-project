import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { backendRequest } from "@/app/auth/session"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { control } from "../editing/fields"
import { publishingKeys } from "@/lib/api/publishing-api"

type Note = { body: string; version: number }
const path = (variantId: string, locale: string) =>
  `/admin/patch-variants/${variantId}/notes/${encodeURIComponent(locale)}`

function useAdditionalNotes(variantId: string, locale: string) {
  return useQuery({
    queryKey: publishingKeys.additionalNotes(variantId, locale),
    queryFn: ({ signal }) => backendRequest<Note>(path(variantId, locale), { signal }),
    staleTime: 60000,
  })
}

export function PatchAdditionalNotes({
  variantId,
  locale,
  onEdit,
}: {
  variantId: string
  locale: string
  onEdit?: () => void
}) {
  const query = useAdditionalNotes(variantId, locale)
  if (query.isError)
    return (
      <p role="alert" className="type-meta py-2">
        Không tải được ghi chú khác.{" "}
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </p>
    )
  if (!query.data?.body) return null
  const lines = query.data.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    <section aria-label="Ghi chú khác" className="space-y-2 border-t py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-section-title">Ghi chú khác</h3>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Sửa
          </Button>
        )}
      </div>
      <ul className="type-body list-disc space-y-1.5 pl-5">
        {lines.map((line, i) => (
          <li key={i} className="break-words">
            {line}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PatchAdditionalEditor({
  variantId,
  locale,
  onSaved,
}: {
  variantId: string
  locale: string
  onSaved: () => void
}) {
  const query = useAdditionalNotes(variantId, locale)
  const cache = useQueryClient()
  const [draft, setDraft] = useState<Note | null>(null)
  const mutation = useMutation({
    mutationFn: (note: Note) =>
      backendRequest<Note>(path(variantId, locale), {
        method: "PUT",
        body: JSON.stringify({ body: note.body, expectedVersion: note.version }),
      }),
    onSuccess: (saved) => {
      cache.setQueryData(publishingKeys.additionalNotes(variantId, locale), saved)
      void cache.invalidateQueries({ queryKey: publishingKeys.overview })
      onSaved()
    },
    meta: { silent: true },
  })
  if (query.isPending)
    return (
      <p role="status" className="type-meta">
        Đang tải ghi chú…
      </p>
    )
  if (query.isError)
    return (
      <p role="alert">
        {errorMessage(query.error)}{" "}
        <Button variant="ghost" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </p>
    )
  const value = draft ?? query.data
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft) mutation.mutate(draft)
      }}
    >
      <label className="grid gap-2 type-label">
        Ghi chú khác · {locale}
        <textarea
          className={control}
          rows={7}
          maxLength={20000}
          value={value.body}
          disabled={mutation.isPending}
          onChange={(e) => setDraft({ ...value, body: e.target.value })}
        />
      </label>
      <p className="type-meta">
        Mỗi dòng là một ghi chú. Để trống nếu không có. Các mục này không tính vào thay đổi gameplay.
      </p>
      {mutation.isError && (
        <div role="alert" className="space-y-1 type-body">
          <p>
            {isApiError(mutation.error, "PATCH_CONFLICT")
              ? "Ghi chú đã được chỉnh sửa ở nơi khác. Bản bạn đang nhập vẫn còn ở phía trên."
              : errorMessage(mutation.error)}
          </p>
          <Button
            variant="outline"
            type="button"
            size="sm"
            onClick={async () => {
              const latest = await query.refetch()
              if (latest.isSuccess) {
                setDraft(null)
                mutation.reset()
              }
            }}
          >
            Bỏ chỉnh sửa và tải bản mới
          </Button>
        </div>
      )}
      <Button disabled={!draft || draft.body.trim() === query.data.body || mutation.isPending}>
        {mutation.isPending ? "Đang lưu…" : "Lưu ghi chú"}
      </Button>
    </form>
  )
}
