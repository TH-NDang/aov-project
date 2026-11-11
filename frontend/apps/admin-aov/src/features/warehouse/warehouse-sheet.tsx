import { useState, type ReactNode } from "react"
import { Archive, Check, ChevronDown, Copy, LoaderCircle, Pencil, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { usePublicationOverview } from "../publishing/publication-overview"
import { confirmAction } from "@/components/confirm-dialog"
import { AdminRichTextPreview } from "../terminology/rich-text-field"
import type { WarehouseTranslation } from "./warehouse-types"

/*
 * The pieces every warehouse sheet (items, spells, enchantments, arcana) shares, so the four read and act alike:
 * a compact header whose right side holds the version and everything that acts on it, underlined tabs right under
 * it, and the description shown as it was written.
 */

/** Underlined tabs right under the header: they continue it instead of starting a second block. */
export const SHEET_TAB_LIST =
  "w-full shrink-0 justify-start gap-4 overflow-x-auto border-b px-4 group-data-[orientation=horizontal]/tabs:h-10"

/** A tab sized to its label, marked by the accent line along the bottom edge when chosen. */
export const SHEET_TAB = "flex-none px-1 after:bg-primary data-[state=active]:text-foreground"

/** The sheet takes focus itself, so opening it does not ring the first button in the header. */
export function focusSheet(event: Event) {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement | null)?.focus()
}

/** Why a version exists: the hero page and the sheets share one set of names. */
export { CAUSE_NAMES } from "../publishing/version-causes"

export function versionLabel(revisionNo: number | undefined, state: string | undefined, editing: boolean) {
  const status = editing
    ? "Đang sửa"
    : state === "DRAFT"
      ? "Bản nháp"
      : state === "PUBLISHED"
        ? "Đã xuất bản"
        : state === "DISCARDED"
          ? "Đã bỏ"
          : null
  return [revisionNo != null ? `Bản ${revisionNo}` : null, status].filter(Boolean).join(" · ")
}

/** The entry's code, copied with one click instead of taking a line of the header. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const label = copied ? "Đã sao chép mã" : `Sao chép mã ${code}`
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="shrink-0 text-muted-foreground"
      title={label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          // The clipboard can be blocked outside secure pages; the code stays in the label.
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  )
}

/**
 * The right side of a sheet header, in one row of equal-height controls: the version, discarding the draft, saving,
 * publishing, the single pencil and closing. On a narrow screen the row drops below the name rather than squeezing it.
 */
export function SheetActions({
  version,
  editing,
  disabled,
  edit,
  draft,
  discard,
  save,
  publish,
  onClose,
  closeDisabled,
  language,
}: {
  version: string
  editing: boolean
  disabled: boolean
  /** The pencil on a draft: it turns the page into its form and back. Left out when the reader may not edit. */
  edit?: { label: string; pressed?: boolean; onClick: () => void }
  /** The pencil on a published version: it opens the draft or starts one, so it replaces `edit`. */
  draft?: DraftOptions
  discard?: { description: string; onConfirm: () => void }
  save?: { label: string; title?: string; busy?: boolean; disabled?: boolean; onClick: () => void }
  publish?: { disabled: boolean; title?: string; quiet?: boolean; onClick: () => void }
  onClose: () => void
  closeDisabled?: boolean
  /** The language icon, first in the row: it sets what the page reads and edits in. */
  language?: ReactNode
}) {
  return (
    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {version && (
        <span className={`type-meta mr-1 whitespace-nowrap ${editing ? "text-primary" : ""}`}>{version}</span>
      )}
      {language}
      {discard && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={disabled}
          title="Bỏ nháp"
          aria-label="Bỏ nháp"
          onClick={async () => {
            const confirmed = await confirmAction({
              title: "Bỏ bản nháp này?",
              description: discard.description,
              confirmLabel: "Bỏ nháp",
              cancelLabel: "Giữ bản nháp",
            })
            if (confirmed) discard.onConfirm()
          }}
        >
          <Archive />
        </Button>
      )}
      {publish && (
        <Button
          type="button"
          variant={publish.quiet ? "outline" : "default"}
          size="sm"
          disabled={disabled || publish.disabled}
          title={publish.title}
          onClick={publish.onClick}
        >
          Xuất bản
        </Button>
      )}
      {save && (
        <Button type="button" size="sm" disabled={disabled || save.disabled} title={save.title} onClick={save.onClick}>
          {save.busy && <LoaderCircle className="animate-spin" />}
          {save.label}
        </Button>
      )}
      {draft && <DraftPencil {...draft} disabled={disabled || draft.disabled} />}
      {edit && !draft && (
        <Button
          type="button"
          variant={editing ? "secondary" : "outline"}
          size="icon-sm"
          disabled={disabled}
          title={edit.label}
          aria-label={edit.label}
          aria-pressed={edit.pressed}
          onClick={edit.onClick}
        >
          {editing ? <Check /> : <Pencil />}
        </Button>
      )}
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        disabled={closeDisabled}
        title="Đóng"
        aria-label="Đóng"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  )
}

/** A change started from a published version: what kind of draft, and for a game update the patch it belongs to. */
export type NewDraft = {
  /** The revision cause the backend records: CONTENT_CORRECTION, GAME_PATCH, or a page's own. Translating is started
   * from each language's pencil in the language menu, not from here. */
  cause: string
  patchVariantId?: string
}

