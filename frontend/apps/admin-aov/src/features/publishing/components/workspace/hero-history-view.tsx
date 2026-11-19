import { ChevronDown } from "lucide-react"
import { versionPatchLabel } from "../../model/hero-workspace-model"
import { BaselineContextForm } from "../import/baseline-context-form"
import { HeroPatchTimeline } from "../patch-changes/hero-patch-view"
import { PatchChangeForm } from "../patch-changes/patch-change-form"
import { VersionFacts } from "../setup/version-facts"
import { HeroRevisionHistory } from "./hero-revision-history"
import { REVISION_STATES as STATES } from "./hero-version-menu"
import type { HeroWorkspaceState } from "./use-hero-workspace"

/**
 * Where this version sits and how the hero changed: the version on screen with what can be done to it as a whole,
 * then the change notes patch by patch, then any two versions side by side.
 */
export function HeroHistoryView({ workspace }: { workspace: HeroWorkspaceState }) {
  const { heroId, revision, preview, revisions, locale, busy } = workspace
  if (!revision || !preview) return null
  return (
    <div className="min-w-0 space-y-6">
      <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Phiên bản đang mở">
        <h2 className="type-section-title">Phiên bản đang mở</h2>
        <VersionFacts
          version={`Bản ${revision.revisionNo} · ${STATES[revision.state]}`}
          cause={revision.cause}
          patch={versionPatchLabel(workspace.publicationPatch)}
        />
        {workspace.canMove && (
          <BaselineContextForm
            revision={revision}
            disabled={busy || !!workspace.dirty.size}
            onBusyChange={workspace.setBusy}
            onMove={workspace.moveBaseline}
          />
        )}
        {workspace.canRecordChanges && <PatchChangeForm key={revision.id} revision={revision} locale={locale} />}
      </section>
      <HeroPatchTimeline
        heroId={heroId}
        revision={revision}
        revisions={revisions.data ?? []}
        content={preview.content}
        locale={locale}
        canRecord={workspace.capabilities.includes("patch:write")}
      />
      {/* Comparing is a tool for when it is needed: folded, it costs no scrolling past every picture. */}
      <details
        className="group rounded-xl border"
        open={workspace.comparing}
        onToggle={(event) => workspace.setComparing(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span className="grid gap-0.5">
            <span className="type-section-title">So sánh hai bản</span>
            <span className="type-meta">Chọn hai bản đã lưu để xem chỗ khác nhau.</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        {workspace.comparing && (
          <div className="border-t px-4 pb-4">
            <HeroRevisionHistory
              heroId={heroId}
              revision={revision}
              revisions={revisions.data ?? []}
              locale={locale}
              content={preview.content}
              disabled={busy}
              onOpenRevision={(next) => void workspace.run(() => workspace.openRevision(next), "Đã mở phiên bản.")}
            />
          </div>
        )}
      </details>
    </div>
  )
}
