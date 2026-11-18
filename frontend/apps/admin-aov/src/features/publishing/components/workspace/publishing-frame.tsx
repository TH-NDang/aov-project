import { useMemo, type ComponentProps, type ReactNode } from "react"
import { revisionSkillReferences } from "@/features/publishing/model/skills/revision-skill-references"
import { useHeroSkillImages } from "@/features/publishing/components/skills/skill-artwork"
import { Page } from "@/components/page-header"

import { type Content, type Revision } from "@/lib/hero-types"
import { ReferenceRulesetProvider } from "@/features/terminology/catalog"
import { PatchCapturePanel } from "@/features/publishing/components/captures/patch-capture-panel"
import { PatchCaptureProvider, type PatchCaptureWorkspace } from "@/features/publishing/api/use-patch-captures"

/** The hero page around its content: the references and captures every part reads, and the capture panel beside it. */
export function PublishingFrame({
  detail,
  footer,
  revision,
  heroContent,
  captures,
  ...props
}: ComponentProps<typeof Page> & {
  detail: boolean
  footer?: ReactNode
  revision?: Revision
  heroContent?: Content
  captures: PatchCaptureWorkspace
}) {
  const images = useHeroSkillImages(
    heroContent?.SKILLS?.skills.some((skill) => !skill.iconAssetId) ? revision?.heroId : undefined,
  )
  const skills = useMemo(
    () => (revision && heroContent ? revisionSkillReferences(revision, heroContent, images.data ?? []) : []),
    [revision, heroContent, images.data],
  )
  return (
    <ReferenceRulesetProvider rulesetId={revision?.rulesetId} skills={skills}>
      <PatchCaptureProvider value={captures}>
        {detail ? (
          // A container query cannot style its own container, so the split direction lives one level down.
          <div className="@container/hero-split flex h-full min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col @5xl/hero-split:flex-row">
              <div className="@container flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
                  <Page {...props} />
                </div>
                {footer}
              </div>
              {captures.open && captures.state.status !== "unavailable" && <PatchCapturePanel captures={captures} />}
            </div>
          </div>
        ) : (
          <Page {...props} />
        )}
      </PatchCaptureProvider>
    </ReferenceRulesetProvider>
  )
}
