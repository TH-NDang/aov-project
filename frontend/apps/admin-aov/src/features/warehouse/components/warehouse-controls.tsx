import { useImageContext } from "../../media/components/character-image-context"
import { useContentLocale } from "../../publishing/api/publication-overview"
import { control } from "../../publishing/components/fields"
import { hasRulesetChoice } from "../../publishing/model/setup/default-ruleset"
import {
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { FilePenLine } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import type { Variant } from "../../publishing/api/publication-overview"
import { type WarehouseEntry } from "../model/warehouse-types"
import { warehouseName } from "@aov/ui/lib/warehouse-content"

export function WarehouseDraftMenu<T extends WarehouseEntry>({
  entries,
  locale,
  onOpen,
  variants,
}: {
  entries: T[]
  locale: string
  onOpen: (entry: T) => void
  variants?: Variant[]
}) {
  const drafts = entries.filter((entry) => entry.revision.state === "DRAFT")
  if (!drafts.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={`Mở danh sách bản nháp (${drafts.length})`}>
          <FilePenLine aria-hidden /> Bản nháp ({drafts.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 max-w-[calc(100vw-2rem)] overflow-y-auto">
        {drafts.map((entry) => (
          <DropdownMenuItem key={entry.id} onSelect={() => onOpen(entry)} className="flex-col items-start gap-0.5">
            <span>{warehouseName(entry, locale)}</span>
            <span className="type-meta">
              {entry.revision.effectiveFromPatchVariantId
                ? (variants?.find((v) => v.id === entry.revision.effectiveFromPatchVariantId)?.patchCode ??
                  "Đã gắn patch")
                : "Chưa gắn patch"}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function useWarehouseContext() {
  const context = useImageContext()
  const locale = useContentLocale()
  return { ...context, locale }
}
/** Ruleset picker, rendered only when more than one ruleset exists. */
export function WarehouseRulesetSelect({ context }: { context: ReturnType<typeof useWarehouseContext> }) {
  if (!hasRulesetChoice(context.rulesets.data)) return null
  return (
    <select
      aria-label="Bộ quy tắc"
      className={`${control} h-9 w-auto max-w-52 py-0`}
      value={context.rulesetId}
      onChange={(event) => context.setRuleset(event.target.value)}
      disabled={context.rulesets.isPending}
    >
      {context.rulesets.data?.map((ruleset) => (
        <option key={ruleset.id} value={ruleset.id}>
          {ruleset.code}
        </option>
      ))}
    </select>
  )
}
