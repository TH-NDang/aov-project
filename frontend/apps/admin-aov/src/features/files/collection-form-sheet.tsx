import { useEffect, useRef, useState, type FormEvent } from "react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmDiscard } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { useIsWide } from "@/hooks/use-media-query"
import { control } from "../publishing/fields"
import { SOURCE_CATEGORIES, useSaveCollection, type SourceCategory, type SourceCollection } from "./files-api"
import { CATEGORY_HINTS, CATEGORY_LABELS } from "./files-format"

const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Creates a collection, or changes the label, note and capture day of one; code and category never change. */
export function CollectionFormSheet({
  open,
  collection,
  onClose,
  onSaved,
}: {
  open: boolean
  collection: SourceCollection | null
  onClose: () => void
  onSaved: (saved: SourceCollection) => void
}) {
  const wide = useIsWide()
  const dirty = useRef(false)
  // Closing with typed text asks first, like every other editor of the Admin.
  const close = async () => {
    if (
      dirty.current &&
      !(await confirmDiscard({ title: "Đóng mà không lưu?", description: "Thông tin vừa nhập sẽ mất." }))
    )
      return
    dirty.current = false
    onClose()
  }
  return (
    <Sheet open={open} onOpenChange={(next) => !next && void close()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(480px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>{collection ? "Sửa thông tin bộ tệp" : "Tạo bộ tệp"}</SheetTitle>
          <SheetDescription>
            {collection
              ? "Mã và chức năng giữ nguyên vì công cụ đồng bộ gọi bộ bằng mã."
              : "Mỗi bộ là một lượt chụp hay một gói dữ liệu của một chức năng."}
          </SheetDescription>
        </SheetHeader>
        {open && (
          <CollectionForm
            key={collection?.id ?? "new"}
            collection={collection}
            onDirtyChange={(value) => {
              dirty.current = value
            }}
            onSaved={(saved) => {
              dirty.current = false
              onSaved(saved)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function CollectionForm({
  collection,
  onDirtyChange,
  onSaved,
}: {
  collection: SourceCollection | null
  onDirtyChange: (dirty: boolean) => void
  onSaved: (saved: SourceCollection) => void
}) {
  const save = useSaveCollection(collection)
  const [code, setCode] = useState("")
  const [category, setCategory] = useState<SourceCategory>("IMPORT_DATA")
  const [label, setLabel] = useState(collection?.label ?? "")
  const [note, setNote] = useState(collection?.note ?? "")
  const [capturedOn, setCapturedOn] = useState(collection?.capturedOn ?? "")
  const [error, setError] = useState<string | null>(null)
  const saving = save.isPending
  const codeValid = collection !== null || CODE.test(code)
  const dirty =
    code !== "" ||
    label !== (collection?.label ?? "") ||
    note !== (collection?.note ?? "") ||
    capturedOn !== (collection?.capturedOn ?? "")
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!codeValid || !label.trim()) return
    setError(null)
    save.mutate(
      { label: label.trim(), note: note.trim() || null, capturedOn: capturedOn || null, code, category },
      { onSuccess: onSaved, onError: (cause) => setError(errorMessage(cause)) },
    )
  }

  return (
    <form
      className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-6"
      onSubmit={(event) => void submit(event)}
    >
      {!collection && (
        <>
          <label className="grid gap-1.5">
            <span className="type-label">Mã bộ</span>
            <Input
              value={code}
              required
              maxLength={120}
              placeholder="shop-2026-09-16"
              aria-invalid={code !== "" && !codeValid}
              onChange={(event) => setCode(event.target.value.trim().toLowerCase())}
            />
            <span className="type-meta">Chữ thường, số và gạch nối; không đổi được sau khi tạo.</span>
          </label>
          <label className="grid gap-1.5">
            <span className="type-label">Chức năng</span>
            <select
              className={control}
              value={category}
              onChange={(event) => setCategory(event.target.value as SourceCategory)}
            >
              {SOURCE_CATEGORIES.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
            <span className="type-meta">{CATEGORY_HINTS[category]}</span>
          </label>
        </>
      )}
      <label className="grid gap-1.5">
        <span className="type-label">Tên hiển thị</span>
        <Input
          value={label}
          required
          maxLength={200}
          placeholder="Ảnh cửa hàng 16/09/2026"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className="grid gap-1.5">
        <span className="type-label">Ngày chụp</span>
        <Input type="date" value={capturedOn} onChange={(event) => setCapturedOn(event.target.value)} />
      </label>
      <label className="grid gap-1.5">
        <span className="type-label">Ghi chú</span>
        <Textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      {error && (
        <p role="alert" className="type-body text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !codeValid || !label.trim()}>
          {saving ? "Đang lưu…" : collection ? "Lưu" : "Tạo bộ"}
        </Button>
      </div>
    </form>
  )
}
