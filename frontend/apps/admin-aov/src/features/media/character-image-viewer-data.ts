import type { Bindings, MediaRole, Preview, Skin } from "../publishing/types"
import type { CharacterImageEntry } from "./character-image-api"

export const imageRoles: MediaRole[] = ["HEAD", "PORTRAIT", "SPLASH"]
export interface CharacterMediaOwner {
  ownerType: "HERO" | "SKIN"
  skinKey: string | null
  name: string
  rarityCode: string | null
  main: Partial<Record<MediaRole, string | null>>
  images: NonNullable<Bindings["images"]>
}
const translatedName = (values: { locale: string; name: string }[] | undefined, locale: string) =>
  (values?.find((value) => value.locale === locale) ?? values?.find((value) => value.locale === "vi-VN") ?? values?.[0])
    ?.name

/** Secondary navigation contains primary bindings only; candidates stay in their owner's image list. */
export function characterMediaOwners(preview: Preview, locale: string, heroName: string): CharacterMediaOwner[] {
  const media = preview.content.MEDIA_BINDINGS
  const skins = [...(preview.content.SKINS?.skins ?? [])].sort((left, right) => left.displayOrder - right.displayOrder)
  return [
    {
      ownerType: "HERO",
      skinKey: null,
      name: translatedName(preview.content.PROFILE?.translations, locale) ?? heroName,
      rarityCode: null,
      main: media?.bindings ?? {},
      images: media?.images ?? {},
    },
    ...skins.map((skin: Skin): CharacterMediaOwner => ({
      ownerType: "SKIN",
      skinKey: skin.skinKey,
      name: translatedName(skin.translations, locale) ?? skin.skinKey,
      rarityCode: skin.rarityCode,
      main: { HEAD: skin.headAssetId ?? null, PORTRAIT: skin.portraitAssetId ?? null, SPLASH: skin.artAssetId },
      images: skin.images ?? {},
    })),
  ]
}

export function ownerMainEntry(owner: CharacterMediaOwner, role: MediaRole): CharacterImageEntry {
  const assetId = owner.main[role] ?? null
  return {
    ownerType: owner.ownerType,
    skinKey: owner.skinKey,
    name: owner.name,
    rarityCode: owner.rarityCode,
    assetId,
    label: owner.images[role]?.find((image) => image.assetId === assetId)?.label ?? null,
    main: true,
  }
}
