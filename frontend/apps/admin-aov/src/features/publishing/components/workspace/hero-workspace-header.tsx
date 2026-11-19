import { useRef, useState, type ReactNode } from "react"
import { Link } from "react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { DraftStatusControl } from "@/app/drafts/draft-status"
import { useWideBox } from "@/hooks/use-wide-box"
import type { Cause } from "@/lib/hero-types"
import { CAUSE_NAMES } from "@/lib/version-causes"
import { PatchCaptureToggle } from "../captures/patch-capture-panel"
import { HeroAsset } from "../editing/hero-asset"
import { HeroFormSwitcher, HeroFormsDialog } from "../editing/hero-forms"
import { HeroSharedPart } from "../editing/hero-shared-part"
import { HeroDraftChanges } from "../patch-changes/hero-draft-changes"
import { HeroHeaderActions } from "./hero-header-actions"
import { HeroReviewNotice } from "./hero-review-notice"
import { HeroWorkspaceTabs } from "./hero-workspace-tabs"
import type { HeroWorkspaceState } from "./use-hero-workspace"

const CAUSES: Record<Cause, string> = CAUSE_NAMES

/**
 * The hero header and its tab row, which stay at the top together while the page scrolls, as a sheet's do: the name
 * with its notices and draft status, the controls, and the hero's forms.
 */
export function HeroWorkspaceHeader({
  workspace,
  quickSwitcher,
  drawer,
  onClose,
}: {
  workspace: HeroWorkspaceState
  /** Switching hero belongs to the name, so its button follows it on the same line. */
  quickSwitcher: ReactNode
  /** In the drawer the header has no way back to the list; the drawer closes instead. */
  drawer: boolean
  onClose?: () => void
}) {
  const headerRef = useRef<HTMLElement>(null)
  const wideHeader = useWideBox(headerRef, 672)
  const [formsOpen, setFormsOpen] = useState(false)
  const { heroId, preview, revision, busy, location, localDraft, dirty, formHolder, formsOwner } = workspace
  return (
    <div className="sticky top-0 z-20 -mx-1 bg-background px-1 pt-1 [overflow-anchor:none]">
      <header ref={headerRef} className="relative">
        {/* The name and the controls wrap as two whole groups, so no button can end up alone on a line. */}
        <div
          className={
            wideHeader ? "flex flex-wrap items-center justify-end gap-x-4 gap-y-3" : "flex min-w-0 items-center gap-1.5"
          }
        >
          <div className={cn("flex min-w-0 items-center gap-2.5", wideHeader ? "flex-auto" : "flex-1 gap-2")}>
            {!drawer && (
              <Button variant="ghost" size="icon" asChild>
                <Link
                  to="/hero"
                  aria-label="Danh sách tướng"
                  onClick={(event) => {
                    if (!workspace.canLeave()) event.preventDefault()
                  }}
                >
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            )}
            {/* A narrow header gives the name the room; the scrolled name bar still shows the picture. */}
            {wideHeader && (
              <HeroAsset
                id={preview?.content.MEDIA_BINDINGS?.bindings.HEAD}
                alt={`Ảnh tướng ${workspace.heroName}`}
                className="size-9 shrink-0 rounded-full"
                frameAspectRatio={1}
              />
            )}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <h1 ref={workspace.heroHeadingRef} className="truncate text-base font-semibold">
                  {workspace.heroName}
                </h1>
                {quickSwitcher}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {revision ? CAUSES[revision.cause] : "Đang mở dữ liệu"}
              </p>
            </div>
            <PatchCaptureToggle />
            {preview && (
              <HeroReviewNotice
                skills={preview.content.SKILLS?.skills ?? []}
                locale={location.readLocale}
                disabled={busy}
                onReview={workspace.writable && !workspace.editorDisabled ? workspace.reviewSkills : undefined}
                onNavigate={workspace.showReviewItem}
              />
            )}
            {workspace.writable && revision && (
              <DraftStatusControl
                key={revision.id}
                draft={localDraft}
                disabled={busy}
                sections={dirty.size}
                changed={new Set([...dirty, ...workspace.savedSections]).size}
                alwaysShown
                discardLabel="Bỏ thay đổi chưa lưu"
              >
                <HeroDraftChanges
                  before={workspace.initialCopy}
                  after={localDraft.value}
                  saved={workspace.savedChanges.data}
                  savedFailed={workspace.savedChanges.isError}
                  locale={workspace.locale}
                  name={workspace.heroName}
                  revisionNo={revision.revisionNo}
                />
              </DraftStatusControl>
            )}
          </div>
          <HeroHeaderActions
            workspace={workspace}
            wide={wideHeader}
            onClose={onClose}
            onOpenForms={() => setFormsOpen(true)}
          />
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <HeroFormSwitcher
            heroId={heroId}
            locale={workspace.displayLocale}
            disabled={busy || !preview}
            onSelect={workspace.switchForm}
          />
          {formHolder && (
            <HeroSharedPart
              holder={formHolder}
              locale={location.readLocale}
              canWrite={workspace.canWrite}
              canPublish={workspace.canPublish}
              disabled={busy}
            />
          )}
        </div>
        {formsOwner && workspace.canPublish && (
          <HeroFormsDialog hero={formsOwner} open={formsOpen} onOpenChange={setFormsOpen} />
        )}
      </header>
      {/* The content is one page now, so only the content and history tabs remain. */}
      <HeroWorkspaceTabs view={workspace.view} busy={busy} onView={workspace.switchView} sticky={false} />
    </div>
  )
}
