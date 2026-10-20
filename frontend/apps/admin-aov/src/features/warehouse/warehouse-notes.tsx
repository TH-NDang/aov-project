import { Field } from "../publishing/fields"

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
  return (
    <section className="space-y-3">
      {source && (
        <details className="rounded-lg border bg-muted/20 p-3 text-xs">
          <summary className="cursor-pointer font-medium">Nguồn dữ liệu import</summary>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-muted-foreground">
            <dt>File nguồn</dt>
            <dd className="break-all">{String(source.sourceFile ?? "—")}</dd>
            <dt>Ngày thu thập</dt>
            <dd>{String(source.collectedOn ?? "Chưa xác định")}</dd>
            <dt>Mốc dữ liệu</dt>
            <dd>Bản nền thu thập, chưa suy ra thay đổi của patch.</dd>
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-muted-foreground">Xem bản ghi nguồn đầy đủ</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px]">
              {JSON.stringify(source, null, 2)}
            </pre>
          </details>
        </details>
      )}
      <Field
        label="Ghi chú biên tập"
        multiline
        value={source ? String(source.editorNote ?? "") : (value ?? "")}
        disabled={disabled}
        onChange={(note) => onChange(source ? JSON.stringify({ ...source, editorNote: note }) : note || null)}
      />
    </section>
  )
}
