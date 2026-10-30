import { useImageContext } from "../media/character-image-context"
import { useContentLocale } from "../publishing/publication-overview"
import { control } from "../publishing/fields"
import { hasRulesetChoice } from "../publishing/default-ruleset"

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
