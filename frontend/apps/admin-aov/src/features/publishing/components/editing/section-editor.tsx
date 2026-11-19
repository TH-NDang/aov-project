import { HeroSkillsEditor } from "../skills/hero-skills-editor"
import { HeroSkinsEditor } from "../skins/hero-skins-editor"
import { AdminReferenceProvider } from "../../../terminology/catalog"
import type { HeroSkillsLayout } from "../skills/hero-skills-view"
import { HeroProfileEditor, type ProfileEditorPart } from "./hero-profile-editor"
import { HeroStatsEditor } from "./hero-stats-editor"
import type { StatDefault } from "../../model/assessment/combat-attributes"
import { AssetPicker } from "../assets/asset-picker"
import { retainImageOptions } from "../../model/assets/image-options"
import { heroRatingScale } from "@aov/ui/lib/hero-rating-scale"
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
} from "@/lib/hero-types"

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
  savedSkillKeys,
  savedSkinKeys,
  focusSkinKey,
  sharedTitle,
}: {
  /** The hero is a form, whose title is shared by the hero that holds it. */
  sharedTitle?: boolean
  section: Section
  value: Content[Section]
  locale: string
  onChange: (value: NonNullable<Content[Section]>) => void
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
  /** Skill keys already saved on the server, which keep their key. */
  savedSkillKeys?: ReadonlySet<string>
  /** Skin keys already saved on the server, which keep their key. */
  savedSkinKeys?: ReadonlySet<string>
  /** The one skin opened from its pencil. */
  focusSkinKey?: string | null
}) {
  const data = value ?? emptySection(section, locale)
  let editor
  if (section === "PROFILE") {
    editor = (
      <HeroProfileEditor
        value={data as Profile}
        locale={locale}
        part={profilePart}
        onChange={onChange}
        sharedTitle={sharedTitle}
      />
    )
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
          savedKeys={savedSkillKeys}
          value={data as Skills}
          locale={locale}
          onChange={onChange}
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
    editor = (
      <HeroSkinsEditor
        value={data as Skins}
        locale={locale}
        onChange={onChange}
        focusKey={focusSkinKey}
        savedKeys={savedSkinKeys}
      />
    )
  } else {
    const p = data as Bindings
    editor = (
      <div className="grid gap-4 lg:grid-cols-3">
        {(
          [
            ["HEAD", "Ảnh đại diện"],
            ["PORTRAIT", "Chân dung"],
            ["SPLASH", "Ảnh nền"],
          ] as const
        ).map(([role, label]) => (
          <div key={role} className="space-y-2">
            <h3 className="type-label">{label}</h3>
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
