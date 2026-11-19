import { Button } from "@aov/ui/components/button"
import { errorMessage } from "@/lib/api/errors"
import { heroLocationId } from "../../model/hero-location"
import { HeroQuickSwitcher } from "../catalog/hero-quick-switcher"
import { HeroContent } from "./hero-content"
import { HeroHistoryView } from "./hero-history-view"
import { HeroNavigationGuard } from "./hero-navigation-guard"
import { HeroSaveBar } from "./hero-save-bar"
import { HeroScrollIdentity } from "./hero-scroll-identity"
import { HeroSectionEditorPanel } from "./hero-section-editor-panel"
import { HeroWorkspaceHeader } from "./hero-workspace-header"
import { PublishingFrame } from "./publishing-frame"
import { useHeroWorkspace } from "./use-hero-workspace"

export type HeroWorkspaceProps = {
  heroId: string
  revisionId?: string
  onUnsavedChange?: (unsafe: boolean, busy?: boolean) => void
  translationMode?: boolean
  /** In the drawer: closes it from the header, after the drawer's own guard for unsaved work. */
  onClose?: () => void
}

/** The page of one hero, on its own or in the drawer: its header, its content or history, and the section editor. */
export function HeroWorkspace({
  heroId,
  revisionId,
  onUnsavedChange,
  translationMode = false,
  onClose,
}: HeroWorkspaceProps) {
  const workspace = useHeroWorkspace({ heroId, revisionId, onUnsavedChange, translationMode })
  const { view, preview, revision, busy, editing, translating, writable, urlParams, updateLocation } = workspace
  const { rulesets, regions, revisions, read, error, statPatch, statDefaults } = workspace
  const quickSwitcher = (
    <HeroQuickSwitcher
      heroId={heroId}
      locale={workspace.displayLocale}
      rulesetId={revision?.rulesetId}
      disabled={busy || !preview}
      onSelect={workspace.switchHero}
      compact
    />
  )
  // One editor at a time. On the content page it takes the place of the section it changes; translations keep it in
  // their own view.
  const editorPanel =
    preview && revision && (editing || translating) ? <HeroSectionEditorPanel workspace={workspace} /> : null

  return (
    <PublishingFrame
      detail
      footer={writable && (editing || translating) && <HeroSaveBar workspace={workspace} />}
      revision={revision}
      captures={workspace.captures}
      heroContent={view === "overview" || translating ? preview?.content : undefined}
      className="@container min-w-0 mx-auto w-full max-w-6xl"
    >
      {!onUnsavedChange && <HeroNavigationGuard unsafe={busy} busy={busy} />}
      {view !== "overview" && (
        <HeroScrollIdentity
          headingRef={workspace.heroHeadingRef}
          identityKey={`${heroId}:${workspace.selectedId}`}
          assetId={preview?.content.MEDIA_BINDINGS?.bindings.HEAD}
          name={workspace.heroName}
          actions={quickSwitcher}
        />
      )}
      <HeroWorkspaceHeader
        workspace={workspace}
        quickSwitcher={quickSwitcher}
        drawer={!!onUnsavedChange}
        onClose={onClose}
      />
      {[rulesets.error, regions.error, revisions.error, read.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {error && (
        <div role="alert" className="space-y-1 rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          <p>{error}</p>
          {(editing || translating) && (
            <p>Phần đang sửa vẫn được giữ lại. Nếu có xung đột, hủy chỉnh sửa nhóm này rồi tải dữ liệu mới nhất.</p>
          )}
        </div>
      )}
      {(read.isFetching || revisions.isPending) && !preview && (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground"
        >
          Đang tải hồ sơ tướng…
        </div>
      )}
      {preview && revision && (
        <>
          {(rulesets.data?.length ?? 0) > 1 && (
            <p className="type-meta">
              {rulesets.data?.find((row) => row.id === revision.rulesetId)?.code ?? "Bộ quy tắc khác"}
            </p>
          )}
          {revision.state !== "DRAFT" && (editing || translating) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <p>Đang xem bản chỉ đọc. Tạo bản nháp để chỉnh sửa hoặc thêm bản dịch.</p>
              {workspace.canWrite && (
                <Button variant="outline" onClick={workspace.startDraft}>
                  {workspace.startDraftLabel}
                </Button>
              )}
            </div>
          )}
          <div role="tabpanel" id={`workspace-${view}`} className="min-w-0 space-y-5">
            {view === "overview" && (
              <HeroContent
                revision={revision}
                sharedTitle={!!workspace.formHolder}
                editing={
                  editing && editorPanel
                    ? { section: workspace.section, title: workspace.editorTitle, node: editorPanel }
                    : null
                }
                variantId={statPatch?.id}
                statDefaults={statDefaults.data}
                referenceError={statDefaults.isError}
                patchCode={statPatch?.patchCode}
                reviewTarget={workspace.reviewTarget}
                onReviewShown={() => workspace.setReviewTarget(null)}
                reveal={workspace.contentReveal}
                content={preview.content}
                locale={workspace.locale}
                editable={!!writable}
                busy={busy}
                heroId={heroId}
                selectedSkillKey={heroLocationId(urlParams.get("skill"))}
                skillLayout={urlParams.get("skillLayout") === "flat" ? "flat" : "focus"}
                onSkillLayoutChange={(layout) => updateLocation({ skillLayout: layout === "flat" ? "flat" : null })}
                onSkillChange={(skill) => updateLocation({ skill })}
                onTranslate={workspace.canWrite ? workspace.openTranslation : undefined}
                canWrite={workspace.canWrite}
                issues={writable ? workspace.issues : undefined}
                onEdit={workspace.editSection}
              />
            )}
            {view === "history" && <HeroHistoryView workspace={workspace} />}
            {view !== "overview" && editorPanel}
          </div>
        </>
      )}
    </PublishingFrame>
  )
}
