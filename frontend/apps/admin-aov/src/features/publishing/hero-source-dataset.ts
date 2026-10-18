import { isRecord } from "./import-relations"
import { sourceContentWarning, sourceHttpUrl, sourceSkillWarnings } from "./hero-source-review"
import type { Source } from "./types"

export interface SourceDataset {
  rows: Record<string, unknown>[]
  reviewCount: number
  warnings: string[]
}
const sourceAliases: Record<string, string> = {
  apnette: "annette",
  azzenka: "azzen-ka",
  billo: "billow",
  darcy: "d-arcy",
  elandorr: "eland-orr",
  kilgroth: "kil-groth",
  lggy: "iggy",
  tee: "teeri",
  telannas: "tel-annas",
  "tuong-112": "qi",
  ybneth: "y-bneth",
}

const statKeys: Record<string, string> = {
  health: "HP",
  physical_attack: "ATTACK_DAMAGE",
  magic_attack: "ABILITY_POWER",
  physical_defense: "ARMOR",
  magic_defense: "MAGIC_DEFENSE",
  max_energy: "MAX_ENERGY",
  max_resource: "MAX_RESOURCE",
  movement_speed: "MOVEMENT_SPEED",
  physical_pierce: "ARMOR_PIERCE",
  magic_pierce: "MAGIC_PIERCE",
  bonus_attack_speed: "BONUS_ATTACK_SPEED",
  critical_chance: "CRITICAL_CHANCE",
  critical_damage: "CRITICAL_DAMAGE",
  physical_lifesteal: "PHYSICAL_LIFESTEAL",
  magic_lifesteal: "MAGIC_LIFESTEAL",
  cooldown_reduction: "COOLDOWN_REDUCTION",
}
const text = (value: unknown) => (typeof value === "string" ? value : "")
const records = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : [])

