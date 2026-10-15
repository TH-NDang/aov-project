import type { Hero } from "@/lib/api/types"
import type { Content, Source } from "./types"

/** Import only recorded facts. Empty descriptions stay empty until an editor verifies them. */
export function resourceContent(hero: Hero, locale: string): Pick<Content, "PROFILE" | "SKILLS" | "SKINS"> {
  const source = (label: string, url?: string): Source => ({
    label,
    sourceUrl: url ?? null,
    observedAt: null,
    verificationState: "UNVERIFIED",
    note: `resources/Lien-Quan-v3/data/heroes.json#${hero.id}; cần kiểm chứng trước khi publish`,
  })
  return {
    PROFILE: {
      translations: [{ locale, name: hero.name, title: null, summary: null, lore: null }],
      roles: [],
      sources: [source("Danh mục tài nguyên tướng", hero.sources.portraits)],
    },
    SKILLS: {
      skills: hero.skills
        .flatMap((skill) =>
          skill.variants.map((variant) => ({
            skillKey:
              skill.variants.length > 1 ? `skill-${skill.slot}-variant-${variant.index}` : `skill-${skill.slot}`,
            kind: skill.slot === 0 ? ("PASSIVE" as const) : ("ACTIVE" as const),
            formKey: hero.forms.find((form) => form.variantBySlot[String(skill.slot)] === variant.index)?.id ?? null,
            displayOrder: 0,
            iconAssetId: null,
            translations: [{ locale, name: skill.name, description: skill.description ?? "" }],
            effects: [],
          })),
        )
        .map((skill, displayOrder) => ({ ...skill, displayOrder })),
      sources: [source("Danh mục kỹ năng, chưa xác minh mô tả", hero.sources.skills)],
    },
    SKINS: {
      skins: hero.skins
        .filter((skin) => !skin.isDefault)
        .map((skin, displayOrder) => ({
          skinKey: skin.id,
          displayOrder,
          artAssetId: null,
          rarityCode: skin.badgeId,
          translations: [{ locale, name: skin.name, description: null, acquisitionNote: null }],
        })),
      sources: [source("Danh mục trang phục", hero.sources.portraits)],
    },
  }
}

export async function resourceImage(path: string): Promise<File> {
  if (!/^assets\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/.test(path) || path.split("/").includes(".."))
    throw new Error("Đường dẫn tài nguyên không hợp lệ.")
  const response = await fetch(`/__resources/${path}`, { cache: "no-store" })
  if (!response.ok) throw new Error("Không đọc được ảnh tài nguyên.")
  const blob = await response.blob()
  if ((await blob.slice(0, 128).text()).startsWith("version https://git-lfs"))
    throw new Error("Ảnh đang là Git LFS pointer. Chạy git lfs pull trên máy phát triển.")
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type))
    throw new Error("Tài nguyên không phải ảnh. Chức năng này cần Vite dev/preview cùng thư mục resources.")
  return new File([blob], path.split("/").pop()!, { type: blob.type })
}
