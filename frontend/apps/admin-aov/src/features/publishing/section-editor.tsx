import { HeroSkillsEditor } from "./hero-skills-editor"
import { AdminReferenceProvider } from "../terminology/catalog"
import type { HeroSkillsLayout } from "./hero-skills-view"
import { HeroProfileEditor, type ProfileEditorPart } from "./hero-profile-editor"
import { HeroStatsEditor } from "./hero-stats-editor"
import type { StatDefault } from "./combat-attributes"
import { Button } from "@aov/ui/components/button"
import type { Hero } from "@/lib/api/types"
import { AssetPicker } from "./asset-picker"
import { SkinBadgePicker } from "../media/skin-badge-picker"
import { retainImageOptions } from "./image-options"
import { heroRatingScale } from "./hero-rating-scale"
import { Field, SectionSources } from "./fields"
import {
  SECTIONS,
  type Content,
  type Section,
  type Profile,
  type Ratings,
  type Stats,
  type Skills,
  type Skins,
  type Bindings,
  type MediaRole,
} from "./types"

export function emptySection(section: Section, locale: string): NonNullable<Content[Section]> {
  switch (section) {
    case "PROFILE":
      return {
        translations: [{ locale, name: "", title: null, summary: null, lore: null }],
        roles: [],
        positions: [],
        sources: [],
      }
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
  initialSkillKey,
  skillLayout,
  onSkillLayoutChange,
  onSkillChange,
  heroId,
  onBusyChange,
  reviewOpen,
  onReviewOpenChange,
  profilePart = "information",
  statDefaults,
  skills,
  patchCode,
  referenceError,
}: {
  section: Section
  value: Content[Section]
  locale: string
  onChange: (value: NonNullable<Content[Section]>) => void
  resource?: Hero
  initialSkillKey?: string
  skillLayout?: HeroSkillsLayout
  onSkillLayoutChange?: (layout: HeroSkillsLayout) => void
  onSkillChange?: (skillKey: string) => void
  heroId?: string
  onBusyChange?: (busy: boolean) => void
  reviewOpen?: boolean
  onReviewOpenChange?: (open: boolean) => void
  profilePart?: ProfileEditorPart
  statDefaults?: StatDefault[]
  skills?: Skills | null
  patchCode?: string
  referenceError?: boolean
}) {
  const data = value ?? emptySection(section, locale)
  let editor
  if (section === "PROFILE") {
    editor = <HeroProfileEditor value={data as Profile} locale={locale} part={profilePart} onChange={onChange} />
  } else if (section === "OVERVIEW_RATINGS") {
    const raw = data as Ratings
    const p = { ...raw, scaleCode: raw.scaleCode || "GAME_OVERVIEW_10" }
    const scale = heroRatingScale(p.scaleCode)
    editor = (
      <>
        <p className="text-sm text-muted-foreground">
          Thang đánh giá từ 0 đến {scale.maximum}. Chỉ điền khi đã có nguồn.
        </p>
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
              max={String(scale.maximum)}
              step="any"
              required
              label={label}
              value={Number.isFinite(p[key]) ? p[key] / scale.factor : ""}
              onChange={(v) => onChange({ ...p, [key]: v === "" ? NaN : Number(v) * scale.factor })}
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
    editor = (
      <HeroStatsEditor
        value={data as Stats}
        onChange={onChange}
        defaults={statDefaults}
        skills={skills}
        patchCode={patchCode}
        referenceError={referenceError}
      />
    )
  } else if (section === "SKILLS") {
    editor = (
      <AdminReferenceProvider locale={locale}>
        <HeroSkillsEditor
          value={data as Skills}
          locale={locale}
          onChange={onChange}
          resource={resource}
          initialSkillKey={initialSkillKey}
          reviewOpen={reviewOpen}
          onReviewOpenChange={onReviewOpenChange}
          layout={skillLayout}
          onLayoutChange={onSkillLayoutChange}
          onSkillChange={onSkillChange}
          heroId={heroId}
          onBusyChange={onBusyChange}
        />
      </AdminReferenceProvider>
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
              <label className="grid gap-1.5 text-sm">
                Bậc / nhãn trang phục
                <SkinBadgePicker
                  value={s.rarityCode}
                  locale={locale}
                  onChange={(rarityCode) =>
                    onChange({ ...p, skins: p.skins.map((v, n) => (n === i ? { ...v, rarityCode } : v)) })
                  }
                />
              </label>
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
              <div className="grid gap-3 lg:grid-cols-3">
                {(
                  [
                    ["HEAD", "headAssetId", "Head", "head"],
                    ["PORTRAIT", "portraitAssetId", "Portrait", "portrait"],
                    ["SPLASH", "artAssetId", "Cover", "cover"],
                  ] as const
                ).map(([role, key, title, resourceKey]) => (
                  <div key={role} className="space-y-2">
                    <h4 className="text-sm font-medium">{title}</h4>
                    <AssetPicker
                      semanticType="HERO_SKIN_ART"
                      value={s[key] ?? null}
                      onChange={(assetId) =>
                        onChange({
                          ...p,
                          skins: p.skins.map((v, n) =>
                            n === i
                              ? { ...v, [key]: assetId, images: retainImageOptions(v.images, role, v[key], assetId) }
                              : v,
                          ),
                        })
                      }
                      resourcePath={resource?.skins.find((skin) => skin.id === s.skinKey)?.[resourceKey]}
                      sourceUrl={resource?.sources.portraits}
                    />
                  </div>
                ))}
              </div>
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
              onChange={(assetId) =>
                onChange({
                  ...p,
                  bindings: { ...p.bindings, [role as MediaRole]: assetId },
                  images: retainImageOptions(p.images, role, p.bindings[role], assetId),
                })
              }
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
      {section !== "SKILLS" && !(section === "PROFILE" && profilePart === "lore") && (
        <SectionSources
          sectionLabel={SECTIONS.find(([key]) => key === section)![2]}
          sources={data.sources}
          onChange={(sources) => onChange({ ...data, sources })}
        />
      )}
    </div>
  )
}
