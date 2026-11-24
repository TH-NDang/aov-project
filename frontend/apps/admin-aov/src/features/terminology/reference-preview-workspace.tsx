import { useMemo, useState } from "react"
import { Eraser, FlaskConical, Languages, Undo2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { EntityIconResolver } from "@aov/ui/components/entity-rich-text"
import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import type { EntityReferenceSearch } from "@aov/ui/lib/entity-rich-text-editor"
import { languageOptions } from "../users/profile-preference-picker"
import { AdminDescriptionField } from "./rich-text-field"
import { StreamTextPreview } from "./stream-text-preview"
import { NativeSelect } from "@/components/native-select"
import { Segmented } from "@/components/segmented"

/** Game text is recognized in Admin and on the Wiki, text people write on Stream; each has rules of its own. */
export type TextKind = "GAME" | "STREAM"

const textKinds = [
  ["GAME", "Văn bản game"],
  ["STREAM", "Văn bản Stream"],
] as const

const examples: Record<TextKind, string> = {
  GAME: "Gây <b>sát thương phép</b> và làm chậm mục tiêu. Nhận <color=#16a34a>lá chắn</color> khi sử dụng chiêu.",
  STREAM:
    "AOG là giải chuyên nghiệp của Việt Nam, RoV Pro League (RPL) là giải của Thái Lan. Các đội đứng đầu gặp nhau ở AIC.",
}

interface Props {
  kind: TextKind
  onKindChange: (kind: TextKind) => void
  /** The text of `kind`; each kind keeps its own. */
  value: string
  onChange: (value: string) => void
  locale: string
  onLocaleChange: (locale: string) => void
  entities: EntityReference[]
  fallbackLocale: string
  autoRecognize: boolean
  resolveIcon?: EntityIconResolver
  searchReferences?: EntityReferenceSearch
  disabled?: boolean
  maxLength?: number
}

/**
 * A scratch box for trying how a text reads. Game text is written in the same description box as every page, text for
 * Stream in the box people write in: both are written and read in one place, so there is no second pane.
 */
export function ReferencePreviewWorkspace({
  kind,
  onKindChange,
  value,
  onChange,
  locale,
  onLocaleChange,
  entities,
  fallbackLocale,
  autoRecognize,
  resolveIcon,
  searchReferences,
  disabled,
  maxLength,
}: Props) {
  const [cleared, setCleared] = useState<{ kind: TextKind; text: string } | null>(null)
  const references = useMemo(
    () => ({ entities, fallbackLocale, autoRecognize, resolveIcon, searchReferences }),
    [entities, fallbackLocale, autoRecognize, resolveIcon, searchReferences],
  )
  const exampleValue = value ? `${value}\n\n${examples[kind]}` : examples[kind]
  const exampleFits = exampleValue.length <= Math.min(100000, maxLength ?? 100000)

  function change(next: string) {
    setCleared(null)
    onChange(next)
  }

  return (
    <section aria-label="Thử nội dung" className="@container/preview min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 p-2.5">
        <Segmented label="Loại văn bản" value={kind} options={textKinds} onChange={onKindChange} />
        <label className="flex h-9 min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 type-body shadow-xs focus-within:ring-2 focus-within:ring-ring/30">
          <Languages aria-hidden className="hidden size-4 shrink-0 text-muted-foreground @xl/preview:block" />
          <NativeSelect
            aria-label="Ngôn ngữ thử hiển thị"
            className="h-auto min-w-0 max-w-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value)}
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            title={value ? "Chèn ví dụ vào cuối nội dung" : "Dùng nội dung mẫu"}
            disabled={!exampleFits || disabled}
            onClick={() => change(exampleValue)}
          >
            <FlaskConical aria-hidden className="size-4" />
            Ví dụ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            disabled={!value || disabled}
            onClick={() => {
              setCleared({ kind, text: value })
              onChange("")
            }}
          >
            <Eraser aria-hidden className="size-4" />
            Xóa
          </Button>
        </div>
      </div>
      {kind === "STREAM" ? (
        <StreamTextPreview value={value} onChange={change} locale={locale} disabled={disabled} maxLength={maxLength} />
      ) : (
        <AdminDescriptionField
          label="Nội dung thử"
          value={value}
          onChange={change}
          locale={locale}
          disabled={disabled}
          maxLength={maxLength}
          references={references}
        />
      )}
      {cleared?.kind === kind && !value && (
        <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-1">
          <span role="status" className="type-meta">
            Đã xóa nội dung thử.
          </span>
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => change(cleared.text)}>
            <Undo2 aria-hidden className="size-4" />
            Khôi phục nội dung
          </Button>
        </div>
      )}
      <p className="type-meta">Nội dung thử không được lưu.</p>
    </section>
  )
}
