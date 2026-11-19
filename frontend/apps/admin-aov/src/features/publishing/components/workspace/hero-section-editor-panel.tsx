import { Button } from "@aov/ui/components/button"
import { SECTIONS, type Content } from "@/lib/hero-types"
import { heroLocationId } from "../../model/hero-location"
import { translationFields, type TranslatableSection, type TranslationField } from "../../model/hero-translation-model"
import { translatableSections } from "../../model/hero-workspace-model"
import { Box } from "../editing/fields"
import { HeroLanguagePicker } from "../editing/hero-language-picker"
import { SectionEditor, emptySection } from "../editing/section-editor"
import { TranslationEditor } from "../editing/translation-editor"
import type { HeroWorkspaceState } from "./use-hero-workspace"

/**
 * The editor of one section. On the content page it takes the place of the section it changes; translating adds the
 * target language and the sections that are written per language.
 */
export function HeroSectionEditorPanel({ workspace }: { workspace: HeroWorkspaceState }) {
  const { preview, revision, read, busy, translating, section, locale, location, urlParams, updateLocation } = workspace
  const { sourceLocale, targetLocale } = location
  if (!preview || !revision) return null
  return (
    <div
      ref={workspace.editorRef}
      tabIndex={-1}
      className="scroll-mt-16 space-y-4 outline-none"
      role="region"
      aria-label="Chỉnh sửa nội dung"
    >
      {translating && (
        <fieldset disabled={busy} className="grid gap-4 admin-section py-4">
          <div className="min-w-0 space-y-2">
            <p className="type-label">Dịch sang</p>
            <HeroLanguagePicker
              label="Ngôn ngữ đích"
              locale={targetLocale}
              content={preview.content}
              revisionNo={revision.revisionNo}
              disabled={busy}
              onChange={workspace.setTargetLocale}
              compact={false}
            />
          </div>
          {sourceLocale === locale && (
            <p role="status" className="text-sm text-(--aov-warning) @min-[600px]:col-span-2">
              Chọn ngôn ngữ đích khác nguồn để bắt đầu biên dịch.
            </p>
          )}
        </fieldset>
      )}
      {translating && (
        <div className="flex gap-1 overflow-x-auto" aria-label="Các phần nội dung">
          {SECTIONS.filter(([key]) => translatableSections.includes(key)).map(([key, , label]) => (
            <Button
              key={key}
              type="button"
              disabled={busy}
              className="shrink-0"
              variant={section === key ? "secondary" : "ghost"}
              onClick={() => workspace.setSection(key)}
            >
              {label}
              {workspace.dirty.has(key) && (
                <span className="size-1.5 rounded-full bg-(--aov-warning)" aria-label="Chưa lưu" />
              )}
            </Button>
          ))}
        </div>
      )}
      <Box title={workspace.editorTitle} unframed={!translating}>
        <form
          id={workspace.sectionFormId}
          onSubmit={(event) => {
            event.preventDefault()
            workspace.saveSection()
          }}
        >
          <fieldset disabled={workspace.editorDisabled} className="min-w-0 space-y-5">
            {translating ? (
              <TranslationEditor
                section={section as TranslatableSection}
                value={
                  (preview.content[section] ?? emptySection(section, locale)) as NonNullable<
                    Content[TranslatableSection]
                  >
                }
                sourceLocale={sourceLocale}
                targetLocale={locale}
                onChange={workspace.updateSection}
                focusKey={urlParams.get("translationKey") ?? undefined}
                focusField={
                  Object.hasOwn(translationFields, urlParams.get("translationField") ?? "")
                    ? (urlParams.get("translationField") as TranslationField)
                    : undefined
                }
                onClearFocus={() => updateLocation({ translationKey: null, translationField: null })}
              />
            ) : (
              <SectionEditor
                sharedTitle={!!workspace.formHolder}
                savedSkillKeys={new Set(read.data?.content.SKILLS?.skills.map((skill) => skill.skillKey) ?? [])}
                savedSkinKeys={new Set(read.data?.content.SKINS?.skins.map((skin) => skin.skinKey) ?? [])}
                focusSkinKey={workspace.skinFocus}
                statDefaults={workspace.statDefaults.data}
                referenceError={workspace.statDefaults.isError}
                skills={preview.content.SKILLS}
                patchCode={workspace.statPatch?.patchCode}
                section={section}
                value={preview.content[section]}
                locale={locale}
                profilePart={workspace.profilePart}
                onChange={workspace.updateSection}
                heroId={workspace.heroId}
                initialSkillKey={heroLocationId(urlParams.get("skill"))}
                skillLayout={urlParams.get("skillLayout") === "flat" ? "flat" : "focus"}
                onSkillLayoutChange={(layout) => updateLocation({ skillLayout: layout === "flat" ? "flat" : null })}
                onSkillChange={(skill) => updateLocation({ skill })}
                onBusyChange={workspace.setBusy}
                reviewOpen={workspace.reviewOpen}
                onReviewOpenChange={workspace.setReviewOpen}
              />
            )}
          </fieldset>
        </form>
      </Box>
    </div>
  )
}
