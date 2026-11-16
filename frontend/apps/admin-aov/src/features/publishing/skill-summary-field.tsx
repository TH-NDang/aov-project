import { useId } from "react"
import { AlignLeft } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { AdminEntityText } from "../terminology/catalog"
import { control } from "./fields"

/** What the server accepts. */
export const SKILL_SUMMARY_LIMIT = 300
/** What the writing rule asks for: one or two sentences a newcomer reads in a few seconds. */
export const SKILL_SUMMARY_TARGET = 200

/** A summary is one paragraph, so a pasted line break becomes a space. */
export const singleParagraph = (text: string) => text.replace(/\s*[\r\n]+\s*/g, " ")

/** Nothing written is stored as no summary, so clearing the box does not read as an edit of an empty one. */
export const summaryValue = (text: string) => (text.trim() ? text : null)

/**
 * The short plain text beside a skill's full description: what the skill does and what to remember when using it.
 * The counter turns to a warning past the length the writing rule asks for; the box stops at the server's limit.
 */
export function SkillSummaryField({
  value,
  onChange,
  label = "Tóm tắt",
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}) {
  const id = useId()
  const long = value.length > SKILL_SUMMARY_TARGET
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <label htmlFor={id} className="type-label flex items-center gap-2">
          <AlignLeft aria-hidden className="size-4 text-muted-foreground" />
          {label}
        </label>
        <span
          id={`${id}-count`}
          className={cn("type-meta tabular-nums", long && "text-amber-700 dark:text-amber-400")}
          aria-label={`${value.length} trên ${SKILL_SUMMARY_TARGET} ký tự nên dùng`}
        >
          {long && "Nên rút gọn · "}
          {value.length}/{SKILL_SUMMARY_TARGET}
        </span>
      </div>
      <textarea
        id={id}
        rows={2}
        maxLength={SKILL_SUMMARY_LIMIT}
        disabled={disabled}
        aria-describedby={`${id}-count`}
        placeholder="Chiêu làm gì và điều cần nhớ khi dùng, trong một đến hai câu."
        className={cn(control, "field-sizing-content min-h-16 resize-none leading-6")}
        value={value}
        onChange={(event) => onChange(singleParagraph(event.target.value))}
      />
    </div>
  )
}

/** The summary as readers see it, above the full description it is checked against. */
export function SkillSummaryText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      <p className="type-label text-muted-foreground">Tóm tắt</p>
      <p className="type-body break-words [overflow-wrap:anywhere]">
        <AdminEntityText text={text} />
      </p>
    </div>
  )
}
