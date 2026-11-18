import type { InputHTMLAttributes, ReactNode } from "react"
import type { Source } from "@/lib/hero-types"
import { Button } from "@aov/ui/components/button"
import { AdminDescriptionField } from "../../../terminology/rich-text-field"
import { BookOpenText } from "lucide-react"
import { EditorToolSheet } from "./editor-tool-sheet"
import { Input } from "@aov/ui/components/input"
export const control = "w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
export function Field({
  label,
  value,
  onChange,
  multiline,
  richTextLocale,
  ...props
}: {
  label: string
  value: string | number
  onChange: (value: string) => void
  multiline?: boolean
  richTextLocale?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  // A rich text is written in the shared description box; a locked one stays readable in the same box.
  if (multiline && richTextLocale !== undefined)
    return (
      <AdminDescriptionField
        key={richTextLocale}
        label={label}
        value={String(value)}
        onChange={onChange}
        locale={richTextLocale}
        disabled={props.disabled}
        required={props.required}
      />
    )
  return (
    <label className="grid gap-1.5 text-sm">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className={control + " min-h-28"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={props.disabled}
          required={props.required}
        />
      ) : (
        <Input {...props} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
export function Box({ title, children, unframed }: { title: string; children: ReactNode; unframed?: boolean }) {
  if (unframed)
    return (
      <section aria-label={title} className="min-w-0">
        {children}
      </section>
    )
  return (
    <section className="space-y-4 admin-section py-4 md:py-6">
      <h2 className="type-section-title">{title}</h2>
      {children}
    </section>
  )
}

function sourceDateInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 19)
}

export function SectionSources({
  sources,
  onChange,
  sectionLabel,
  disabled,
}: {
  sources: Source[]
  onChange: (sources: Source[]) => void
  sectionLabel: string
  disabled?: boolean
}) {
  return (
    <EditorToolSheet
      title="Nguồn tham khảo"
      description={`Nguồn đối chiếu cho toàn bộ phần ${sectionLabel.toLowerCase()}.`}
      value={sources}
      onApply={onChange}
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Nguồn tham khảo (${sources.length})`}
          title="Nguồn tham khảo"
          className="text-muted-foreground"
        >
          <BookOpenText className="size-4" />
          <span>Nguồn</span>
          {sources.length > 0 && <span className="type-label tabular-nums">{sources.length}</span>}
        </Button>
      }
    >
      {(draft, update) => <SourceFields sources={draft} onChange={update} />}
    </EditorToolSheet>
  )
}

function SourceFields({ sources, onChange }: { sources: Source[]; onChange: (sources: Source[]) => void }) {
  return (
    <div className="space-y-3">
      {!sources.length && <p className="type-meta">Chưa có nguồn tham khảo cho phần này.</p>}
      {sources.map((source, i) => (
        <div key={i} className="grid gap-3 border-b pb-3 sm:grid-cols-2">
          <Field
            label="Nhãn nguồn"
            required
            maxLength={255}
            value={source.label}
            onChange={(label) => onChange(sources.map((s, n) => (n === i ? { ...s, label } : s)))}
          />
          <Field
            label="URL nguồn"
            type="url"
            maxLength={2000}
            value={source.sourceUrl ?? ""}
            onChange={(sourceUrl) =>
              onChange(sources.map((s, n) => (n === i ? { ...s, sourceUrl: sourceUrl || null } : s)))
            }
          />
          <Field
            label="Ngày giờ ghi nhận nguồn"
            type="datetime-local"
            step="1"
            value={sourceDateInput(source.observedAt)}
            onChange={(observedAt) =>
              onChange(
                sources.map((s, n) =>
                  n === i ? { ...s, observedAt: observedAt ? new Date(observedAt).toISOString() : null } : s,
                ),
              )
            }
          />
          <Field
            label="Ghi chú"
            maxLength={4000}
            value={source.note ?? ""}
            onChange={(note) => onChange(sources.map((s, n) => (n === i ? { ...s, note } : s)))}
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={source.verificationState === "VERIFIED"}
              onChange={(e) =>
                onChange(
                  sources.map((s, n) =>
                    n === i ? { ...s, verificationState: e.target.checked ? "VERIFIED" : "UNVERIFIED" } : s,
                  ),
                )
              }
            />
            Đã đối chiếu nguồn
          </label>
          <Button type="button" variant="outline" onClick={() => onChange(sources.filter((_, n) => n !== i))}>
            Bỏ nguồn
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={sources.length >= 30}
        onClick={() =>
          onChange([
            ...sources,
            { label: "", sourceUrl: null, observedAt: null, verificationState: "UNVERIFIED", note: null },
          ])
        }
      >
        Thêm nguồn
      </Button>
    </div>
  )
}
