import type { InputHTMLAttributes, ReactNode } from "react"
import type { Source } from "./types"
import { Button } from "@aov/ui/components/button"
export const control = "w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
export function Field({
  label,
  value,
  onChange,
  multiline,
  ...props
}: { label: string; value: string | number; onChange: (value: string) => void; multiline?: boolean } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
>) {
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
        <input {...props} className={control} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}
export function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}
export function SourceFields({ sources, onChange }: { sources: Source[]; onChange: (sources: Source[]) => void }) {
  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Nguồn tham khảo ({sources.length})</summary>
      <div className="mt-3 space-y-3">
        {sources.map((source, i) => (
          <div key={i} className="grid gap-3 border-b pb-3 sm:grid-cols-2">
            <Field
              label="Nhãn nguồn"
              value={source.label}
              onChange={(label) => onChange(sources.map((s, n) => (n === i ? { ...s, label } : s)))}
            />
            <Field
              label="URL nguồn"
              type="url"
              value={source.sourceUrl ?? ""}
              onChange={(sourceUrl) =>
                onChange(sources.map((s, n) => (n === i ? { ...s, sourceUrl: sourceUrl || null } : s)))
              }
            />
            <Field
              label="Ngày quan sát (ISO 8601)"
              value={source.observedAt ?? ""}
              onChange={(observedAt) =>
                onChange(sources.map((s, n) => (n === i ? { ...s, observedAt: observedAt || null } : s)))
              }
            />
            <Field
              label="Ghi chú"
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
    </details>
  )
}
