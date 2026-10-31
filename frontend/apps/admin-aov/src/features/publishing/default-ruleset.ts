/**
 * Gameplay content is shared through rulesets, but the wiki runs on one default ruleset. Pickers and ruleset labels
 * only appear once a second ruleset exists; until then every form uses the default.
 */
export const DEFAULT_RULESET_CODE = "aov-standard"

export function defaultRulesetId(rulesets: readonly { id: string; code: string }[] | undefined) {
  return rulesets?.find((ruleset) => ruleset.code === DEFAULT_RULESET_CODE)?.id ?? rulesets?.[0]?.id ?? ""
}

export const hasRulesetChoice = (rulesets: readonly unknown[] | undefined) => (rulesets?.length ?? 0) > 1

/**
 * Every market shares the default ruleset for its whole history. The assignment starts well before any patch the
 * wiki records and stays open, so releases at any date pass the backend's ruleset check.
 */
export const SHARED_RULESET_FROM = "2000-01-01T00:00:00.000Z"

type Send = (path: string, init: { method: string; body: string }) => Promise<unknown>

/** Assigns markets to the shared ruleset; a market that already has an overlapping assignment is skipped. */
export async function assignSharedRuleset(send: Send, rulesetId: string, regionIds: readonly string[]) {
  const results = await Promise.allSettled(
    regionIds.map((regionId) =>
      send(`/admin/regions/${regionId}/ruleset-assignments`, {
        method: "POST",
        body: JSON.stringify({ rulesetId, validFrom: SHARED_RULESET_FROM, validTo: null }),
      }),
    ),
  )
  return results.filter((result) => result.status === "fulfilled").length
}
