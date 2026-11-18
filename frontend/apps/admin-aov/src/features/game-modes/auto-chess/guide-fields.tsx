import { useState, type CSSProperties, type ReactNode } from "react"
import { Check, PencilLine, Upload, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { AdminDescriptionField } from "../../terminology/rich-text-field"
import { slugify } from "@/lib/text"

/** One group of related fields with its own heading, so a long form reads as a few short parts. */
export function FormBlock({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-0.5">
        <h3 className="type-label">{title}</h3>
        {hint && <p className="type-meta">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { value: T; label: ReactNode; color?: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            style={on && option.color ? ({ "--seg": option.color } as CSSProperties) : undefined}
            className={`type-label inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 whitespace-nowrap transition-colors ${
              on
                ? option.color
                  ? "bg-[color-mix(in_srgb,var(--seg)_22%,transparent)] text-foreground ring-1 ring-[var(--seg)]"
                  : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.icon ??
              (option.color && <span className="size-2 rounded-full" style={{ background: option.color }} />)}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** The code shows quietly under the name; changing it renames every place that points at it. */
export function CodeLine({
  code,
  onRename,
  editing,
  onEditing,
}: {
  code: string
  onRename: (code: string) => void
  editing: boolean
  onEditing: (editing: boolean) => void
}) {
  const [draft, setDraft] = useState(code)
  if (!editing)
    return (
      <span className="type-meta flex items-center gap-1">
        Mã: <code className="rounded bg-muted px-1.5 py-0.5">{code || "(tự tạo từ tên)"}</code>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Đổi mã"
          title="Đổi mã"
          onClick={() => {
            setDraft(code)
            onEditing(true)
          }}
        >
          <PencilLine />
        </Button>
      </span>
    )
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft) return
        onRename(draft)
        onEditing(false)
      }}
    >
      <Input
        autoFocus
        aria-label="Mã mới"
        className="h-8 max-w-56"
        value={draft}
        onChange={(event) => setDraft(slugify(event.target.value))}
        onKeyDown={(event) => event.key === "Escape" && onEditing(false)}
      />
      <Button type="submit" size="icon-sm" variant="ghost" aria-label="Lưu mã" disabled={!draft}>
        <Check />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Hủy đổi mã" onClick={() => onEditing(false)}>
        <X />
      </Button>
    </form>
  )
}

/** A picture you click to replace; large where the picture is the point of the entry. */
export function IconUpload({
  src,
  onFile,
  size = "md",
  round,
  label = "Đổi ảnh",
  color,
}: {
  src?: string
  onFile: (file: File) => Promise<void>
  size?: "sm" | "md" | "lg"
  round?: boolean
  label?: string
  color?: string
}) {
  const [busy, setBusy] = useState(false)
  const box = { sm: "size-10", md: "size-14", lg: "size-20" }[size]
  return (
    <label
      className={`group relative inline-flex ${box} shrink-0 cursor-pointer items-center justify-center overflow-hidden border-2 bg-muted ${round ? "rounded-full" : "rounded-lg"}`}
      style={{ borderColor: color ?? "var(--border)" }}
      title={label}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <Upload className="size-5 text-muted-foreground" />
      )}
      <span className="type-meta absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-white opacity-0 transition-opacity group-hover:opacity-100">
        Đổi
      </span>
      {busy && <span className="absolute inset-0 bg-background/70" />}
      <input
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (!file) return
          setBusy(true)
          try {
            await onFile(file)
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}

export function RichField({
  label,
  value,
  onChange,
  short,
  bare,
}: {
  label: string
  value?: string | null
  onChange: (value: string | null) => void
  short?: boolean
  /** Hides the label where the block above already names the field. */
  bare?: boolean
}) {
  // Guide cards show no paragraph types or tables; a short row keeps its formatting in the bar over a selection.
  return (
    <AdminDescriptionField
      label={label}
      locale="vi-VN"
      value={value ?? ""}
      onChange={(next) => onChange(next || null)}
      size={short ? "short" : "regular"}
      toolbar={!short}
      paragraphStyles={false}
      exampleTables={false}
      hideLabel={bare}
    />
  )
}

export const Thumb = ({ src, color, round }: { src?: string; color?: string; round?: boolean }) =>
  src ? (
    <img
      src={src}
      alt=""
      className={`size-8 shrink-0 border-2 object-cover ${round ? "rounded-full" : "rounded-md"}`}
      style={{ borderColor: color ?? "transparent" }}
    />
  ) : (
    <span
      className={`size-8 shrink-0 border-2 bg-muted ${round ? "rounded-full" : "rounded-md"}`}
      style={{ borderColor: color ?? "transparent" }}
    />
  )
