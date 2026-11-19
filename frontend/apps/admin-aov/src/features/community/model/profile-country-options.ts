import { countryReferences } from "@aov/ui/lib/country-references"
import { normalize } from "@/lib/text"
import { TEAM_REGIONS } from "../../tournaments/components/team-region"

export const profileCountryOptions = [
  ...countryReferences.map((reference) => ({
    code: reference.id,
    name: reference.translations[0]?.name || reference.id,
    aliases: reference.translations.flatMap((translation) => [translation.name, ...(translation.aliases || [])]),
  })),
  ...TEAM_REGIONS.filter((region) => !countryReferences.some((reference) => reference.id === region.id)).map(
    (region) => ({ code: region.id, name: region.name, aliases: [] as string[] }),
  ),
]

/** Resolve existing labels and aliases without rewriting a saved profile on load. */
export function findProfileCountry(value?: string | null) {
  if (!value?.trim()) return undefined
  const needle = normalize(value)
  return profileCountryOptions.find((option) =>
    [option.code, option.name, ...option.aliases].some((name) => normalize(name) === needle),
  )
}