export interface DraftOptions {
  /** What is being edited, as the user-facing noun the pencil's label ends with (an item, a spell, a hero…). */
  name: string
  rulesetId: string
  /** The patch of the version on screen; a game update can only come after it. */
  basePatchVariantId?: string | null
  /** The draft already open for this entry; only one exists at a time, so it is the only choice. */
  openDraft?: { revisionNo?: number; onOpen: () => void }
  onCreate?: (draft: NewDraft) => void
  /** Further kinds a page offers after the common three, such as replacing a hero's artwork. */
  extraKinds?: { cause: string; title: string; note: string }[]
  disabled?: boolean
  /** Matches the pencil to the buttons beside it; the sheets' header buttons are a size smaller than a page's. */
  triggerClassName?: string
}

/**
 * The single pencil on a published version. It opens the draft already in progress or starts a new one of the chosen
 * kind, which used to sit on a separate versions tab.
 */
export function DraftPencil({
  name,
  rulesetId,
  basePatchVariantId,
  openDraft,
  onCreate,
  extraKinds = [],
  disabled,
  triggerClassName = "h-8 bg-background px-2",
}: DraftOptions) {
  const [open, setOpen] = useState(false)
  const overview = usePublicationOverview(open && !openDraft)
  const variants = overview.data?.variants.filter((v) => v.rulesetId === rulesetId && v.status === "PUBLISHED") ?? []
  const base = variants.find((v) => v.id === basePatchVariantId)?.rulesetOrdinal ?? -1
  const later = variants.filter((v) => v.rulesetOrdinal > base).sort((a, b) => b.rulesetOrdinal - a.rulesetOrdinal)
  const season = (id: string | null) => overview.data?.seasons.find((entry) => entry.id === id)?.displayName
  const label = openDraft ? `Mở nháp và sửa ${name}` : `Tạo nháp và sửa ${name}`
  const choice = (title: string, note: string) => (
    <span className="grid min-w-0 gap-0.5">
      <span className="type-body">{title}</span>
      <span className="type-meta">{note}</span>
    </span>
  )
  if (!openDraft && !onCreate) return null
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`gap-0.5 ${triggerClassName}`}
          disabled={disabled}
          title={label}
          aria-label={label}
        >
          <Pencil />
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {openDraft ? (
          <DropdownMenuItem onSelect={openDraft.onOpen}>
            {choice(
              `Mở bản nháp${openDraft.revisionNo != null ? ` #${openDraft.revisionNo}` : ""}`,
              "Mỗi mục chỉ có một bản nháp; sửa tiếp ở đó.",
            )}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuLabel className="type-meta">Tạo bản nháp từ bản đang mở</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onCreate?.({ cause: "CONTENT_CORRECTION" })}>
              {choice("Sửa nội dung", "Sửa lỗi hoặc bổ sung; giữ nguyên patch.")}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {choice("Cập nhật theo patch", "Thay đổi trong game ở một patch mới.")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                {overview.isPending ? (
                  <DropdownMenuItem disabled>Đang tải patch…</DropdownMenuItem>
                ) : later.length ? (
                  later.map((variant) => (
                    <DropdownMenuItem
                      key={variant.id}
                      onSelect={() => onCreate?.({ cause: "GAME_PATCH", patchVariantId: variant.id })}
                    >
                      {choice(variant.patchTitle || variant.patchCode, season(variant.seasonId) ?? variant.patchCode)}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>Chưa có patch mới hơn bản đang mở.</DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {extraKinds.map((kind) => (
              <DropdownMenuItem key={kind.cause} onSelect={() => onCreate?.({ cause: kind.cause })}>
                {choice(kind.title, kind.note)}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Joins the line breaks copied from the game's narrow text boxes: a line that stops mid-sentence and carries on in
 * lower case. Breaks that start a stat, an effect or a new sentence stay where they are.
 */
export function joinWrappedLines(text: string) {
  return text.replace(/([^\s.:;!?)\]])[ \t]*\r?\n[ \t]*(?=\p{Ll})/gu, "$1 ")
}

/** The whole description as it was written in the content language, with its separately listed effects. */
export function WarehouseDescription({
  text,
  showSummary = false,
}: {
  text: WarehouseTranslation | undefined
  showSummary?: boolean
}) {
  if (!text) return <p className="type-meta">Chưa có tên và mô tả.</p>
  return (
    <div className="space-y-3">
      {showSummary && text.summary && text.summary !== text.description && (
        <div className="type-body text-muted-foreground">
          <AdminRichTextPreview text={text.summary} locale={text.locale} />
        </div>
      )}
      {text.description ? (
        // The description is read line by line: each stat and each effect starts its own line.
        <div className="type-body rounded-lg border bg-muted/20 p-3 whitespace-pre-line">
          <AdminRichTextPreview text={joinWrappedLines(text.description)} locale={text.locale} />
        </div>
      ) : (
        <p className="type-meta">Chưa có mô tả.</p>
      )}
      {!!text.effects?.length && (
        <ul className="space-y-2">
          {text.effects.map((effect, index) => (
            <li key={index} className="type-body whitespace-pre-line">
              <span className="font-semibold">{effect.name || effect.key}</span>
              {effect.type && <span className="type-meta"> · {effect.type}</span>}
              {effect.description && (
                <AdminRichTextPreview text={joinWrappedLines(effect.description)} locale={text.locale} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
