import { History } from "lucide-react"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { cn } from "@aov/ui/lib/utils"
import type { Revision, Ruleset } from "@/lib/hero-types"

export const REVISION_STATES: Record<Revision["state"], string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  DISCARDED: "Đã hủy",
}

/** The row of the hero's ⋯ menu that names the version on screen and opens the list of versions. */
export function HeroVersionMenuItem({
  revision,
  disabled,
  onOpen,
}: {
  revision: Revision
  disabled?: boolean
  onOpen: () => void
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      className="gap-2"
      aria-label="Phiên bản dữ liệu"
      data-revision={revision.id}
      onSelect={onOpen}
    >
      <History />
      <span className="min-w-0 flex-1 truncate">Phiên bản #{revision.revisionNo}</span>
      <span className="type-meta shrink-0">{REVISION_STATES[revision.state]}</span>
    </DropdownMenuItem>
  )
}

/**
 * Every version of the hero, newest first as the server lists them, one large row each. A sheet rather than a menu, so
 * it reads well on a phone, where it rises from the bottom.
 */
export function HeroVersionSheet({
  open,
  onOpenChange,
  revision,
  revisions,
  rulesets,
  selectedId,
  disabled,
  onChoose,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  revision: Revision
  revisions: Revision[] | undefined
  rulesets: Ruleset[] | undefined
  selectedId: string
  disabled: boolean
  onChoose: (revisionId: string) => void
}) {
  const rows = revisions ?? [revision]
  const manyRulesets = new Set(rows.map((row) => row.rulesetId)).size > 1
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" fitContent className="w-full gap-0 overflow-y-auto sm:max-w-sm">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="type-section-title">Phiên bản dữ liệu</SheetTitle>
          <SheetDescription className="type-meta">Chọn phiên bản để xem; bản nháp là nơi sửa.</SheetDescription>
        </SheetHeader>
        <div role="radiogroup" aria-label="Phiên bản dữ liệu" className="grid gap-1 p-2">
          {rows.map((row) => {
            const checked = row.id === selectedId
            return (
              <button
                key={row.id}
                type="button"
                role="radio"
                aria-checked={checked}
                data-revision={row.id}
                disabled={disabled}
                className={cn(
                  "flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                  checked ? "bg-primary/10" : "hover:bg-muted",
                )}
                onClick={() => {
                  onChoose(row.id)
                  onOpenChange(false)
                }}
              >
                <span className={cn("type-label w-8 shrink-0 tabular-nums", checked && "text-primary")}>
                  #{row.revisionNo}
                </span>
                <span className={cn("type-body min-w-0 flex-1 truncate", checked && "font-semibold text-primary")}>
                  {REVISION_STATES[row.state]}
                </span>
                {manyRulesets && (
                  <span className="type-meta shrink-0">
                    {rulesets?.find((item) => item.id === row.rulesetId)?.code ?? "Bộ quy tắc khác"}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
