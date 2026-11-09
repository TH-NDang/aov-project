import { z } from "zod"
import { sameDraftValue } from "@/app/drafts/draft-store"
import { reconcileDraft } from "@/app/drafts/draft-merge"
import { SECTIONS, type Content, type Section } from "./types"

export type HeroWorkingCopy = { content: Content; notes: Partial<Record<Section | "PROFILE_LORE", string>> }
const text = z.string()
const nullableText = text.nullable()
const number = z.union([z.number(), z.nan()])
const source = z.object({
  label: text,
  sourceUrl: nullableText,
  observedAt: nullableText,
  verificationState: z.enum(["VERIFIED", "UNVERIFIED"]),
  note: nullableText,
})
const translation = z.object({ locale: text, name: text })
const imageOptions = z.partialRecord(
  z.enum(["HEAD", "PORTRAIT", "SPLASH"]),
  z.array(z.object({ assetId: text, label: nullableText })),
)
const contentSchema = z.object({
  PROFILE: z
    .object({
      translations: z.array(translation.extend({ title: nullableText, summary: nullableText, lore: nullableText })),
      roles: z.array(z.enum(["TANK", "WARRIOR", "ASSASSIN", "MAGE", "MARKSMAN", "SUPPORT"])),
      positions: z.array(z.enum(["TOP", "MID", "JUNGLE", "DRAGON", "SUPPORT"])).optional(),
      sources: z.array(source),
    })
    .nullable(),
  OVERVIEW_RATINGS: z
    .object({
      scaleCode: nullableText,
      survivability: number.nullable(),
      attackDamage: number.nullable(),
      skillEffects: number.nullable(),
      difficulty: number.nullable(),
      derived: z.boolean(),
      sources: z.array(source),
    })
    .nullable(),
  COMBAT_STATS: z
    .object({
      values: z.array(
        z.object({
          statKey: text,
          baseValue: number.nullable(),
          percentValue: number.nullable().optional(),
          growthPerLevel: number.nullable(),
          unit: text,
        }),
      ),
      sources: z.array(source),
    })
    .nullable(),
  SKILLS: z
    .object({
      skills: z.array(
        z.object({
          skillKey: text,
          kind: z.enum(["PASSIVE", "ACTIVE", "OTHER"]),
          formKey: nullableText,
          displayOrder: number,
          iconAssetId: nullableText,
          translations: z.array(translation.extend({ description: text })),
          effects: z.array(z.object({ effectType: text, metadata: z.record(text, z.unknown()) })),
          // A label may be empty while it is being typed; the server checks it on save.
          stateIcons: z.array(z.object({ assetId: text, label: z.string() })).optional(),
        }),
      ),
      sources: z.array(source),
    })
    .nullable(),
  SKINS: z
    .object({
      skins: z.array(
        z.object({
          skinKey: text,
          displayOrder: number,
          artAssetId: nullableText,
          headAssetId: nullableText.optional(),
          portraitAssetId: nullableText.optional(),
          images: imageOptions.optional(),
          rarityCode: nullableText,
          translations: z.array(translation.extend({ description: nullableText, acquisitionNote: nullableText })),
        }),
      ),
      sources: z.array(source),
    })
    .nullable(),
  MEDIA_BINDINGS: z
    .object({
      bindings: z.partialRecord(z.enum(["HEAD", "PORTRAIT", "SPLASH"]), text),
      images: imageOptions.optional(),
      sources: z.array(source),
    })
    .nullable(),
})
export const heroWorkingSchema = z.object({
  content: contentSchema,
  notes: z.partialRecord(z.enum([...SECTIONS.map(([key]) => key), "PROFILE_LORE"]), z.string()),
}) as unknown as z.ZodType<HeroWorkingCopy>

export const emptyHeroContent: Content = {
  PROFILE: null,
  OVERVIEW_RATINGS: null,
  COMBAT_STATS: null,
  SKILLS: null,
  SKINS: null,
  MEDIA_BINDINGS: null,
}

/** Roles and positions are sets, so listing them in another order changes nothing that could be saved. */
export function comparableSection(section: Section, value: Content[Section] | undefined) {
  if (section !== "PROFILE" || !value) return value
  const profile = value as NonNullable<Content["PROFILE"]>
  return { ...profile, roles: [...profile.roles].sort(), positions: [...(profile.positions ?? [])].sort() }
}

export const sameHeroSection = (
  section: Section,
  left: Content[Section] | undefined,
  right: Content[Section] | undefined,
) => sameDraftValue(comparableSection(section, left), comparableSection(section, right))

export function dirtyHeroSections(value: HeroWorkingCopy, base: HeroWorkingCopy): Section[] {
  return SECTIONS.map(([key]) => key).filter((key) => !sameHeroSection(key, value.content[key], base.content[key]))
}
export function heroWorkingConflict(base: HeroWorkingCopy, value: HeroWorkingCopy, current: HeroWorkingCopy) {
  return reconcileDraft(base, value, current).conflict
}

export function mergeHeroWorkingCopy(
  base: HeroWorkingCopy,
  value: HeroWorkingCopy,
  current: HeroWorkingCopy,
): HeroWorkingCopy {
  return reconcileDraft(base, value, current).value as HeroWorkingCopy
}