/** Recognize the capture dataset explicitly; generic JSON imports keep their original columns. */
export function captureDataset(value: unknown): SourceDataset | null {
  if (!isRecord(value) || value.dataset_type !== "aov_heroes_manual_image_extraction" || !Array.isArray(value.heroes))
    return null
  const rows = records(value.heroes).map((record) => {
    if (!isRecord(record.hero)) throw new Error("Bản ghi ảnh chụp thiếu thông tin tướng.")
    const hero = record.hero
    const sourceCode = text(hero.slug)
    const code = ["flowborn", "flowborn-2"].includes(sourceCode) ? "" : (sourceAliases[sourceCode] ?? sourceCode)
    const flags = records(record.review_flags)
    const provenance = isRecord(record.sources) ? record.sources : {}
    const sourceImages = records(provenance.images)
    const source: Source = {
      label: `Dữ liệu ảnh chụp · ${text(hero.name) || code}`,
      sourceUrl: sourceHttpUrl(provenance.folder_url),
      observedAt: null,
      verificationState: "UNVERIFIED",
      note: "Mốc dữ liệu do người cung cấp xác nhận khi nhập. Chưa xác định cấp tướng trong ảnh; các giá trị thuộc tính là số ghi nhận, không suy ra tăng trưởng mỗi cấp.",
    }
    const ratings = isRecord(hero.overview_ratings) ? hero.overview_ratings : {}
    const bars = records(ratings.bars)
    const score = (labels: string[]) => {
      const bar = bars.find((item) => labels.includes(text(item.label)))
      return typeof bar?.filled_segments === "number" &&
        typeof bar.total_visible_segments === "number" &&
        bar.total_visible_segments > 0
        ? (bar.filled_segments / bar.total_visible_segments) * 10
        : null
    }
    const attributes = isRecord(hero.attributes) ? hero.attributes : {}
    const stats = Object.values(attributes)
      .filter(isRecord)
      .flatMap((group) =>
        Object.entries(group).flatMap(([key, item]) => {
          if (!statKeys[key] || !isRecord(item) || typeof item.value !== "number" || !Number.isFinite(item.value))
            return []
          return [
            {
              statKey: statKeys[key],
              baseValue: item.value,
              growthPerLevel: null,
              unit: item.unit === "percent" ? "PERCENT" : "UNKNOWN",
            },
          ]
        }),
      )
    const skills = records(hero.skills).flatMap((skill, index) => {
      if (skill.duplicate_of) return []
      const slot =
        typeof skill.index === "number"
          ? skill.index
          : skill.slot === "passive"
            ? 0
            : Number(text(skill.slot).replace("skill_", ""))
      const stableSlot = Number.isInteger(slot) && slot >= 0 ? slot : index
      const skillFlags = sourceSkillWarnings(flags, index, skill.slot)
      const mismatched = flags.some((flag) => flag.type === "source_filename_display_mismatch")
      return [
        {
          skillKey: mismatched ? `capture-${text(skill.slot).replaceAll("_", "-") || index}` : `skill-${stableSlot}-1`,
          kind: stableSlot === 0 ? "PASSIVE" : "ACTIVE",
          formKey: null,
          displayOrder: index,
          name: text(skill.name) || (stableSlot === 0 ? "Nội tại" : `Chiêu ${stableSlot}`),
          description: text(skill.description) || text(skill.description_plain),
          effects: [
            {
              effectType: "SOURCE_SNAPSHOT",
              metadata: {
                sourceHeroCode: sourceCode,
                sourceImage: skill.source_image ?? null,
                sourceImageUrl: sourceHttpUrl(
                  sourceImages.find((image) => image.file_name === skill.source_image)?.url,
                ),
                sourceSlot: skill.slot ?? null,
                displayedSkillNumber: skill.displayed_skill_number ?? null,
                duplicateCaptures: records(hero.skills).filter((item) => item.duplicate_of === skill.slot),
                cooldown: skill.cooldown ?? null,
                energyCost: skill.energy_cost ?? null,
                levelTable: skill.skill_level_table ?? null,
                tags: skill.tags ?? [],
                reviewFlags: skillFlags,
                heroReviewFlags: flags,
                rawAttributes: attributes,
                heroLevel: attributes.hero_level ?? null,
                completeness: skillFlags.length ? "NEEDS_REVIEW" : "CAPTURED_ONLY",
              },
            },
          ],
        },
      ]
    })
    const overviewRatings = {
      scaleCode: "GAME_OVERVIEW_10",
      survivability: score(["Sinh mệnh", "Sinh tồn"]),
      attackDamage: score(["Sát thương Tay", "Sát thương tay"]),
      skillEffects: score(["Hiệu ứng kỹ năng"]),
      difficulty: score(["Độ khó"]),
      derived: true,
      sources: [
        {
          ...source,
          note: "Đếm các đoạn thanh trong ảnh, quy đổi filled_segments / total_visible_segments × 10. Đây là đánh giá suy ra, không phải chỉ số chính thức.",
        },
      ],
    }
    return {
      code,
      name: text(hero.name),
      title: text(hero.title),
      summary: text(hero.tip),
      skills,
      ...(Object.values(overviewRatings).some((item) => item === null) ? {} : { overviewRatings }),
      ...(stats.length ? { combatStats: { values: stats, sources: [source] } } : {}),
      __sourceReview: flags,
      __sourceCode: sourceCode,
      __sourceRecordId: text(record.record_id) || sourceCode,
    }
  })
  const curated = Array.isArray(value.review_index)
    ? new Set(
        records(value.review_index)
          .map((item) => text(item.record_id))
          .filter(Boolean),
      )
    : null
  const reviewCount = rows.filter((row) =>
    curated
      ? curated.has(row.__sourceRecordId) || curated.has(row.__sourceCode)
      : records(row.__sourceReview).some(sourceContentWarning),
  ).length
  return {
    rows,
    reviewCount,
    warnings: [
      "Đã nhận diện bộ dữ liệu ảnh chụp. Chọn mùa và patch của nội dung nguồn; ngày xuất file không phải ngày phát hành game.",
      "Giữ nguyên tên, mô tả màu và nhãn bảng cấp chiêu. Không tự suy đoán vai trò, cấp tướng, đơn vị hoặc những dạng chiêu chưa thu thập.",
    ],
  }
}

/** Merge artwork by stable slug/slot only; capture descriptions and review flags remain authoritative. */
export function mergeResourceArtwork(
  rows: Record<string, unknown>[],
  resourceHeroes: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byCode = new Map(resourceHeroes.map((hero) => [text(hero.id), hero]))
  const image = (path: unknown) =>
    typeof path === "string" && path.startsWith("assets/") && /\.(png|jpe?g|webp)$/i.test(path)
      ? `/__resources/${path}`
      : undefined
  return rows.map((row) => {
    const resource = byCode.get(text(row.code))
    if (!resource) return row
    return {
      ...row,
      ...(image(resource.head) ? { head: image(resource.head) } : {}),
      ...(image(resource.portrait) ? { portrait: image(resource.portrait) } : {}),
      ...(image(resource.cover) ? { splash: image(resource.cover) } : {}),
      skills: records(row.skills).map((skill) => {
        if (records(row.__sourceReview).some((flag) => flag.type === "source_filename_display_mismatch")) return skill
        const match = /^skill-(\d+)-1$/.exec(text(skill.skillKey))
        const source = match ? records(resource.skills).find((item) => item.slot === Number(match[1])) : undefined
        const variant = source ? records(source.variants).find((item) => item.index === 1) : undefined
        return image(variant?.icon) ? { ...skill, iconAssetId: image(variant?.icon) } : skill
      }),
      skins: records(resource.skins)
        .filter((skin) => text(skin.id) && text(skin.name))
        .map((skin, index) => ({
          skinKey: text(skin.id),
          name: text(skin.name),
          displayOrder: index,
          rarityCode: skin.badgeId ?? null,
          ...(image(skin.cover) ? { artAssetId: image(skin.cover) } : {}),
        })),
    }
  })
}
