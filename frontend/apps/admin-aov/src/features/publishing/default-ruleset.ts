/**
 * Gameplay content is shared through rulesets, but the wiki runs on one default ruleset. Pickers and ruleset labels
 * only appear once a second ruleset exists; until then every form uses the default.
 */
export const DEFAULT_RULESET_CODE = "aov-standard"

export function defaultRulesetId(rulesets: readonly { id: string; code: string }[] | undefined) {
  return rulesets?.find((ruleset) => ruleset.code === DEFAULT_RULESET_CODE)?.id ?? rulesets?.[0]?.id ?? ""
}

export const hasRulesetChoice = (rulesets: readonly unknown[] | undefined) => (rulesets?.length ?? 0) > 1
