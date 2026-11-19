import { useState } from "react"
import { Layers, MoreHorizontal, Trash2, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { DraftPencil } from "@/features/warehouse/components/sheet/warehouse-sheet"
import { SECTIONS, type Cause, type Section } from "@/lib/hero-types"
import { CAUSE_NAMES } from "@/lib/version-causes"
import { HeroLanguagePicker } from "../editing/hero-language-picker"
import { HeroVersionMenu } from "./hero-version-menu"
import { PublishButton } from "./publish-button"
import type { HeroWorkspaceState } from "./use-hero-workspace"

const CAUSES: Record<Cause, string> = CAUSE_NAMES

/**
 * The controls at the end of the hero header: the version, the reading language, the one main action, the menu of the
 * other actions and the drawer's close button. On a narrow header the version menu also holds the language and the
 * main action.
 */
export function HeroHeaderActions({
  workspace,
  wide,
  onClose,
  onOpenForms,
}: {
  workspace: HeroWorkspaceState
  wide: boolean
  onClose?: () => void
  onOpenForms: () => void
}) {
  const [publishOpen, setPublishOpen] = useState(false)
  const { revision, preview, busy, editing, section, translating, issues, headerAction, location } = workspace
  const unsavedSections = SECTIONS.filter(([key]) => workspace.dirty.has(key)).map(([key, , label]) => ({ key, label }))

  const publishButton = (triggerClassName?: string) =>
    revision && (
      <PublishButton
        busy={busy}
        publishing={workspace.publishing}
        issues={issues}
        unsaved={unsavedSections}
        patch={
          workspace.patchLink && {
            ...workspace.patchLink,
            canPublish: workspace.capabilities.includes("patch:publish"),
          }
        }
        onReloadPatch={
          revision.effectiveFromPatchVariantId && !workspace.publicationPatch && !workspace.overview.isPending
            ? () => void workspace.overview.refetch()
            : undefined
        }
        reloadingPatch={workspace.overview.isFetching}
        failure={workspace.publishFailure}
        onDismissFailure={() => workspace.setPublishFailure("")}
        onOpenSection={(key) => workspace.openUnsavedSection(key as Section)}
        onPublish={workspace.publishRevision}
        open={triggerClassName ? publishOpen : undefined}
        onOpenChange={triggerClassName ? setPublishOpen : undefined}
        triggerClassName={triggerClassName}
      />
    )
  // The version as "#n"; on a narrow header its menu also holds the reading language and the main action.
  const versionMenu = (narrow: boolean) =>
    revision && (
      <HeroVersionMenu
        revision={revision}
        revisions={workspace.revisions.data}
        rulesets={workspace.rulesets.data}
        selectedId={workspace.selectedId}
        busy={busy}
        narrow={narrow}
        onChoose={workspace.chooseRevision}
        language={
          narrow && preview && !translating
            ? {
                content: preview.content,
                locale: location.readLocale,
                disabled: busy || (editing && section !== "SKILLS"),
                onChange: workspace.setContentLocale,
              }
            : undefined
        }
        publish={
          narrow && headerAction === "publish"
            ? {
                publishing: workspace.publishing,
                onSelect: () => {
                  // Gaps open the same list the header button shows; with none, the click publishes.
                  if (issues.length || unsavedSections.length) setTimeout(() => setPublishOpen(true))
                  else workspace.publishRevision()
                },
              }
            : undefined
        }
      />
    )
  // The single pencil on a published version: it opens the draft in progress or starts one of the chosen kind.
  const draftPencil = revision && (
    <DraftPencil
      name="tướng"
      rulesetId={revision.rulesetId}
      basePatchVariantId={revision.effectiveFromPatchVariantId}
      openDraft={
        workspace.openDraft ? { revisionNo: workspace.openDraft.revisionNo, onOpen: workspace.startDraft } : undefined
      }
      onCreate={workspace.canFork ? workspace.forkDraft : undefined}
      extraKinds={[
        { cause: "VISUAL_UPDATE", title: CAUSES.VISUAL_UPDATE, note: "Đổi ảnh, giữ nguyên nội dung." },
        { cause: "IMPORT_CORRECTION", title: CAUSES.IMPORT_CORRECTION, note: "Sửa chỗ nhập sai từ nguồn." },
        { cause: "OTHER", title: CAUSES.OTHER, note: "Thay đổi không thuộc các loại trên." },
      ]}
      disabled={busy || !!workspace.dirty.size}
    />
  )
  // The drawer closes like every other sheet: a quiet × at the end of the header row, past a divider.
  const closeButton = onClose && (
    <>
      <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        title="Đóng trang tướng"
        aria-label="Đóng trang tướng"
        disabled={busy}
        onClick={onClose}
      >
        <X />
      </Button>
    </>
  )
  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Thao tác tướng" className="shrink-0 bg-background">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {workspace.canPublish && workspace.heroId && workspace.formsOwner && (
          <DropdownMenuItem disabled={busy} onSelect={onOpenForms}>
            <Layers />
            Dạng của tướng
          </DropdownMenuItem>
        )}
        {workspace.writable && (
          <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => void workspace.discardDraft()}>
            <Trash2 />
            Hủy bản nháp
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  if (wide)
    return (
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        {versionMenu(false)}
        {preview && revision && !translating && (
          <HeroLanguagePicker
            content={preview.content}
            locale={location.readLocale}
            revisionNo={revision.revisionNo}
            disabled={busy}
            languagesDisabled={editing && section !== "SKILLS"}
            onChange={workspace.setContentLocale}
            onTranslate={workspace.translateInto}
          />
        )}
        {headerAction === "publish" && revision && publishButton()}
        {headerAction === "draft" && draftPencil}
        {actionsMenu}
        {closeButton}
      </div>
    )
  // One row on a narrow header: the version menu also holds the language and the main action.
  return (
    <div className="relative flex shrink-0 items-center gap-1.5">
      {versionMenu(true)}
      {headerAction === "draft" && draftPencil}
      {headerAction === "publish" && revision && publishButton("sr-only")}
      {actionsMenu}
      {closeButton}
    </div>
  )
}
