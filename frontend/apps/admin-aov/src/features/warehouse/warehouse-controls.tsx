import { Search } from "lucide-react"
import { useImageContext } from "../media/character-image-context"
import { useContentLocale } from "../publishing/publication-overview"
import { control } from "../publishing/fields"
import { hasRulesetChoice } from "../publishing/default-ruleset"

export function useWarehouseContext() {
  const context = useImageContext()
  const locale = useContentLocale()
  return { ...context, locale }
}
export function WarehouseControls({
  context,
  placeholder = "Tìm tên hoặc mã…",
}: {
  context: ReturnType<typeof useWarehouseContext>
  placeholder?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasRulesetChoice(context.rulesets.data) && (
        <select
          aria-label="Bộ quy tắc"
          className={`${control} w-auto max-w-52`}
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
      )}
      <label className="relative min-w-40 flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${control} pl-9`}
          aria-label={placeholder}
          placeholder={placeholder}
          value={context.search}
          onChange={(event) => context.setSearch(event.target.value)}
          maxLength={100}
        />
      </label>
    </div>
  )
}
