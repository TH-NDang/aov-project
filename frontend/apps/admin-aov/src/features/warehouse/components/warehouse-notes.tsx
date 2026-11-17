import { Field } from "../../publishing/components/fields"

export function WarehouseNotes({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
}) {
  let source: Record<string, unknown> | null = null
  try {
    const parsed = JSON.parse(value ?? "")
    if (parsed && typeof parsed === "object" && parsed.importer) source = parsed
  } catch {
    /* Plain editorial notes need no source metadata. */
  }
  const note = source ? String(source.editorNote ?? "") : (value ?? "")
  return (
    <section className="space-y-3">
      {source && (
        <details className="rounded-lg border bg-muted/20 p-3 text-xs">
          <summary className="cursor-pointer font-medium">Nguồn dữ liệu nhập</summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-muted-foreground">
            <dt>Tệp nguồn</dt>
            <dd className="break-all">{String(source.sourceFile ?? "—")}</dd>
            <dt>Ngày thu thập</dt>
            <dd>{String(source.collectedOn ?? "Chưa xác định")}</dd>
            <dt>Loại dữ liệu</dt>
            <dd>Bản nhập từ nguồn; chưa tính là thay đổi của patch nào.</dd>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-muted-foreground">Xem bản ghi nguồn đầy đủ</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(source, null, 2)}
            </pre>
          </details>
        </details>
      )}
      {disabled ? (
        note && <p className="type-body whitespace-pre-wrap">{note}</p>
      ) : (
        <Field
          label="Ghi chú biên tập"
          multiline
          value={note}
          disabled={disabled}
          onChange={(note) => onChange(source ? JSON.stringify({ ...source, editorNote: note }) : note || null)}
        />
      )}
    </section>
  )
}
