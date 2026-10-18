import { Button } from "@aov/ui/components/button"
import type { Hero } from "@/lib/api/types"
import { AssetPicker } from "./asset-picker"
import { Field, SourceFields, control } from "./fields"
import {
  ROLES,
  type Content,
  type Section,
  type Profile,
  type Ratings,
  type Stats,
  type Skills,
  type Skins,
  type Bindings,
  type MediaRole,
  type Role,
} from "./types"

export function emptySection(section: Section, locale: string): NonNullable<Content[Section]> {
  switch (section) {
    case "PROFILE":
      return { translations: [{ locale, name: "", title: null, summary: null, lore: null }], roles: [], sources: [] }
    case "OVERVIEW_RATINGS":
      return {
        scaleCode: "GAME_OVERVIEW_10",
        survivability: NaN,
        attackDamage: NaN,
        skillEffects: NaN,
        difficulty: NaN,
        derived: false,
        sources: [],
      }
    case "COMBAT_STATS":
      return { values: [], sources: [] }
    case "SKILLS":
      return { skills: [], sources: [] }
    case "SKINS":
      return { skins: [], sources: [] }
    case "MEDIA_BINDINGS":
      return { bindings: {}, sources: [] }
  }
}
export function SectionEditor({
  section,
  value,
  locale,
  onChange,
  resource,
}: {
  section: Section
  value: Content[Section]
  locale: string
  onChange: (value: NonNullable<Content[Section]>) => void
  resource?: Hero
}) {
  const data = value ?? emptySection(section, locale)
  let editor
  if (section === "PROFILE") {
    const p = data as Profile
    editor = (
      <>
        {p.translations.map((t, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-3">
            <Field
              label="Ngôn ngữ (BCP 47)"
              value={t.locale}
              onChange={(locale) =>
                onChange({ ...p, translations: p.translations.map((v, n) => (n === i ? { ...v, locale } : v)) })
              }
              required
            />
            {(
              [
                ["name", "Tên tướng"],
                ["title", "Danh hiệu"],
                ["summary", "Giới thiệu"],
                ["lore", "Cốt truyện"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                multiline={key === "lore" || key === "summary"}
                richTextLocale={t.locale}
                required={key === "name"}
                value={t[key] ?? ""}
                onChange={(text) =>
                  onChange({ ...p, translations: p.translations.map((v, n) => (n === i ? { ...v, [key]: text } : v)) })
                }
              />
            ))}
            {p.translations.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange({ ...p, translations: p.translations.filter((_, n) => n !== i) })}
              >
                Bỏ bản dịch
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...p,
              translations: [...p.translations, { locale: "", name: "", title: null, summary: null, lore: null }],
            })
          }
        >
          Thêm bản dịch
        </Button>
        <div className="flex flex-wrap gap-4">
          {Object.entries(ROLES).map(([role, label]) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={p.roles.includes(role as Role)}
                onChange={(e) =>
                  onChange({
                    ...p,
                    roles: e.target.checked ? [...p.roles, role as Role] : p.roles.filter((r) => r !== role),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </>
    )
  } else if (section === "OVERVIEW_RATINGS") {
    const raw = data as Ratings
    const p = { ...raw, scaleCode: raw.scaleCode || "GAME_OVERVIEW_10" }
    editor = (
      <>
        <p className="text-sm text-muted-foreground">Thang GAME_OVERVIEW_10: từ 0 đến 10. Chỉ điền khi đã có nguồn.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["survivability", "Sinh tồn"],
              ["attackDamage", "Sát thương đánh thường"],
              ["skillEffects", "Hiệu ứng kỹ năng"],
              ["difficulty", "Độ khó"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              type="number"
              min="0"
              max="10"
              step="any"
              required
              label={label}
              value={Number.isFinite(p[key]) ? p[key] : ""}
              onChange={(v) => onChange({ ...p, [key]: v === "" ? NaN : Number(v) })}
            />
          ))}
        </div>
        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={p.derived} onChange={(e) => onChange({ ...p, derived: e.target.checked })} />
          Giá trị suy ra từ phương pháp đánh giá (ghi phương pháp trong nguồn)
        </label>
      </>
    )
  } else if (section === "COMBAT_STATS") {
    const p = data as Stats
    editor = (
      <>
        {p.values.map((s, i) => (
          <div key={i} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            <Field
              label="Mã chỉ số (HP, ARMOR…)"
              required
              pattern="[A-Z][A-Z0-9_]{0,63}"
              value={s.statKey}
              onChange={(statKey) =>
                onChange({ ...p, values: p.values.map((v, n) => (n === i ? { ...v, statKey } : v)) })
              }
            />
            <Field
              label="Đơn vị"
              required
              value={s.unit}
              onChange={(unit) => onChange({ ...p, values: p.values.map((v, n) => (n === i ? { ...v, unit } : v)) })}
            />
            {(
              [
                ["baseValue", "Cơ bản"],
                ["growthPerLevel", "Tăng mỗi cấp"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                type="number"
                step="any"
                label={label}
                value={s[key] ?? ""}
                onChange={(text) =>
                  onChange({
                    ...p,
                    values: p.values.map((v, n) => (n === i ? { ...v, [key]: text === "" ? null : Number(text) } : v)),
                  })
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => onChange({ ...p, values: p.values.filter((_, n) => n !== i) })}
            >
              Bỏ chỉ số
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...p,
              values: [...p.values, { statKey: "", baseValue: null, growthPerLevel: null, unit: "POINT" }],
            })
          }
        >
          Thêm chỉ số
        </Button>
      </>
    )
  } else if (section === "SKILLS") {
    const p = data as Skills
    editor = (
      <>
        {p.skills.map((s, i) => (
          <details key={i} className="rounded-lg border p-3" open={p.skills.length < 5}>
            <summary className="cursor-pointer font-medium">
              {s.translations[0]?.name || s.skillKey || `Kỹ năng ${i + 1}`}
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Khóa kỹ năng"
                  required
                  value={s.skillKey}
                  onChange={(skillKey) =>
                    onChange({ ...p, skills: p.skills.map((v, n) => (n === i ? { ...v, skillKey } : v)) })
                  }
                />
                <label className="grid gap-1 text-sm">
                  Loại
                  <select
                    className={control}
                    value={s.kind}
                    onChange={(e) =>
                      onChange({
                        ...p,
                        skills: p.skills.map((v, n) => (n === i ? { ...v, kind: e.target.value as typeof s.kind } : v)),
                      })
                    }
                  >
                    <option value="PASSIVE">Nội tại</option>
                    <option value="ACTIVE">Chủ động</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                <Field
                  label="Dạng tướng (nếu có)"
                  value={s.formKey ?? ""}
                  onChange={(formKey) =>
                    onChange({
                      ...p,
                      skills: p.skills.map((v, n) => (n === i ? { ...v, formKey: formKey || null } : v)),
                    })
                  }
                />
              </div>
              {s.translations.map((t, j) => (
                <div key={j} className="space-y-3 border-l-2 pl-3">
                  <Field
                    label="Ngôn ngữ"
                    required
                    value={t.locale}
                    onChange={(locale) =>
                      onChange({
                        ...p,
                        skills: p.skills.map((v, n) =>
                          n === i
                            ? { ...v, translations: v.translations.map((t, k) => (k === j ? { ...t, locale } : t)) }
                            : v,
                        ),
                      })
                    }
                  />
                  <Field
                    label="Tên chiêu"
                    required
                    value={t.name}
                    onChange={(name) =>
                      onChange({
                        ...p,
                        skills: p.skills.map((v, n) =>
                          n === i
                            ? { ...v, translations: v.translations.map((t, k) => (k === j ? { ...t, name } : t)) }
                            : v,
                        ),
                      })
                    }
                  />
                  <Field
                    label="Mô tả đã xác minh"
                    multiline
                    richTextLocale={t.locale}
                    required
                    value={t.description}
                    onChange={(description) =>
                      onChange({
                        ...p,
                        skills: p.skills.map((v, n) =>
                          n === i
                            ? {
                                ...v,
                                translations: v.translations.map((t, k) => (k === j ? { ...t, description } : t)),
                              }
                            : v,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...p,
                    skills: p.skills.map((v, n) =>
                      n === i
                        ? { ...v, translations: [...v.translations, { locale: "", name: "", description: "" }] }
                        : v,
                    ),
                  })
                }
              >
                Thêm bản dịch chiêu
              </Button>
              <AssetPicker
                semanticType="HERO_SKILL_ICON"
                value={s.iconAssetId}
                onChange={(iconAssetId) =>
                  onChange({ ...p, skills: p.skills.map((v, n) => (n === i ? { ...v, iconAssetId } : v)) })
                }
                resourcePath={
                  resource?.skills
                    .flatMap((skill) =>
                      skill.variants.map((variant) => ({
                        key:
                          skill.variants.length > 1
                            ? `skill-${skill.slot}-variant-${variant.index}`
                            : `skill-${skill.slot}`,
                        ...variant,
                      })),
                    )
                    .find((v) => v.key === s.skillKey)?.icon
                }
                sourceUrl={resource?.sources.skills}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...p,
                    skills: p.skills.filter((_, n) => n !== i).map((s, displayOrder) => ({ ...s, displayOrder })),
                  })
                }
              >
                Bỏ kỹ năng
              </Button>
            </div>
          </details>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...p,
              skills: [
                ...p.skills,
                {
                  skillKey: `skill-${p.skills.length}`,
                  kind: "ACTIVE",
                  formKey: null,
                  displayOrder: p.skills.length,
                  iconAssetId: null,
                  translations: [{ locale, name: "", description: "" }],
                  effects: [],
                },
              ],
            })
          }
        >
          Thêm kỹ năng
        </Button>
      </>
    )
  } else if (section === "SKINS") {
    const p = data as Skins
    editor = (
      <>
        {p.skins.map((s, i) => (
          <details key={i} className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">{s.translations[0]?.name || s.skinKey}</summary>
            <div className="mt-3 space-y-3">
              <Field
                label="Khóa trang phục"
                required
                value={s.skinKey}
                onChange={(skinKey) =>
                  onChange({ ...p, skins: p.skins.map((v, n) => (n === i ? { ...v, skinKey } : v)) })
                }
              />
              <Field
                label="Mã bậc"
                value={s.rarityCode ?? ""}
                onChange={(rarityCode) =>
                  onChange({
                    ...p,
                    skins: p.skins.map((v, n) => (n === i ? { ...v, rarityCode: rarityCode || null } : v)),
                  })
                }
              />
              {s.translations.map((t, j) => (
                <div key={j} className="space-y-3 border-l-2 pl-3">
                  {(
                    [
                      ["locale", "Ngôn ngữ"],
                      ["name", "Tên trang phục"],
                      ["description", "Mô tả"],
                      ["acquisitionNote", "Cách sở hữu"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      required={key === "locale" || key === "name"}
                      multiline={key === "description"}
                      richTextLocale={t.locale}
                      value={t[key] ?? ""}
                      onChange={(text) =>
                        onChange({
                          ...p,
                          skins: p.skins.map((v, n) =>
                            n === i
                              ? {
                                  ...v,
                                  translations: v.translations.map((t, k) => (k === j ? { ...t, [key]: text } : t)),
                                }
                              : v,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...p,
                    skins: p.skins.map((v, n) =>
                      n === i
                        ? {
                            ...v,
                            translations: [
                              ...v.translations,
                              { locale: "", name: "", description: null, acquisitionNote: null },
                            ],
                          }
                        : v,
                    ),
                  })
                }
              >
                Thêm bản dịch trang phục
              </Button>
              <AssetPicker
                semanticType="HERO_SKIN_ART"
                value={s.artAssetId}
                onChange={(artAssetId) =>
                  onChange({ ...p, skins: p.skins.map((v, n) => (n === i ? { ...v, artAssetId } : v)) })
                }
                resourcePath={resource?.skins.find((skin) => skin.id === s.skinKey)?.cover}
                sourceUrl={resource?.sources.portraits}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...p,
                    skins: p.skins.filter((_, n) => n !== i).map((s, displayOrder) => ({ ...s, displayOrder })),
                  })
                }
              >
                Bỏ trang phục
              </Button>
            </div>
          </details>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...p,
              skins: [
                ...p.skins,
                {
                  skinKey: "",
                  displayOrder: p.skins.length,
                  artAssetId: null,
                  rarityCode: null,
                  translations: [{ locale, name: "", description: null, acquisitionNote: null }],
                },
              ],
            })
          }
        >
          Thêm trang phục
        </Button>
      </>
    )
  } else {
    const p = data as Bindings
    editor = (
      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ["HEAD", "Head"],
            ["PORTRAIT", "Portrait"],
            ["SPLASH", "Splash"],
          ] as const
        ).map(([role, label]) => (
          <div key={role} className="space-y-2">
            <h3 className="text-sm font-medium">{label}</h3>
            <AssetPicker
              semanticType={`HERO_${role}`}
              value={p.bindings[role] ?? null}
              onChange={(assetId) => onChange({ ...p, bindings: { ...p.bindings, [role as MediaRole]: assetId } })}
              resourcePath={
                role === "HEAD" ? resource?.head : role === "PORTRAIT" ? resource?.portrait : resource?.cover
              }
              sourceUrl={resource?.sources.portraits}
            />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {editor}
      <SourceFields sources={data.sources} onChange={(sources) => onChange({ ...data, sources })} />
    </div>
  )
}
