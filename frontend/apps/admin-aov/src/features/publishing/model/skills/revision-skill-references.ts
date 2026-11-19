import type { EntityReference } from "@aov/ui/lib/entity-rich-text"
import { skillSlot, skillVariant } from "./hero-skills"
import { skillImageMatch, type SkillImage } from "../../components/skills/skill-artwork"
import type { Content, Revision } from "@/lib/hero-types"

export function revisionSkillReferences(
  revision: Revision,
  content: Content,
  images: readonly SkillImage[],
): EntityReference[] {
  const owner = {
    kind: "hero" as const,
    id: revision.heroId,
    iconAssetId: content.MEDIA_BINDINGS?.bindings.HEAD,
    translations: (content.PROFILE?.translations ?? []).map(({ locale, name }) => ({
      locale,
      name,
      description: "",
      aliases: [],
    })),
  }
  const skills = content.SKILLS?.skills ?? []
  const slots = skills.map((skill) => (skill.kind === "PASSIVE" ? 0 : skillSlot(skill)))
  return skills.map((skill, i) => {
    const slot = slots[i]
    const libraryImage = skill.iconAssetId ? undefined : skillImageMatch(skill, images)
    const params = new URLSearchParams({
      revision: revision.id,
      ruleset: revision.rulesetId,
      tab: "skills",
      skill: skill.skillKey,
    })
    return {
      id: `${owner.id}.${skill.skillKey}`,
      kind: "skill",
      heroId: owner.id,
      owner,
      revisionId: revision.id,
      skillKey: skill.skillKey,
      sourceSlot: slot,
      variantNo: skillVariant(skill),
      formKey: skill.formKey,
      iconAssetId: skill.iconAssetId || libraryImage?.assetId,
      iconSource: skill.iconAssetId ? "REVISION" : libraryImage ? "LIBRARY" : undefined,
      translations: skill.translations.map((text) => ({ ...text, aliases: [] })),
      matchBracketedName: true,
      // Forms sharing a slot still match by their own name; the index leaves the bare slot unresolved.
      autoMatch: slot != null,
      destinations: { admin: `/hero/${owner.id}?${params}` },
    }
  })
}
